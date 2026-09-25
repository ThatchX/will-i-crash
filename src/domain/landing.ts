export const LUNAR_GRAVITY_METERS_PER_SECOND_SQUARED = 1.62
export const MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED = 5
export const SAFE_STOPPING_RATIO = 0.7
export const LANDING_MODEL_VERSION = 1

export const MAX_HEIGHT_METERS = 10_000
export const MAX_DESCENT_SPEED_METERS_PER_SECOND = 500

export interface LandingTelemetry {
  heightMeters: number
  descentSpeedMetersPerSecond: number
  enginePowerPercent: number
  tiltDegrees: number
}

export type LandingOutcome =
  | 'SAFE_APPROACH'
  | 'MARGINAL'
  | 'CRASH_LIKELY'

export type LandingReasonCode =
  | 'SAFE_MARGIN'
  | 'LOW_MARGIN'
  | 'INSUFFICIENT_BRAKING'
  | 'INSUFFICIENT_ALTITUDE'

export interface LandingAssessment {
  outcome: LandingOutcome
  reasonCode: LandingReasonCode
  verticalEngineAcceleration: number
  netBrakingAcceleration: number
  stoppingDistanceMeters: number | null
  altitudeMarginMeters: number | null
  requiredThrottlePercent: number | null
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
  value: number
  message: string
}

export function validateLandingTelemetry(
  telemetry: LandingTelemetry,
): LandingValidationIssue[] {
  const issues: LandingValidationIssue[] = []

  if (!Number.isFinite(telemetry.heightMeters)) {
    issues.push({
      field: 'heightMeters',
      value: telemetry.heightMeters,
      message: 'must be a finite number',
    })
  } else if (
    telemetry.heightMeters <= 0 ||
    telemetry.heightMeters > MAX_HEIGHT_METERS
  ) {
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
    telemetry.descentSpeedMetersPerSecond >
      MAX_DESCENT_SPEED_METERS_PER_SECOND
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
  } else if (
    telemetry.enginePowerPercent < 0 ||
    telemetry.enginePowerPercent > 100
  ) {
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
  } else if (
    telemetry.tiltDegrees < 0 ||
    telemetry.tiltDegrees > 90
  ) {
    issues.push({
      field: 'tiltDegrees',
      value: telemetry.tiltDegrees,
      message: 'must be between 0 and 90',
    })
  }

  return issues
}

/**
 * Evaluate a powered lunar descent with a deliberately small, explainable
 * model. This is a screening exercise, not flight software: it assumes
 * constant throttle, constant tilt, no atmosphere, and no horizontal motion.
 */
export function assessLanding(telemetry: LandingTelemetry): LandingCheckResult {
  const issues = validateLandingTelemetry(telemetry)
  if (issues.length > 0) return { valid: false, issues }

  const tiltRadians = telemetry.tiltDegrees * (Math.PI / 180)
  const verticalEngineAcceleration =
    MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED *
    (telemetry.enginePowerPercent / 100) *
    Math.cos(tiltRadians)
  const netBrakingAcceleration =
    verticalEngineAcceleration - LUNAR_GRAVITY_METERS_PER_SECOND_SQUARED
  const verticalEffectiveness =
    MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED * Math.cos(tiltRadians)
  const requiredThrottlePercent =
    verticalEffectiveness > 0
      ? (LUNAR_GRAVITY_METERS_PER_SECOND_SQUARED / verticalEffectiveness) * 100
      : null

  if (netBrakingAcceleration <= 0) {
    return {
      valid: true,
      assessment: {
        outcome: 'CRASH_LIKELY',
        reasonCode: 'INSUFFICIENT_BRAKING',
        verticalEngineAcceleration,
        netBrakingAcceleration,
        stoppingDistanceMeters: null,
        altitudeMarginMeters: null,
        requiredThrottlePercent,
        stoppingRatio: null,
        explanation:
          'The engine does not produce enough vertical acceleration to overcome lunar gravity at this power and tilt.',
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
        outcome: 'CRASH_LIKELY',
        reasonCode: 'INSUFFICIENT_ALTITUDE',
        verticalEngineAcceleration,
        netBrakingAcceleration,
        stoppingDistanceMeters,
        altitudeMarginMeters,
        requiredThrottlePercent,
        stoppingRatio,
        explanation:
          'The estimated stopping distance uses all available altitude or more.',
      },
    }
  }

  if (stoppingRatio > SAFE_STOPPING_RATIO) {
    return {
      valid: true,
      assessment: {
        outcome: 'MARGINAL',
        reasonCode: 'LOW_MARGIN',
        verticalEngineAcceleration,
        netBrakingAcceleration,
        stoppingDistanceMeters,
        altitudeMarginMeters,
        requiredThrottlePercent,
        stoppingRatio,
        explanation:
          'The craft can stop in this model, but the maneuver would use more than 70% of the available altitude.',
      },
    }
  }

  return {
    valid: true,
    assessment: {
      outcome: 'SAFE_APPROACH',
      reasonCode: 'SAFE_MARGIN',
      verticalEngineAcceleration,
      netBrakingAcceleration,
      stoppingDistanceMeters,
      altitudeMarginMeters,
      requiredThrottlePercent,
      stoppingRatio,
      explanation:
        'The estimated stopping distance stays within 70% of the available altitude.',
    },
  }
}
