# ADR 0017: Use void and aurora visual language

- **Status:** Superseded
- **Date:** 2026-09-25
- **Supersedes:** The amber accent in the original Orbital theme
- **Superseded by:** ADR 0018

## Decision

Use a near-black `#03040a` foundation with translucent blue-black surfaces. Use a blue-to-violet-to-pink gradient as instrument light for primary actions, active selections, progress controls, focused achievements, and limited ambient illumination.

Keep planetary scenery data-driven and distinct from the interface palette. Preserve green, amber, and red exclusively for safe, caution, and critical states. Keep most text white or muted blue-gray, and leave the center of the flight path free of decorative effects.

## Alternatives considered

- Keep the existing navy and amber Orbital theme.
- Apply the blue-pink gradient to every card, heading, and telemetry value.
- Give the entire interface the selected planet's accent color.
- Use a neutral monochrome flight-instrument aesthetic.
- Add raster space artwork behind the simulator.

## Rationale

Void black gives the lander and planet artwork a stronger silhouette. Blue, violet, and pink provide a memorable identity while still reading as emitted light against space. Restricting the gradient to interactive and celebratory moments keeps the interface hierarchy clear and prevents decorative color from competing with flight information.

Planet-specific colors continue to describe the simulated environment. The shared aurora palette describes the simulator itself, so changing planets feels like visiting a new place without changing how the controls communicate.

## Tradeoffs

- Gradient controls can feel playful if their use becomes too broad.
- Translucent surfaces require careful contrast checks over different planet scenes.
- Very dark backgrounds make low-opacity borders and secondary text sensitive to display quality.
- Custom range styling requires browser-specific thumb rules.

## Consequences

- Primary interactions and selected states may use the aurora gradient; ordinary containers should remain dark and quiet.
- Safe, caution, critical, and crash states must retain their semantic colors.
- Planet art and planet accent colors must remain independent from interface state colors.
- Gradients must not appear behind dense telemetry or obscure the lander's travel path.
- New decorative effects should be concentrated at scene edges, horizons, transitions, and achievement moments.
- The first-paint background must stay synchronized with the void theme to prevent a startup flash.
