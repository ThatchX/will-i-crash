import { describe, expect, it } from 'vitest'
import {
  FLIGHT_TICKS_PER_SECOND,
  MAX_FLIGHT_TICKS,
  appendControlEvent,
  calculateLandingScore,
  createInitialFlightState,
  evaluateTouchdown,
  replayFlight,
  getRankedInitialConditions,
  getLeaderboardCallsign,
  getLeaderboardPilotKey,
  matchesRankedInitialConditions,
  stepFlight,
  validateControlEvents,
  validateInitialConditions,
  type FlightControlEvent,
  type FlightInitialConditions,
} from './flight'

const initial: FlightInitialConditions = {
  planetId: 'earth',
  altitudeMeters: 300,
  verticalSpeedMetersPerSecond: 10,
  horizontalSpeedMetersPerSecond: 6,
}

describe('V3 flight simulation', () => {
  it('advances with a fixed deterministic step', () => {
    const start = createInitialFlightState(initial)
    const next = stepFlight(start, { throttlePercent: 0, rotationDirection: 0 }, 9.81)
    expect(next.tick).toBe(1)
    expect(next.verticalSpeedMetersPerSecond).toBeCloseTo(
      10 + 9.81 / FLIGHT_TICKS_PER_SECOND,
      8,
    )
    expect(next.altitudeMeters).toBeLessThan(start.altitudeMeters)
  })

  it('uses signed tilt to redirect thrust horizontally', () => {
    let state = createInitialFlightState({ ...initial, horizontalSpeedMetersPerSecond: 0 })
    for (let tick = 0; tick < 30; tick += 1) {
      state = stepFlight(state, { throttlePercent: 80, rotationDirection: 1 }, 3.71)
    }
    expect(state.angleDegrees).toBeCloseTo(54, 5)
    expect(state.horizontalSpeedMetersPerSecond).toBeGreaterThan(0)
    expect(state.fuelPercent).toBeLessThan(100)
  })

  it('classifies safe, marginal, and crashed touchdown boundaries', () => {
    const base = createInitialFlightState(initial)
    expect(
      evaluateTouchdown({
        ...base,
        tick: 30,
        verticalSpeedMetersPerSecond: 5,
        horizontalSpeedMetersPerSecond: -3,
        angleDegrees: 10,
      }).outcome,
    ).toBe('SAFE_APPROACH')
    expect(
      evaluateTouchdown({
        ...base,
        verticalSpeedMetersPerSecond: 8,
        horizontalSpeedMetersPerSecond: 4,
        angleDegrees: 15,
      }).outcome,
    ).toBe('MARGINAL')
    expect(
      evaluateTouchdown({
        ...base,
        verticalSpeedMetersPerSecond: 15,
        horizontalSpeedMetersPerSecond: 9,
        angleDegrees: 30,
      }).reasonCode,
    ).toBe('MULTIPLE_LIMITS')
  })

  it('replays the same control trace identically', () => {
    const commands: FlightControlEvent[] = [
      { tick: 0, throttlePercent: 70, rotationDirection: -1 },
      { tick: 30, throttlePercent: 80, rotationDirection: 1 },
      { tick: 60, throttlePercent: 40, rotationDirection: 0 },
    ]
    expect(replayFlight(initial, commands)).toEqual(replayFlight(initial, commands))
  })

  it('changes the same flight trace when planet gravity changes', () => {
    const commands: FlightControlEvent[] = [
      { tick: 0, throttlePercent: 45, rotationDirection: 0 },
    ]
    const earth = replayFlight(initial, commands)
    const mars = replayFlight({ ...initial, planetId: 'mars' }, commands)
    expect(earth.result?.touchdownVerticalSpeed).not.toBe(
      mars.result?.touchdownVerticalSpeed,
    )
  })

  it('replaces same-tick commands and omits repeated controls', () => {
    const first = appendControlEvent([], { tick: 0, throttlePercent: 20, rotationDirection: 0 })
    const replaced = appendControlEvent(first, {
      tick: 0,
      throttlePercent: 30,
      rotationDirection: 1,
    })
    const unchanged = appendControlEvent(replaced, {
      tick: 4,
      throttlePercent: 30,
      rotationDirection: 1,
    })
    expect(replaced).toEqual([{ tick: 0, throttlePercent: 30, rotationDirection: 1 }])
    expect(unchanged).toBe(replaced)
  })

  it('rejects invalid initial conditions and control traces', () => {
    expect(validateInitialConditions({ ...initial, altitudeMeters: 0 })[0]?.field).toBe(
      'altitudeMeters',
    )
    expect(
      validateControlEvents([
        { tick: MAX_FLIGHT_TICKS + 1, throttlePercent: 110, rotationDirection: 1 },
      ])[0]?.field,
    ).toBe('commands')
  })

  it('uses one standardized configuration for ranked flights', () => {
    const ranked = getRankedInitialConditions('mars')
    expect(ranked).toEqual({
      planetId: 'mars',
      altitudeMeters: 300,
      verticalSpeedMetersPerSecond: 10,
      horizontalSpeedMetersPerSecond: 8,
    })
    expect(matchesRankedInitialConditions(ranked)).toBe(true)
    expect(matchesRankedInitialConditions({ ...ranked, altitudeMeters: 301 })).toBe(false)
  })

  it('scores only safe ranked landings with explainable weighted components', () => {
    const base = evaluateTouchdown({
      ...createInitialFlightState(initial),
      tick: 300,
      verticalSpeedMetersPerSecond: 0,
      horizontalSpeedMetersPerSecond: 0,
      angleDegrees: 0,
      fuelPercent: 100,
    })
    expect(calculateLandingScore(base)).toBe(1_000)
    expect(calculateLandingScore({ ...base, touchdownVerticalSpeed: 2.5 })).toBe(800)
    expect(calculateLandingScore({ ...base, outcome: 'MARGINAL' })).toBe(0)
  })

  it('derives a stable public pilot key without exposing the account identifier', () => {
    const userId = 'user@example.com'
    expect(getLeaderboardPilotKey(userId)).toBe(getLeaderboardPilotKey(userId))
    expect(getLeaderboardPilotKey(userId)).not.toContain(userId)
    expect(getLeaderboardCallsign(userId)).toMatch(/^Pilot-[0-9A-F]{6}$/)
  })
})
