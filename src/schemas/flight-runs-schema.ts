import type { CollectionSchema } from 'deepspace/schema'

export const flightRunsSchema: CollectionSchema = {
  name: 'flight-runs',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
    { name: 'modelVersion', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'planetId',
      storage: 'text',
      interpretation: {
        kind: 'select',
        options: ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'],
      },
      required: true,
      immutable: true,
    },
    { name: 'altitudeMeters', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'verticalSpeedMetersPerSecond', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'horizontalSpeedMetersPerSecond', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'commandsJson', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'totalTicks', storage: 'number', interpretation: 'plain', required: true, immutable: true },
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
        options: [
          'SAFE_TOUCHDOWN',
          'MARGINAL_TOUCHDOWN',
          'HIGH_VERTICAL_SPEED',
          'HIGH_HORIZONTAL_SPEED',
          'UNSAFE_ANGLE',
          'MULTIPLE_LIMITS',
          'FLIGHT_TIMEOUT',
        ],
      },
      required: true,
      immutable: true,
    },
    { name: 'touchdownVerticalSpeed', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'touchdownHorizontalSpeed', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'touchdownAngleDegrees', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'fuelRemainingPercent', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'flightTimeSeconds', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'horizontalDistanceMeters', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'explanation', storage: 'text', interpretation: 'plain', required: true, immutable: true },
  ],
  ownerField: 'ownerId',
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: 'own' },
    member: { read: 'own', create: false, update: false, delete: 'own' },
    admin: { read: true, create: false, update: false, delete: true },
  },
}
