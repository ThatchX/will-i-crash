import type { CollectionSchema } from 'deepspace/schema'

const planetOptions = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']

export const leaderboardScoresSchema: CollectionSchema = {
  name: 'leaderboard-scores',
  columns: [
    { name: 'pilotKey', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'callsign', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'modelVersion', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'challengeKey', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'planetId', storage: 'text', interpretation: { kind: 'select', options: planetOptions }, required: true, immutable: true },
    { name: 'score', storage: 'number', interpretation: 'plain', required: true },
    { name: 'touchdownVerticalSpeed', storage: 'number', interpretation: 'plain', required: true },
    { name: 'touchdownHorizontalSpeed', storage: 'number', interpretation: 'plain', required: true },
    { name: 'touchdownAngleDegrees', storage: 'number', interpretation: 'plain', required: true },
    { name: 'fuelRemainingPercent', storage: 'number', interpretation: 'plain', required: true },
    { name: 'flightTimeSeconds', storage: 'number', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['pilotKey', 'modelVersion', 'challengeKey', 'planetId'],
  permissions: {
    '*': { read: true, create: false, update: false, delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: true, delete: true },
  },
}
