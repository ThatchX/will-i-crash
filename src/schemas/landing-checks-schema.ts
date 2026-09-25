import type { CollectionSchema } from 'deepspace/schema'

export const landingChecksSchema: CollectionSchema = {
  name: 'landing-checks',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
    { name: 'modelVersion', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'heightMeters', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'descentSpeedMetersPerSecond', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'enginePowerPercent', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'tiltDegrees', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'outcome',
      storage: 'text',
      interpretation: { kind: 'select', options: ['SAFE_APPROACH', 'MARGINAL', 'CRASH_LIKELY'] },
      required: true,
      immutable: true,
    },
    {
      name: 'reasonCode',
      storage: 'text',
      interpretation: {
        kind: 'select',
        options: ['SAFE_MARGIN', 'LOW_MARGIN', 'INSUFFICIENT_BRAKING', 'INSUFFICIENT_ALTITUDE'],
      },
      required: true,
      immutable: true,
    },
    { name: 'verticalEngineAcceleration', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'netBrakingAcceleration', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'stoppingDistanceMeters', storage: 'number', interpretation: 'plain', immutable: true },
    { name: 'altitudeMarginMeters', storage: 'number', interpretation: 'plain', immutable: true },
    { name: 'requiredThrottlePercent', storage: 'number', interpretation: 'plain', immutable: true },
    { name: 'stoppingRatio', storage: 'number', interpretation: 'plain', immutable: true },
    { name: 'explanation', storage: 'text', interpretation: 'plain', required: true, immutable: true },
  ],
  ownerField: 'ownerId',
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: 'own' },
    member: { read: 'own', create: false, update: false, delete: 'own' },
    admin: { read: true, create: false, update: false, delete: true },
  },
}
