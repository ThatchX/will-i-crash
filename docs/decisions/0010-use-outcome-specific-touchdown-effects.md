# ADR 0010: Use outcome-specific touchdown effects

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** None
- **Superseded by:** None

## Decision

Give successful and crashed descents visibly different touchdown animations. A safe landing settles gently and emits green confirmation rings and sparks. A crash jolts and tilts the craft while producing an orange-red flash, shockwave, and debris. A marginal landing uses a smaller unstable settle without either success or crash effects.

The effects begin only after the craft reaches the reference surface and do not affect the calculated result.

## Alternatives considered

- Use the same arrival animation for every outcome.
- Communicate outcomes only through the result text and colors.
- Play a longer cinematic sequence before revealing the result.
- Use animation state as part of the landing calculation.

## Rationale

The moment of touchdown is the visual payoff for the player's input. Distinct motion makes success and failure understandable before the result panel is read, while the marginal settle preserves the three-outcome model. Keeping the effects downstream of the calculation prevents presentation code from becoming a second rules engine.

## Tradeoffs

- Additional motion and effects add CSS and visual complexity.
- The effects are stylized and do not model real collision dynamics.
- Very short effects can be missed if the player is focused on the controls or result panel.

## Consequences

- Outcome effects must use the server-returned assessment.
- The engine plume turns off when touchdown completes.
- Reduced-motion mode shortens all touchdown effects to an effectively immediate state.
- Future sound, haptics, or replay controls require a separate accessibility and interaction decision.
