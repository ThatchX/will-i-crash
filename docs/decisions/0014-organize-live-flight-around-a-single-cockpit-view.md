# ADR 0014: Organize live flight around a single cockpit view

- **Status:** Superseded
- **Date:** 2026-09-25
- **Supersedes:** None
- **Superseded by:** ADR 0015

## Decision

During an active flight, keep the scene, live telemetry, touchdown limits, controls, warnings, and final outcome within one cockpit view. Present motion with direction words as well as numbers, show the safe state of each touchdown measurement, and surface only the highest-priority warning with clear corrective language and hysteresis.

Opening the AI flight instructor pauses an active flight. The instructor opens as a focus-managed dialog, states that it advises without controlling the craft, and leaves the flight paused when it closes. Historical flights remain collapsed until the player asks to review them.

## Alternatives considered

- Keep telemetry and touchdown results below the flight scene.
- Overlay all telemetry on the scene as a traditional heads-up display.
- Allow the instructor to remain open while the simulation continues.
- Add automated flight correction or let the instructor manipulate controls.
- Use signed numbers alone and expect players to learn their directional meaning.

## Rationale

Landing requires the player to compare the craft's motion, three touchdown limits, and control response under time pressure. Keeping those elements close reduces visual search and makes the relationship between an action and its effect easier to learn. Direction words such as `right`, `left`, `descending`, and `climbing` remove avoidable sign interpretation while retaining exact measurements.

Pausing for the instructor prevents the coaching surface from competing with a live landing. Keeping the instructor advisory preserves player ownership and the deterministic model. Collapsing history protects the active flight as the visual center.

## Tradeoffs

- The control column is denser and needs responsive layouts at narrow widths.
- Hysteresis can leave a warning visible briefly after a value crosses back over its entry threshold.
- Pausing the flight interrupts continuous play when the player asks for coaching.
- Directional labels use more space than signed measurements alone.
- A modal instructor prevents simultaneous manipulation of the flight controls and chat.

## Consequences

- Active-flight telemetry must stay adjacent to the controls and display the documented touchdown limits.
- Warning copy must name the problem and the corrective action; threshold changes must preserve warning hysteresis.
- Tap rotation must produce a predictable small correction while press-and-hold continues rotation.
- The instructor must pause a flying simulation, contain keyboard focus, return focus to its trigger, and never alter controls or outcomes.
- Frequently used controls and dialog actions should provide at least a 44-by-44-pixel target.
- New panels should not cover the craft, telemetry, or active controls.
