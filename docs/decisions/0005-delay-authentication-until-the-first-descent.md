# ADR 0005: Delay authentication until the first descent

- **Status:** Accepted
- **Date:** 2026-09-25

## Decision

Allow anonymous visitors to load the complete simulator, select planets, and adjust controls. Ask them to sign in when they run their first descent because running also creates a private saved attempt.

## Alternatives considered

- Require sign-in before showing the application.
- Allow anonymous runs that are never saved.
- Create temporary anonymous records and claim them after sign-in.
- Remove accounts and persistence entirely.

## Rationale

Visitors can understand the product before meeting an account boundary. Requiring identity at the moment persistence becomes useful gives authentication a clear purpose and keeps every saved attempt tied to a verified owner.

## Tradeoffs

- The first run is interrupted by authentication.
- Anonymous users cannot preview a completed result.
- Supporting unsaved anonymous runs later would require a deliberate change to the interaction and persistence contract.

## Consequences

- The dynamic app shell and record layer must permit anonymous reads of the interface.
- The server action requires authenticated identity before creating an attempt.
- The interface should explain the sign-in boundary before the user presses Run descent.
