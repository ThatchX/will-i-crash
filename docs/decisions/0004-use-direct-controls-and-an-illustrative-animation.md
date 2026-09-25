# ADR 0004: Use direct controls and an illustrative animation

- **Status:** Accepted
- **Date:** 2026-09-25

## Decision

Keep the reference surface fixed and animate the lander toward it after a descent is evaluated. Use paired sliders and numeric inputs for altitude, downward speed, engine power, and tilt. The short animation illustrates the deterministic result; it is not the calculation itself or a continuous physics engine.

## Alternatives considered

- Move the surface upward while the lander stays fixed.
- Use text fields only.
- Build a real-time piloting game with continuously changing controls.
- Show the result instantly without motion.

## Rationale

Moving the lander matches the player's mental model and creates a clear visual center. Sliders make experimentation fast, while numeric inputs support exact boundary tests and reproducible attempts. Separating the calculation from the animation keeps the result predictable and the code explainable.

## Tradeoffs

- The animation does not portray velocity or acceleration to scale.
- A fixed-duration sequence can make very different descents look similar.
- Maintaining two input methods requires synchronization and validation.

## Consequences

- Product copy must not present the animation as a physics simulation.
- Input changes reset the previous result so the picture cannot imply stale telemetry.
- Reduced-motion preferences must still expose the result without relying on animation.
- Future visual effects must follow the calculated outcome rather than create a second source of truth.
