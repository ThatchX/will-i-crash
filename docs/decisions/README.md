# Engineering Decision Log

This directory records the material engineering and product decisions behind **Will I Crash?**. The goal is to make the project easy to explain, defend, and change deliberately.

Each ADR uses the same structure:

1. **Decision** — what the project will do.
2. **Alternatives considered** — credible options that were available.
3. **Rationale** — why this choice best serves the project now.
4. **Tradeoffs** — what the choice gives up or makes harder.
5. **Consequences** — rules and follow-up work created by the decision.

## Working agreement

- Add an ADR when a choice materially affects product scope, architecture, the landing model, stored data, security, or use of DeepSpace.
- Record the decision when it is made, in the same change as its implementation when possible.
- Copy [the ADR template](template.md), use the next four-digit number, and give it a short lowercase filename.
- Mark a decision `Proposed`, `Accepted`, `Superseded`, or `Deprecated`.
- Do not edit an accepted ADR to make history look cleaner. Add a new ADR and link the old and new records.
- Small refactors, cosmetic adjustments, and routine bug fixes do not need ADRs unless they change an accepted decision.

## Decisions

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-focus-on-a-one-page-descent-sandbox.md) | Accepted | Focus the product on a one-page, player-configured descent sandbox |
| [0002](0002-use-a-small-deterministic-landing-model.md) | Accepted | Use a small, deterministic, explainable landing model |
| [0003](0003-model-eight-planets-as-data.md) | Accepted | Model all eight planets as data while keeping the lander constant |
| [0004](0004-use-direct-controls-and-an-illustrative-animation.md) | Accepted | Use direct controls and an illustrative descent animation |
| [0005](0005-delay-authentication-until-the-first-descent.md) | Accepted | Let visitors explore before requiring authentication |
| [0006](0006-run-and-validate-descents-on-the-server.md) | Accepted | Run and validate saved descents through a server action |
| [0007](0007-store-private-immutable-attempts.md) | Accepted | Store private, immutable attempts in a realtime flight log |
| [0008](0008-use-only-integrations-that-serve-the-core-loop.md) | Accepted | Use only DeepSpace integrations that serve the core loop |
| [0009](0009-animate-every-descent-to-the-surface.md) | Accepted | Animate every completed descent from its start to the surface |
| [0010](0010-use-outcome-specific-touchdown-effects.md) | Accepted | Use distinct success and crash animations at touchdown |
