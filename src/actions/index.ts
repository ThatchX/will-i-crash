import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  assessLanding,
  isPlanetId,
  LANDING_MODEL_VERSION,
  type LandingCheckRecord,
  type LandingTelemetry,
} from '../domain/landing'
import {
  FLIGHT_MODEL_VERSION,
  replayFlight,
  validateControlEvents,
  validateInitialConditions,
  type FlightControlEvent,
  type FlightInitialConditions,
  type FlightRunRecord,
} from '../domain/flight'

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

const completeFlightAction: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const initial = parseInitialConditions(params.initial)
  const commands = parseControlEvents(params.commands)
  const issues = [
    ...validateInitialConditions(initial),
    ...validateControlEvents(commands),
  ]

  if (issues.length > 0) {
    return {
      success: false,
      error: 'Invalid flight data.',
      code: 'validation_failed',
      issues: issues.map((issue) => ({ path: [issue.field], message: issue.message })),
    }
  }

  const finalState = replayFlight(initial, commands)
  if (!finalState.result) {
    return { success: false, error: 'The flight did not produce a result.', code: 'replay_failed' }
  }

  const record: FlightRunRecord = {
    ownerId: userId,
    modelVersion: FLIGHT_MODEL_VERSION,
    ...initial,
    commandsJson: JSON.stringify(commands),
    totalTicks: finalState.tick,
    ...finalState.result,
  }
  const created = await tools.create<Record<string, unknown>>('flight-runs', { ...record })
  if (!created.success) return created

  return {
    success: true,
    data: {
      recordId: created.data.recordId,
      result: finalState.result,
      totalTicks: finalState.tick,
    },
  }
}

function numberParam(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN
}

function parseInitialConditions(value: unknown): FlightInitialConditions {
  const input = isObject(value) ? value : {}
  return {
    planetId: isPlanetId(input.planetId)
      ? input.planetId
      : ('unknown' as FlightInitialConditions['planetId']),
    altitudeMeters: numberParam(input.altitudeMeters),
    verticalSpeedMetersPerSecond: numberParam(input.verticalSpeedMetersPerSecond),
    horizontalSpeedMetersPerSecond: numberParam(input.horizontalSpeedMetersPerSecond),
  }
}

function parseControlEvents(value: unknown): FlightControlEvent[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    const command = isObject(entry) ? entry : {}
    return {
      tick: numberParam(command.tick),
      throttlePercent: numberParam(command.throttlePercent),
      rotationDirection: numberParam(command.rotationDirection) as -1 | 0 | 1,
    }
  })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const actions: Record<string, ActionHandler<Env>> = {
  runDescent: assessLandingAction,
  completeFlight: completeFlightAction,
}
