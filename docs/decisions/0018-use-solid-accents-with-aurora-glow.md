# ADR 0018: Use solid accents with aurora glow

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** ADR 0017
- **Superseded by:** None

## Decision

Keep the void-black foundation and black-glass surfaces from ADR 0017, but use solid cyan for interactive accents. Apply blue, violet, and pink only as soft light around controls, selected states, scene edges, horizons, and achievements. Do not fill buttons, text, sliders, or selection pills with multicolor gradients.

The engine plume uses a cyan core that fades only for transparency, with blue and pink light cast around it. Planet scenes keep the gradients required to depict sky and surface depth; this decision governs the simulator interface.

## Alternatives considered

- Keep multicolor gradient fills on primary controls and selected states.
- Use solid pink for primary controls.
- Remove violet and pink entirely and use only cyan.
- Use different solid accent colors for different controls.

## Rationale

Solid controls look more precise and make the interface easier to scan. Moving the cotton-candy palette into shadows and atmospheric light preserves the visual identity without making controls feel decorative. Cyan provides strong contrast against void black and remains distinct from green, amber, and red flight-status colors.

## Tradeoffs

- The cotton-candy palette becomes subtler and may be less obvious on dim displays.
- Layered colored shadows require restraint to avoid fuzzy control edges.
- Cyan is shared with some planet artwork, so interaction state also depends on shape, position, and contrast.

## Consequences

- Primary controls, active selections, slider tracks, and highlighted text use one solid cyan.
- Violet and pink may appear in glow, shadow, or ambient edge lighting, never as a control fill.
- Semantic status colors remain unchanged.
- Decorative glow must remain outside dense telemetry and the lander's travel path.
- New interface accents should use the solid instrument token instead of introducing another fill color.
