# ADR 0015: Use a minimal adaptive flight HUD

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** ADR 0014
- **Superseded by:** None

## Decision

Make the flight scene the visual center during live play. Place a small heads-up display around its edges, keep the craft's descent path clear, and attach the primary controls below the scene. Show altitude and descent rate on the left; drift, attitude, and throttle on the right; planet, mode, time, and fuel along the top; and at most one prioritized corrective warning near the top center.

Reduce emphasis when a measurement is safe and increase it only as that measurement approaches or exceeds its touchdown limit. Retain direction words, exact values, safe limits, warning hysteresis, focus-managed instructor behavior, and touch-friendly controls from ADR 0014.

## Alternatives considered

- Keep the separate cockpit control panel beside the scene.
- Put every readout in persistent cards over the animation.
- Hide exact telemetry and rely only on color or warning messages.
- Remove the touchdown limits from the live view.
- Move all controls over the scene as a conventional game overlay.

## Rationale

The lander and its motion are the information the player needs to perceive first. A separate cockpit panel competed with that focal point and required repeated eye movement between the animation, measurements, and controls. Edge-aligned readouts preserve the relationship between the scene and telemetry while leaving the craft's path unobstructed. Progressive emphasis makes exceptional conditions easier to notice without presenting every value as equally urgent.

Controls remain below the scene because they need larger targets and steady positions. This preserves a clear visual hierarchy: vehicle and surface first, unsafe measurements second, controls third, and secondary history or coaching on demand.

## Tradeoffs

- Overlay placement needs responsive tuning at narrow widths and for longer localized labels.
- Dim safe readings can be harder to scan in bright environments, so contrast still needs accessibility review.
- Showing a single warning can hide lower-priority problems until the highest-priority condition is corrected.
- Separating controls from their related readouts adds a small amount of eye travel.

## Consequences

- The center of the flight scene must remain free of telemetry cards and persistent controls.
- Readouts must use text or shape in addition to color to communicate state.
- The warning selector must rank conditions and apply hysteresis so messages do not flicker near a threshold.
- Primary controls must keep stable positions, keyboard support, and targets of at least 44 by 44 pixels.
- Secondary surfaces such as the instructor, leaderboard, and flight log open on demand and must not remain over active play.
- Any new persistent metric must justify why a pilot needs it during the next control decision.
