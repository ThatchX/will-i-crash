# ADR 0001: Focus on a one-page descent sandbox

- **Status:** Accepted
- **Date:** 2026-09-25

## Decision

Build **Will I Crash?** as a focused, one-page planetary descent sandbox. The player chooses a planet, supplies the starting conditions, runs the descent, reads the result, and can inspect recent attempts. The product will not include authored missions or a campaign in this version.

## Alternatives considered

- Continue the original spacecraft telemetry monitor as an operator dashboard.
- Build a multi-page mission-control application.
- Create authored levels, missions, or a progression system.
- Build a generic form that reports whether a set of telemetry values is healthy.

## Rationale

The descent question gives the telemetry an outcome the player cares about: whether the lander reaches the surface safely. A single interaction loop fits the DeepSpace exercise's preference for a focused, finished product and is small enough to understand and modify during a live coding session. Player-created conditions provide experimentation without requiring a large content system.

## Tradeoffs

- There is less narrative variety and progression than a mission-based game.
- The interface demonstrates one core calculation rather than a broad telemetry platform.
- Replay value depends on experimentation with inputs and planets.

## Consequences

- New features should strengthen the choose, tune, run, understand loop.
- Navigation and additional pages require a clear product reason.
- Authored missions remain a possible future feature, not an MVP dependency.
