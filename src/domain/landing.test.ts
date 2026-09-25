import { describe, expect, it } from 'vitest'
import { assessLanding, SAFE_STOPPING_RATIO, type LandingTelemetry, type PlanetId } from './landing'

const baseline: LandingTelemetry = {
  planetId: 'earth',
  heightMeters: 100,
  descentSpeedMetersPerSecond: 10,
  enginePowerPercent: 50,
  tiltDegrees: 0,
}

function assessmentFor(telemetry: LandingTelemetry) {
  const result = assessLanding(telemetry)
  expect(result.valid).toBe(true)
  if (!result.valid) throw new Error('Expected valid telemetry')
  return result.assessment
}

describe('assessLanding', () => {
  it('classifies an Earth descent with ample stopping room as safe', () => {
    const assessment = assessmentFor(baseline)
    expect(assessment.outcome).toBe('SAFE_APPROACH')
    expect(assessment.stoppingDistanceMeters).toBeCloseTo(6.502, 3)
    expect(assessment.requiredThrottlePercent).toBeCloseTo(30.069, 3)
  })

  it('classifies low-margin and insufficient-altitude descents', () => {
    expect(assessmentFor({ ...baseline, heightMeters: 8 }).outcome).toBe('MARGINAL')
    expect(assessmentFor({ ...baseline, heightMeters: 5 }).outcome).toBe('CRASH_LIKELY')
  })

  it('changes the same descent when planetary gravity changes', () => {
    const telemetry = { ...baseline, enginePowerPercent: 40 }
    expect(assessmentFor({ ...telemetry, planetId: 'mars' }).outcome).toBe('SAFE_APPROACH')
    expect(assessmentFor({ ...telemetry, planetId: 'jupiter' }).reasonCode).toBe(
      'INSUFFICIENT_BRAKING',
    )
  })

  it('keeps Jupiter survivable with the 35 m/s² engine', () => {
    const assessment = assessmentFor({ ...baseline, planetId: 'jupiter', enginePowerPercent: 100 })
    expect(assessment.outcome).toBe('SAFE_APPROACH')
    expect(assessment.requiredThrottlePercent).toBeLessThan(100)
  })

  it('classifies insufficient thrust and a horizontal engine as crash likely', () => {
    expect(assessmentFor({ ...baseline, enginePowerPercent: 20 }).reasonCode).toBe(
      'INSUFFICIENT_BRAKING',
    )
    expect(assessmentFor({ ...baseline, tiltDegrees: 90 }).reasonCode).toBe(
      'INSUFFICIENT_BRAKING',
    )
  })

  it('treats the exact safe-margin boundary as safe', () => {
    const stoppingDistance = assessmentFor(baseline).stoppingDistanceMeters
    if (stoppingDistance === null) throw new Error('Expected a stopping distance')
    expect(
      assessmentFor({ ...baseline, heightMeters: stoppingDistance / SAFE_STOPPING_RATIO }).outcome,
    ).toBe('SAFE_APPROACH')
  })

  it('rejects an unknown planet and impossible numeric telemetry', () => {
    const result = assessLanding({
      planetId: 'pluto' as PlanetId,
      heightMeters: 0,
      descentSpeedMetersPerSecond: Number.NaN,
      enginePowerPercent: 101,
      tiltDegrees: -1,
    })
    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('Expected invalid telemetry')
    expect(result.issues.map((issue) => issue.field)).toEqual([
      'planetId',
      'heightMeters',
      'descentSpeedMetersPerSecond',
      'enginePowerPercent',
      'tiltDegrees',
    ])
  })
})
