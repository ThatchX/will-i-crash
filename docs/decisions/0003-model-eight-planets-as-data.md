# ADR 0003: Model eight planets as data

- **Status:** Accepted
- **Date:** 2026-09-25

## Decision

Let the player select any of the eight planets. Represent each planet with named configuration data, especially its gravity and surface type, while using the same lander and landing equations everywhere. Planet selection changes the gravity, label, color treatment, and reference surface artwork.

## Alternatives considered

- Support only Earth or the Moon.
- Create separate landing logic for every planet.
- Treat planets as authored difficulty levels with hidden modifiers.
- Randomize gravity or vehicle capability between attempts.

## Rationale

Planet selection makes the effect of gravity visible without multiplying the number of systems. Keeping one lander constant creates a useful comparison: the same inputs can be safe on one world and fatal on another. A data-driven list also makes the supported worlds easy to inspect and extend.

## Tradeoffs

- Real planetary differences cannot be reduced to gravity and artwork.
- Gas giants do not have a solid surface, so their landing target is fictional.
- The same vehicle capability across every planet is a game rule rather than a mission design claim.

## Consequences

- `PLANETS` is the authoritative list for supported IDs, names, gravity, and surface kind.
- Planet-specific behavior should be added as explicit data before introducing branches in the calculation.
- Any future atmosphere or vehicle differences will require a model revision and a new decision record.
