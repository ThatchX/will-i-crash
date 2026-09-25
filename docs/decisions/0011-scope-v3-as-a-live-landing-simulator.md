# ADR 0011: Scope V3 as a live landing simulator

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** Portions of ADR 0002, ADR 0004, and ADR 0009
- **Superseded by:** None

## Decision

V3 will turn the existing one-page sandbox into a deterministic two-dimensional live landing simulator. The player will choose a planet and starting conditions before flight, then control engine throttle and signed craft rotation while the lander moves vertically and horizontally toward a flat reference surface.

V3 includes:

- the existing eight selectable planets, distinguished by gravity and artwork
- preflight altitude, vertical speed, and horizontal speed
- live throttle from 0% to 100%
- live left and right rotation around vertical
- finite fuel consumed in proportion to engine power
- continuous altitude, vertical-speed, horizontal-speed, angle, throttle, and fuel telemetry
- a fixed-step deterministic simulation shared by the browser and server
- outcome evaluation at surface contact using vertical speed, horizontal speed, and craft angle
- keyboard controls with equivalent mouse and touch controls
- pause and restart
- an immutable, versioned saved flight containing initial conditions, control changes, and the verified outcome

V3 explicitly excludes:

- orbital mechanics
- atmosphere and aerodynamic drag
- terrain generation, slopes, or landing pads
- weather, wind, heating, lift, and parachutes
- authored missions or a campaign
- three-dimensional graphics
- multiplayer piloting, AI autopilot, and global leaderboards

## Alternatives considered

- Keep the V2 model, where power and tilt are chosen before a fixed animation.
- Add only a live throttle while retaining vertical-only movement.
- Add orbit, atmosphere, and generated terrain to the live simulator.
- Build a more realistic three-dimensional flight simulator.

## Rationale

Live throttle and rotation give the player direct responsibility for the outcome. Horizontal velocity makes tilt a useful control rather than a pure penalty, and finite fuel prevents indefinite hovering. A flat surface and gravity-only environment keep the model small enough to explain, test, and modify during a live coding session while preserving meaningful piloting decisions.

Orbit, atmosphere, and terrain each introduce separate physics models, data requirements, rendering scales, and failure cases. Including all three would move the project away from the focused scope required for the submission.

## Tradeoffs

- The simulation remains intentionally arcade-like and does not model atmospheric entry or real planetary surfaces.
- A flat, effectively infinite surface limits navigation and landing-location strategy.
- Adding horizontal motion, fuel, and real-time input is still substantially more complex than V2.
- Server replay requires compact control-event recording and deterministic numerical behavior.

## Consequences

- V2 remains intact until the complete V3 loop works and passes its own tests.
- The V3 simulation state will include horizontal and vertical position and velocity, craft angle, throttle, fuel, elapsed ticks, and flight phase.
- Physics will advance on a fixed simulation step; rendering may interpolate at the display frame rate.
- The browser will record only control changes with their simulation ticks rather than storing every rendered frame.
- The server will replay the initial state and control changes through the shared simulation before saving an outcome.
- Safe, marginal, and crash thresholds will be named constants and tested at their boundaries.
- V3 records will use a new model version and must not reinterpret or overwrite V2 attempts.
- Any future proposal to add orbit, atmosphere, or terrain requires a separate ADR and scope review.
