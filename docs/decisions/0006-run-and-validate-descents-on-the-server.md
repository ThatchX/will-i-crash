# ADR 0006: Run and validate descents on the server

- **Status:** Accepted
- **Date:** 2026-09-25

## Decision

Use the shared domain function for immediate client validation and send authenticated runs to the `runDescent` server action. The action parses the request, validates it again, calculates the authoritative assessment, derives ownership from the verified user identity, and creates the record itself.

## Alternatives considered

- Trust a client-calculated result and write it directly to records.
- Calculate only on the server and delay all feedback until the request returns.
- Duplicate separate calculation logic in the browser and worker.
- Store only raw inputs and calculate every result during reads.

## Rationale

Client validation gives fast field feedback, while server validation protects stored data from modified clients. A shared pure function prevents calculation drift. Server-owned identity and output fields ensure users cannot submit a fabricated owner, outcome, or explanation.

## Tradeoffs

- A run requires a network round trip and a valid session.
- The client and server are coupled to the same model package and version.
- Server availability affects the core action even though the formula can run locally.

## Consequences

- Client assessments may guide validation, but only the action response is displayed and saved as the completed run.
- Stored derived fields must come from the server.
- Validation and boundary tests belong around the shared domain function.
- Model changes must keep the action, schema, tests, and displayed fields aligned.
