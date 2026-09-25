# ADR 0008: Use only integrations that serve the core loop

- **Status:** Accepted
- **Date:** 2026-09-25

## Decision

Use DeepSpace authentication, server actions, private records, and realtime synchronization because each supports the core descent loop. Defer messaging, AI, shared rooms, alerts, and other integrations until they solve a specific user problem.

## Alternatives considered

- Add at least three visibly separate integrations regardless of product fit.
- Add an AI flight instructor in the first version.
- Add social messaging or shared mission rooms immediately.
- Avoid platform features and keep the application entirely local.

## Rationale

The build exercise rewards judgment and useful platform understanding rather than integration count. The chosen features form one coherent flow: identify the pilot, evaluate on the server, persist a trusted attempt, and synchronize the flight log. Adding integrations without a clear role would increase the explanation and testing burden without strengthening the product.

## Tradeoffs

- The app demonstrates fewer parts of the platform.
- There is no collaborative or AI-assisted experience yet.
- Future integrations may require changes to permissions, data shape, and interface scope.

## Consequences

- Every proposed integration should name the user problem and the exact point where it improves the experience.
- Shared instructor rooms, alerts, and an AI flight instructor remain V3 candidates.
- Adding one of those features requires its own ADR covering value, data access, failure behavior, and cost.
