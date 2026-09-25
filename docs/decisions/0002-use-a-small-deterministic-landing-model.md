# ADR 0002: Use a small deterministic landing model

- **Status:** Accepted
- **Date:** 2026-09-25

## Decision

Use a deterministic vertical-motion model with constant engine power and tilt. The model subtracts planetary gravity from the vertical component of a 35 m/s² maximum engine acceleration, calculates stopping distance, and compares that distance with the starting altitude. A safe approach must use no more than 70% of the available altitude. Results are `SAFE_APPROACH`, `MARGINAL`, or `CRASH_LIKELY` with a specific reason code.

The model excludes atmosphere, fuel consumption, changing mass, horizontal velocity, terrain, and control changes during descent.

## Alternatives considered

- A high-fidelity time-stepped physics simulation.
- Simple hand-authored thresholds for each input.
- A client-only calculation with no shared domain model.
- An AI-generated judgment or explanation.

## Rationale

The equations are small enough to explain at a whiteboard, deterministic enough to test, and deep enough to connect player choices to a physical result. Named constants and reason codes make assumptions visible. The 70% stopping budget distinguishes a comfortable landing from one that technically stops but leaves little margin.

## Tradeoffs

- The result is educational rather than a realistic spacecraft simulation.
- Ignoring atmosphere makes Venus, Earth, and the gas giants especially simplified.
- Constant inputs do not model piloting during descent.
- The 35 m/s² engine and 70% safety margin are product assumptions, not vehicle specifications.

## Consequences

- The interface and documentation must label the model as simplified.
- Gas-giant results refer to a fictional cloud-top platform.
- Tests should cover outcome boundaries and the same telemetry under different gravity.
- Any change to the equations or thresholds must increment `LANDING_MODEL_VERSION` and receive a new ADR that supersedes this one.
