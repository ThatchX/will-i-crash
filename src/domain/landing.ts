export const MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED = 35
export const SAFE_STOPPING_RATIO = 0.7
export const LANDING_MODEL_VERSION = 2

export const MAX_HEIGHT_METERS = 10_000
export const MAX_DESCENT_SPEED_METERS_PER_SECOND = 500

export const PLANETS = [
  { id: 'mercury', name: 'Mercury', gravity: 3.7, surfaceKind: 'surface' },
  { id: 'venus', name: 'Venus', gravity: 8.87, surfaceKind: 'surface' },
  { id: 'earth', name: 'Earth', gravity: 9.81, surfaceKind: 'surface' },
  { id: 'mars', name: 'Mars', gravity: 3.71, surfaceKind: 'surface' },
  { id: 'jupiter', name: 'Jupiter', gravity: 24.79, surfaceKind: 'cloud deck' },
  { id: 'saturn', name: 'Saturn', gravity: 10.44, surfaceKind: 'cloud deck' },
  { id: 'uranus', name: 'Uranus', gravity: 8.69, surfaceKind: 'cloud deck' },
  { id: 'neptune', name: 'Neptune', gravity: 11.15, surfaceKind: 'cloud deck' },
] as const

export type PlanetId = (typeof PLANETS)[number]['id']
export type PlanetConfig = (typeof PLANETS)[number]

export interface LandingTelemetry {
  planetId: PlanetId
  heightMeters: number
  descentSpeedMetersPerSecond: number
  enginePowerPercent: number
  tiltDegrees: number
}

export type LandingOutcome = 'SAFE_APPROACH' | 'MARGINAL' | 'CRASH_LIKELY'

export type LandingReasonCode =
  | 'SAFE_MARGIN'
  | 'LOW_MARGIN'
  | 'INSUFFICIENT_BRAKING'
  | 'INSUFFICIENT_ALTITUDE'

export interface LandingAssessment {
  outcome: LandingOutcome
  reasonCode: LandingReasonCode
  planetGravity: number
  verticalEngineAcceleration: number
  netBrakingAcceleration: number
  stoppingDistanceMeters: number | null
  altitudeMarginMeters: number | null
  requiredThrottlePercent: number | null
  powerAboveMinimumPercent: number | null
  stoppingRatio: number | null
  explanation: string
}

export type LandingCheckResult =
  | { valid: true; assessment: LandingAssessment }
  | { valid: false; issues: LandingValidationIssue[] }

export interface LandingCheckRecord extends LandingTelemetry, LandingAssessment {
  ownerId: string
  modelVersion: number
}

export interface LandingValidationIssue {
  field: keyof LandingTelemetry
  value: number | string
  message: string
}

export function isPlanetId(value: unknown): value is PlanetId {
  return typeof value === 'string' && PLANETS.some((planet) => planet.id === value)
}

export function getPlanet(planetId: PlanetId): PlanetConfig {
  return PLANETS.find((planet) => planet.id === planetId) ?? PLANETS[2]
}

export function validateLandingTelemetry(
  telemetry: LandingTelemetry,
): LandingValidationIssue[] {
  const issues: LandingValidationIssue[] = []

  if (!isPlanetId(telemetry.planetId)) {
    issues.push({
      field: 'planetId',
      value: telemetry.planetId,
      message: 'must identify a supported planet',
    })
  }

  if (!Number.isFinite(telemetry.heightMeters)) {
    issues.push({
      field: 'heightMeters',
      value: telemetry.heightMeters,
      message: 'must be a finite number',
    })
  } else if (telemetry.heightMeters <= 0 || telemetry.heightMeters > MAX_HEIGHT_METERS) {
    issues.push({
      field: 'heightMeters',
      value: telemetry.heightMeters,
      message: 'must be greater than 0 and at most 10,000',
    })
  }

  if (!Number.isFinite(telemetry.descentSpeedMetersPerSecond)) {
    issues.push({
      field: 'descentSpeedMetersPerSecond',
      value: telemetry.descentSpeedMetersPerSecond,
      message: 'must be a finite number',
    })
  } else if (
    telemetry.descentSpeedMetersPerSecond < 0 ||
    telemetry.descentSpeedMetersPerSecond > MAX_DESCENT_SPEED_METERS_PER_SECOND
  ) {
    issues.push({
      field: 'descentSpeedMetersPerSecond',
      value: telemetry.descentSpeedMetersPerSecond,
      message: 'must be between 0 and 500',
    })
  }

  if (!Number.isFinite(telemetry.enginePowerPercent)) {
    issues.push({
      field: 'enginePowerPercent',
      value: telemetry.enginePowerPercent,
      message: 'must be a finite number',
    })
  } else if (telemetry.enginePowerPercent < 0 || telemetry.enginePowerPercent > 100) {
    issues.push({
      field: 'enginePowerPercent',
      value: telemetry.enginePowerPercent,
      message: 'must be between 0 and 100',
    })
  }

  if (!Number.isFinite(telemetry.tiltDegrees)) {
    issues.push({
      field: 'tiltDegrees',
      value: telemetry.tiltDegrees,
      message: 'must be a finite number',
    })
  } else if (telemetry.tiltDegrees < 0 || telemetry.tiltDegrees > 90) {
    issues.push({
      field: 'tiltDegrees',
      value: telemetry.tiltDegrees,
      message: 'must be between 0 and 90',
    })
  }

  return issues
}

/**
 * Evaluate a powered planetary descent with a small, explainable model.
 * It assumes constant throttle and tilt, no atmosphere, and no horizontal
 * motion. Gas giants use a fictional cloud-top reference platform.
 */
export function assessLanding(telemetry: LandingTelemetry): LandingCheckResult {
  const issues = validateLandingTelemetry(telemetry)
  if (issues.length > 0) return { valid: false, issues }

  const planet = getPlanet(telemetry.planetId)
  const tiltRadians = telemetry.tiltDegrees * (Math.PI / 180)
  const cosine = Math.abs(Math.cos(tiltRadians)) < 1e-10 ? 0 : Math.cos(tiltRadians)
  const verticalEffectiveness =
    MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED * cosine
  const verticalEngineAcceleration =
    verticalEffectiveness * (telemetry.enginePowerPercent / 100)
  const netBrakingAcceleration = verticalEngineAcceleration - planet.gravity
  const brakingNeededForSafeStop =
    telemetry.descentSpeedMetersPerSecond ** 2 /
    (2 * SAFE_STOPPING_RATIO * telemetry.heightMeters)
  const requiredThrottlePercent =
    verticalEffectiveness > 0
      ? ((planet.gravity + brakingNeededForSafeStop) / verticalEffectiveness) * 100
      : null
  const powerAboveMinimumPercent =
    requiredThrottlePercent === null
      ? null
      : telemetry.enginePowerPercent - requiredThrottlePercent

  const baseAssessment = {
    planetGravity: planet.gravity,
    verticalEngineAcceleration,
    netBrakingAcceleration,
    requiredThrottlePercent,
    powerAboveMinimumPercent,
  }

  if (netBrakingAcceleration <= 0) {
    return {
      valid: true,
      assessment: {
        ...baseAssessment,
        outcome: 'CRASH_LIKELY',
        reasonCode: 'INSUFFICIENT_BRAKING',
        stoppingDistanceMeters: null,
        altitudeMarginMeters: null,
        stoppingRatio: null,
        explanation: `At this power and tilt, the lander cannot overcome ${planet.name}'s gravity.`,
      },
    }
  }

  const stoppingDistanceMeters =
    telemetry.descentSpeedMetersPerSecond ** 2 / (2 * netBrakingAcceleration)
  const altitudeMarginMeters = telemetry.heightMeters - stoppingDistanceMeters
  const stoppingRatio = stoppingDistanceMeters / telemetry.heightMeters

  if (stoppingDistanceMeters >= telemetry.heightMeters) {
    return {
      valid: true,
      assessment: {
        ...baseAssessment,
        outcome: 'CRASH_LIKELY',
        reasonCode: 'INSUFFICIENT_ALTITUDE',
        stoppingDistanceMeters,
        altitudeMarginMeters,
        stoppingRatio,
        explanation: `The lander needs ${roundForCopy(stoppingDistanceMeters)} meters to stop but has only ${roundForCopy(telemetry.heightMeters)} meters.`,
      },
    }
  }

  if (stoppingRatio > SAFE_STOPPING_RATIO + 1e-12) {
    return {
      valid: true,
      assessment: {
        ...baseAssessment,
        outcome: 'MARGINAL',
        reasonCode: 'LOW_MARGIN',
        stoppingDistanceMeters,
        altitudeMarginMeters,
        stoppingRatio,
        explanation: `The lander stops above ${planet.name}, but uses more than 70% of its available altitude.`,
      },
    }
  }

  return {
    valid: true,
    assessment: {
      ...baseAssessment,
      outcome: 'SAFE_APPROACH',
      reasonCode: 'SAFE_MARGIN',
      stoppingDistanceMeters,
      altitudeMarginMeters,
      stoppingRatio,
      explanation: `Landing secured with ${roundForCopy(altitudeMarginMeters)} meters of altitude remaining.`,
    },
  }
}

function roundForCopy(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
}
