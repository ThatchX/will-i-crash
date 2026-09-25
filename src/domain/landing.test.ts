import { describe, expect, it } from 'vitest'
import {
  assessLanding,
  SAFE_STOPPING_RATIO,
  type LandingTelemetry,
} from './landing'

const baseline: LandingTelemetry = {
  heightMeters: 100,
  descentSpeedMetersPerSecond: 10,
  enginePowerPercent: 100,
  tiltDegrees: 0,
}

function assessmentFor(telemetry: LandingTelemetry) {
  const result = assessLanding(telemetry)
  expect(result.valid).toBe(true)
  if (!result.valid) throw new Error('Expected valid telemetry')
  return result.assessment
}

describe('assessLanding', () => {
  it('classifies a descent with ample stopping room as safe', () => {
    const assessment = assessmentFor(baseline)
    expect(assessment.outcome).toBe('SAFE_APPROACH')
    expect(assessment.stoppingDistanceMeters).toBeCloseTo(14.7929, 4)
  })

  it('classifies a stoppable descent with little margin as marginal', () => {
    expect(assessmentFor({ ...baseline, heightMeters: 20 }).outcome).toBe('MARGINAL')
  })

  it('classifies a descent that needs all available altitude as crash likely', () => {
    expect(assessmentFor({ ...baseline, heightMeters: 10 }).outcome).toBe('CRASH_LIKELY')
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
    const heightMeters = stoppingDistance / SAFE_STOPPING_RATIO
    expect(assessmentFor({ ...baseline, heightMeters }).outcome).toBe('SAFE_APPROACH')
  })

  it('rejects impossible or non-finite telemetry without assessing it', () => {
    const result = assessLanding({
      heightMeters: 0,
      descentSpeedMetersPerSecond: Number.NaN,
      enginePowerPercent: 101,
      tiltDegrees: -1,
    })
    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('Expected invalid telemetry')
    expect(result.issues.map((issue) => issue.field)).toEqual([
      'heightMeters',
      'descentSpeedMetersPerSecond',
      'enginePowerPercent',
      'tiltDegrees',
    ])
  })

  it('accepts zero throttle as valid but dangerous telemetry', () => {
    expect(assessmentFor({ ...baseline, enginePowerPercent: 0 }).outcome).toBe(
      'CRASH_LIKELY',
    )
  })
})
