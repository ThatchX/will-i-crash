# ADR 0009: Animate every descent to the surface

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** None
- **Superseded by:** None

## Decision

Animate the craft from its visible starting position all the way to the reference surface for every completed run. A safe or marginal result represents braking followed by a controlled final approach; a crash result ends at the same surface position with an impact effect. The surface remains fixed.

## Alternatives considered

- Move the craft only by a distance proportional to its calculated stopping ratio.
- Stop safe attempts above the surface at their calculated stopping distance.
- Move the surface toward a stationary craft.
- Build a time-stepped animation directly from the model equations.

## Rationale

The player initiates a landing, so the visible action should have a clear beginning and end. Stopping the animation partway through the stage reads as an unfinished run, even when the result is safe. Carrying the craft to the surface makes the outcome legible while the result panel continues to explain the calculated stopping distance and safety margin.

## Tradeoffs

- The final segment of a safe descent is illustrative rather than calculated by the constant-power model.
- All runs share the same animation duration despite different altitudes and speeds.
- The animation cannot be used to measure the reported stopping distance.

## Consequences

- The craft's feet must finish at the surface boundary at every responsive stage height.
- Outcome-specific effects happen at touchdown; crashes show an impact effect while safe and marginal runs do not.
- The stopping-distance calculation remains unchanged and authoritative.
- A future physically timed animation would require a new model and a superseding ADR.
