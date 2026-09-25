import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  assessLanding,
  isPlanetId,
  LANDING_MODEL_VERSION,
  type LandingCheckRecord,
  type LandingTelemetry,
} from '../domain/landing'

const assessLandingAction: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const telemetry: LandingTelemetry = {
    planetId: isPlanetId(params.planetId) ? params.planetId : ('unknown' as LandingTelemetry['planetId']),
    heightMeters: numberParam(params.heightMeters),
    descentSpeedMetersPerSecond: numberParam(params.descentSpeedMetersPerSecond),
    enginePowerPercent: numberParam(params.enginePowerPercent),
    tiltDegrees: numberParam(params.tiltDegrees),
  }
  const result = assessLanding(telemetry)

  if (!result.valid) {
    return {
      success: false,
      error: 'Invalid landing telemetry.',
      code: 'validation_failed',
      issues: result.issues.map((issue) => ({
        path: [issue.field],
        message: issue.message,
      })),
    }
  }

  const assessment = result.assessment
  const record: LandingCheckRecord = {
    ownerId: userId,
    modelVersion: LANDING_MODEL_VERSION,
    ...telemetry,
    ...assessment,
  }

  const storedRecord = {
    ...record,
    stoppingDistanceMeters: assessment.stoppingDistanceMeters ?? undefined,
    altitudeMarginMeters: assessment.altitudeMarginMeters ?? undefined,
    requiredThrottlePercent: assessment.requiredThrottlePercent ?? undefined,
    powerAboveMinimumPercent: assessment.powerAboveMinimumPercent ?? undefined,
    stoppingRatio: assessment.stoppingRatio ?? undefined,
  }
  const created = await tools.create<Record<string, unknown>>('descent-attempts', {
    ...storedRecord,
  })
  if (!created.success) return created

  return {
    success: true,
    data: {
      recordId: created.data.recordId,
      assessment,
    },
  }
}

function numberParam(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN
}

export const actions: Record<string, ActionHandler<Env>> = {
  runDescent: assessLandingAction,
}
