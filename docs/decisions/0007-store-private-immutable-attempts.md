# ADR 0007: Store private immutable attempts

- **Status:** Accepted
- **Date:** 2026-09-25

## Decision

Store each completed run as an immutable `descent-attempts` record containing its inputs, calculated outputs, owner, and model version. Users can read and delete only their own records. The interface subscribes to the 10 most recent attempts through DeepSpace realtime records. Attempts are not ranked on a global leaderboard.

## Alternatives considered

- Store no history.
- Let users edit prior attempts.
- Save only inputs and recalculate old results with the newest model.
- Publish every attempt and rank users globally.
- Keep history only in browser storage.

## Rationale

An attempt is an event, so immutability preserves what was actually evaluated. Saving both inputs and outputs makes history stable when the model changes, while `modelVersion` explains which rules produced it. Private ownership keeps the first version simple and avoids exposing user activity. Realtime sync demonstrates a useful platform capability across the same pilot's sessions.

## Tradeoffs

- Derived data is duplicated in storage.
- Users cannot correct an attempt; they must delete it and run another.
- A private log creates less social engagement than shared scores.
- Limiting the visible log to 10 attempts favors recency over full history browsing.

## Consequences

- Every stored attempt must include `modelVersion`.
- Schema fields remain immutable and creation stays restricted to the server action.
- Model changes do not rewrite historical attempts.
- Shared rooms, leaderboards, or public attempts require a new privacy and comparability decision.
