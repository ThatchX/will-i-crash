# ADR 0013: Use an explicit touchdown envelope

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** None
- **Superseded by:** None

## Decision

Model 03 will classify surface contact with three named measurements: downward speed, absolute horizontal speed, and absolute craft angle. A safe touchdown allows at most 5 m/s downward, 3 m/s horizontal, and 10 degrees from upright. A marginal touchdown allows at most 10 m/s downward, 6 m/s horizontal, and 20 degrees. Exceeding any marginal limit produces a crash result and a reason code identifying the failed limit or combination of limits.

The simulation will use a 30 Hz fixed step, a 35 m/s² maximum engine acceleration, a 54 degree-per-second rotation rate, a 60-degree rotation limit, and fuel consumption of 3.2 percentage points per second at full throttle. Flights end after two simulated minutes if the craft has not touched down.

## Alternatives considered

- Score only vertical speed at touchdown.
- Combine every measurement into a single continuous score.
- Use different thresholds for every planet.
- Tune the constants for realism against a specific real lander.

## Rationale

Three independent limits make the result easy to explain and give each live control a visible purpose. A fixed envelope also lets a player compare technique across planets: gravity changes the flight while the craft and landing standard remain constant. The chosen constants produce a short arcade-style flight with meaningful fuel and steering decisions without claiming to reproduce a real vehicle.

## Tradeoffs

- The thresholds and craft performance are game tuning values rather than certified aerospace limits.
- A boundary-based result cannot express every difference between two successful flights.
- One envelope makes high-gravity planets harder and may make some starting conditions impractical.
- The two-minute cutoff can classify a hovering or ascending craft without a physical impact.

## Consequences

- All tuning values must remain named constants in the shared flight engine.
- Unit tests must cover the exact safe and marginal boundaries.
- Result explanations and the AI instructor prompt must use the same documented limits.
- Changing a threshold or physics constant requires a model-version review because server replay and prior results depend on it.
- A future score may supplement these classifications, but it must not silently replace their meaning.
