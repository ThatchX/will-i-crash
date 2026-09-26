import {
  MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED,
  getPlanet,
  isPlanetId,
  type LandingOutcome,
  type PlanetId,
} from './landing'

export const FLIGHT_MODEL_VERSION = 3
export const FLIGHT_TICKS_PER_SECOND = 30
export const FLIGHT_TIME_STEP_SECONDS = 1 / FLIGHT_TICKS_PER_SECOND
export const MAX_FLIGHT_SECONDS = 120
export const MAX_FLIGHT_TICKS = MAX_FLIGHT_SECONDS * FLIGHT_TICKS_PER_SECOND
export const MAX_ROTATION_DEGREES = 60
export const ROTATION_RATE_DEGREES_PER_SECOND = 54
export const FUEL_BURN_PERCENT_PER_SECOND_AT_FULL_POWER = 3.2
export const RANKED_CHALLENGE_VERSION = 1
export const RANKED_CHALLENGE_KEY = `model-${FLIGHT_MODEL_VERSION}-standard-${RANKED_CHALLENGE_VERSION}`

export const SAFE_VERTICAL_SPEED_METERS_PER_SECOND = 5
export const SAFE_HORIZONTAL_SPEED_METERS_PER_SECOND = 3
export const SAFE_ANGLE_DEGREES = 10
export const MARGINAL_VERTICAL_SPEED_METERS_PER_SECOND = 10
export const MARGINAL_HORIZONTAL_SPEED_METERS_PER_SECOND = 6
export const MARGINAL_ANGLE_DEGREES = 20

export const MIN_STARTING_ALTITUDE_METERS = 50
export const MAX_STARTING_ALTITUDE_METERS = 2_000
export const MAX_STARTING_VERTICAL_SPEED_METERS_PER_SECOND = 60
export const MAX_STARTING_HORIZONTAL_SPEED_METERS_PER_SECOND = 30
export const MAX_CONTROL_EVENTS = 1_000

export interface FlightInitialConditions {
  planetId: PlanetId
  altitudeMeters: number
  verticalSpeedMetersPerSecond: number
  horizontalSpeedMetersPerSecond: number
}

export interface FlightControls {
  throttlePercent: number
  rotationDirection: -1 | 0 | 1
}

export interface FlightControlEvent extends FlightControls {
  tick: number
}

export type FlightPhase = 'flying' | 'complete'

export type FlightReasonCode =
  | 'SAFE_TOUCHDOWN'
  | 'MARGINAL_TOUCHDOWN'
  | 'HIGH_VERTICAL_SPEED'
  | 'HIGH_HORIZONTAL_SPEED'
  | 'UNSAFE_ANGLE'
  | 'MULTIPLE_LIMITS'
  | 'FLIGHT_TIMEOUT'

export interface FlightResult {
  outcome: LandingOutcome
  reasonCode: FlightReasonCode
  touchdownVerticalSpeed: number
  touchdownHorizontalSpeed: number
  touchdownAngleDegrees: number
  fuelRemainingPercent: number
  flightTimeSeconds: number
  horizontalDistanceMeters: number
  explanation: string
}

export interface FlightState {
  tick: number
  phase: FlightPhase
  altitudeMeters: number
  horizontalPositionMeters: number
  verticalSpeedMetersPerSecond: number
  horizontalSpeedMetersPerSecond: number
  angleDegrees: number
  throttlePercent: number
  fuelPercent: number
  result: FlightResult | null
}

export interface FlightValidationIssue {
  field: keyof FlightInitialConditions | 'commands'
  message: string
}

export interface FlightRunRecord extends FlightInitialConditions, FlightResult {
  ownerId: string
  modelVersion: number
  commandsJson: string
  totalTicks: number
}

export interface LeaderboardScoreRecord extends Record<string, unknown> {
  pilotKey: string
  callsign: string
  modelVersion: number
  challengeKey: string
  planetId: PlanetId
  score: number
  touchdownVerticalSpeed: number
  touchdownHorizontalSpeed: number
  touchdownAngleDegrees: number
  fuelRemainingPercent: number
  flightTimeSeconds: number
}

export function getLeaderboardPilotKey(userId: string): string {
  const first = hashIdentifier(userId, 2166136261)
  const second = hashIdentifier(userId, 2246822507)
  return `pilot_${first}${second}`
}

export function getLeaderboardCallsign(userId: string): string {
  return `Pilot-${getLeaderboardPilotKey(userId).slice(6, 12).toUpperCase()}`
}

export function getRankedInitialConditions(planetId: PlanetId): FlightInitialConditions {
  return {
    planetId,
    altitudeMeters: 300,
    verticalSpeedMetersPerSecond: 10,
    horizontalSpeedMetersPerSecond: 8,
  }
}

export function matchesRankedInitialConditions(initial: FlightInitialConditions): boolean {
  const ranked = getRankedInitialConditions(initial.planetId)
  return initial.altitudeMeters === ranked.altitudeMeters &&
    initial.verticalSpeedMetersPerSecond === ranked.verticalSpeedMetersPerSecond &&
    initial.horizontalSpeedMetersPerSecond === ranked.horizontalSpeedMetersPerSecond
}

/**
 * Ranked flights reward a controlled touchdown, not speed. A safe flight earns
 * up to 1,000 points: descent 40%, drift 30%, attitude 20%, fuel 10%.
 */
export function calculateLandingScore(result: FlightResult): number {
  if (result.outcome !== 'SAFE_APPROACH') return 0
  const descent = quality(result.touchdownVerticalSpeed, SAFE_VERTICAL_SPEED_METERS_PER_SECOND) * 400
  const drift = quality(Math.abs(result.touchdownHorizontalSpeed), SAFE_HORIZONTAL_SPEED_METERS_PER_SECOND) * 300
  const attitude = quality(Math.abs(result.touchdownAngleDegrees), SAFE_ANGLE_DEGREES) * 200
  const fuel = clamp(result.fuelRemainingPercent, 0, 100)
  return Math.round(descent + drift + attitude + fuel)
}

export function createInitialFlightState(initial: FlightInitialConditions): FlightState {
  return {
    tick: 0,
    phase: 'flying',
    altitudeMeters: initial.altitudeMeters,
    horizontalPositionMeters: 0,
    verticalSpeedMetersPerSecond: initial.verticalSpeedMetersPerSecond,
    horizontalSpeedMetersPerSecond: initial.horizontalSpeedMetersPerSecond,
    angleDegrees: 0,
    throttlePercent: 0,
    fuelPercent: 100,
    result: null,
  }
}

export function validateInitialConditions(
  initial: FlightInitialConditions,
): FlightValidationIssue[] {
  const issues: FlightValidationIssue[] = []
  if (!isPlanetId(initial.planetId)) {
    issues.push({ field: 'planetId', message: 'must identify a supported planet' })
  }
  if (
    !Number.isFinite(initial.altitudeMeters) ||
    initial.altitudeMeters < MIN_STARTING_ALTITUDE_METERS ||
    initial.altitudeMeters > MAX_STARTING_ALTITUDE_METERS
  ) {
    issues.push({
      field: 'altitudeMeters',
      message: `must be between ${MIN_STARTING_ALTITUDE_METERS} and ${MAX_STARTING_ALTITUDE_METERS}`,
    })
  }
  if (
    !Number.isFinite(initial.verticalSpeedMetersPerSecond) ||
    initial.verticalSpeedMetersPerSecond < 0 ||
    initial.verticalSpeedMetersPerSecond > MAX_STARTING_VERTICAL_SPEED_METERS_PER_SECOND
  ) {
    issues.push({
      field: 'verticalSpeedMetersPerSecond',
      message: `must be between 0 and ${MAX_STARTING_VERTICAL_SPEED_METERS_PER_SECOND}`,
    })
  }
  if (
    !Number.isFinite(initial.horizontalSpeedMetersPerSecond) ||
    Math.abs(initial.horizontalSpeedMetersPerSecond) >
      MAX_STARTING_HORIZONTAL_SPEED_METERS_PER_SECOND
  ) {
    issues.push({
      field: 'horizontalSpeedMetersPerSecond',
      message: `must be between -${MAX_STARTING_HORIZONTAL_SPEED_METERS_PER_SECOND} and ${MAX_STARTING_HORIZONTAL_SPEED_METERS_PER_SECOND}`,
    })
  }
  return issues
}

export function validateControlEvents(commands: FlightControlEvent[]): FlightValidationIssue[] {
  if (!Array.isArray(commands) || commands.length === 0 || commands.length > MAX_CONTROL_EVENTS) {
    return [{ field: 'commands', message: `must contain between 1 and ${MAX_CONTROL_EVENTS} control events` }]
  }

  let previousTick = -1
  for (const command of commands) {
    if (
      !Number.isInteger(command.tick) ||
      command.tick < 0 ||
      command.tick > MAX_FLIGHT_TICKS ||
      command.tick < previousTick ||
      !Number.isFinite(command.throttlePercent) ||
      command.throttlePercent < 0 ||
      command.throttlePercent > 100 ||
      ![-1, 0, 1].includes(command.rotationDirection)
    ) {
      return [{ field: 'commands', message: 'contains an invalid or out-of-order control event' }]
    }
    previousTick = command.tick
  }
  return []
}

export function stepFlight(
  state: FlightState,
  controls: FlightControls,
  planetGravity: number,
): FlightState {
  if (state.phase !== 'flying') return state

  const throttlePercent = clamp(controls.throttlePercent, 0, 100)
  const rotationDirection = normalizeRotationDirection(controls.rotationDirection)
  const nextAngle = clamp(
    state.angleDegrees +
      rotationDirection * ROTATION_RATE_DEGREES_PER_SECOND * FLIGHT_TIME_STEP_SECONDS,
    -MAX_ROTATION_DEGREES,
    MAX_ROTATION_DEGREES,
  )
  const availableThrottle = state.fuelPercent > 0 ? throttlePercent : 0
  const thrustAcceleration =
    MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED * (availableThrottle / 100)
  const angleRadians = nextAngle * (Math.PI / 180)
  const verticalAcceleration = planetGravity - thrustAcceleration * Math.cos(angleRadians)
  const horizontalAcceleration = thrustAcceleration * Math.sin(angleRadians)
  const nextVerticalSpeed =
    state.verticalSpeedMetersPerSecond + verticalAcceleration * FLIGHT_TIME_STEP_SECONDS
  const nextHorizontalSpeed =
    state.horizontalSpeedMetersPerSecond + horizontalAcceleration * FLIGHT_TIME_STEP_SECONDS
  const nextAltitude =
    state.altitudeMeters - nextVerticalSpeed * FLIGHT_TIME_STEP_SECONDS
  const nextHorizontalPosition =
    state.horizontalPositionMeters + nextHorizontalSpeed * FLIGHT_TIME_STEP_SECONDS
  const nextFuel = Math.max(
    0,
    state.fuelPercent -
      (availableThrottle / 100) *
        FUEL_BURN_PERCENT_PER_SECOND_AT_FULL_POWER *
        FLIGHT_TIME_STEP_SECONDS,
  )
  const nextTick = state.tick + 1

  const stepped: FlightState = {
    tick: nextTick,
    phase: 'flying',
    altitudeMeters: nextAltitude,
    horizontalPositionMeters: nextHorizontalPosition,
    verticalSpeedMetersPerSecond: nextVerticalSpeed,
    horizontalSpeedMetersPerSecond: nextHorizontalSpeed,
    angleDegrees: nextAngle,
    throttlePercent: availableThrottle,
    fuelPercent: nextFuel,
    result: null,
  }

  if (nextAltitude <= 0) {
    return {
      ...stepped,
      phase: 'complete',
      altitudeMeters: 0,
      result: evaluateTouchdown(stepped),
    }
  }

  if (nextTick >= MAX_FLIGHT_TICKS) {
    return {
      ...stepped,
      phase: 'complete',
      result: {
        outcome: 'CRASH_LIKELY',
        reasonCode: 'FLIGHT_TIMEOUT',
        touchdownVerticalSpeed: nextVerticalSpeed,
        touchdownHorizontalSpeed: nextHorizontalSpeed,
        touchdownAngleDegrees: nextAngle,
        fuelRemainingPercent: nextFuel,
        flightTimeSeconds: nextTick / FLIGHT_TICKS_PER_SECOND,
        horizontalDistanceMeters: nextHorizontalPosition,
        explanation: 'The flight exceeded the two-minute simulation limit before touchdown.',
      },
    }
  }

  return stepped
}

export function evaluateTouchdown(state: FlightState): FlightResult {
  const vertical = Math.max(0, state.verticalSpeedMetersPerSecond)
  const horizontal = Math.abs(state.horizontalSpeedMetersPerSecond)
  const angle = Math.abs(state.angleDegrees)
  const safe =
    vertical <= SAFE_VERTICAL_SPEED_METERS_PER_SECOND &&
    horizontal <= SAFE_HORIZONTAL_SPEED_METERS_PER_SECOND &&
    angle <= SAFE_ANGLE_DEGREES
  const marginal =
    vertical <= MARGINAL_VERTICAL_SPEED_METERS_PER_SECOND &&
    horizontal <= MARGINAL_HORIZONTAL_SPEED_METERS_PER_SECOND &&
    angle <= MARGINAL_ANGLE_DEGREES

  const failures = [
    vertical > MARGINAL_VERTICAL_SPEED_METERS_PER_SECOND ? 'vertical speed' : null,
    horizontal > MARGINAL_HORIZONTAL_SPEED_METERS_PER_SECOND ? 'horizontal speed' : null,
    angle > MARGINAL_ANGLE_DEGREES ? 'landing angle' : null,
  ].filter((value): value is string => value !== null)

  let outcome: LandingOutcome
  let reasonCode: FlightReasonCode
  let explanation: string
  if (safe) {
    outcome = 'SAFE_APPROACH'
    reasonCode = 'SAFE_TOUCHDOWN'
    explanation = `Touchdown secured at ${format(vertical)} m/s vertical and ${format(horizontal)} m/s horizontal.`
  } else if (marginal) {
    outcome = 'MARGINAL'
    reasonCode = 'MARGINAL_TOUCHDOWN'
    explanation = 'The craft reached the surface intact, but at least one touchdown margin was narrow.'
  } else {
    outcome = 'CRASH_LIKELY'
    reasonCode =
      failures.length > 1
        ? 'MULTIPLE_LIMITS'
        : failures[0] === 'vertical speed'
          ? 'HIGH_VERTICAL_SPEED'
          : failures[0] === 'horizontal speed'
            ? 'HIGH_HORIZONTAL_SPEED'
            : 'UNSAFE_ANGLE'
    explanation = `Surface impact exceeded the ${failures.join(' and ')} limit${failures.length > 1 ? 's' : ''}.`
  }

  return {
    outcome,
    reasonCode,
    touchdownVerticalSpeed: vertical,
    touchdownHorizontalSpeed: state.horizontalSpeedMetersPerSecond,
    touchdownAngleDegrees: state.angleDegrees,
    fuelRemainingPercent: state.fuelPercent,
    flightTimeSeconds: state.tick / FLIGHT_TICKS_PER_SECOND,
    horizontalDistanceMeters: state.horizontalPositionMeters,
    explanation,
  }
}

export function replayFlight(
  initial: FlightInitialConditions,
  commands: FlightControlEvent[],
): FlightState {
  const planet = getPlanet(initial.planetId)
  let state = createInitialFlightState(initial)
  let controls: FlightControls = { throttlePercent: 0, rotationDirection: 0 }
  let commandIndex = 0

  while (state.phase === 'flying') {
    while (commands[commandIndex]?.tick === state.tick) {
      controls = {
        throttlePercent: commands[commandIndex].throttlePercent,
        rotationDirection: commands[commandIndex].rotationDirection,
      }
      commandIndex += 1
    }
    state = stepFlight(state, controls, planet.gravity)
  }

  return state
}

export function appendControlEvent(
  commands: FlightControlEvent[],
  event: FlightControlEvent,
): FlightControlEvent[] {
  const previous = commands[commands.length - 1]
  if (previous?.tick === event.tick) return [...commands.slice(0, -1), event]
  if (
    previous &&
    previous.throttlePercent === event.throttlePercent &&
    previous.rotationDirection === event.rotationDirection
  ) {
    return commands
  }
  return [...commands, event]
}

function normalizeRotationDirection(value: number): -1 | 0 | 1 {
  if (value < 0) return -1
  if (value > 0) return 1
  return 0
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function quality(value: number, safeLimit: number): number {
  return clamp(1 - value / safeLimit, 0, 1)
}

function hashIdentifier(value: string, seed: number): string {
  let hash = seed
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function format(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
}
