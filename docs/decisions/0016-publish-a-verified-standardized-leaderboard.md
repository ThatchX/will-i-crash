# ADR 0016: Publish a verified standardized leaderboard

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** The global leaderboard exclusion in ADR 0011
- **Superseded by:** None

## Decision

Offer two flight modes. Free Flight keeps player-configured initial conditions and does not affect rankings. Ranked Flight uses fixed initial conditions for the selected planet and submits the completed command trace to the existing server replay path.

Only a safe landing from a valid ranked start receives a score. The server calculates a maximum score of 1,000 points from touchdown descent rate (40%), horizontal drift (30%), attitude (20%), and remaining fuel (10%). Elapsed time does not affect the score. Publish only each pilot's best score per planet, challenge version, and landing-model version.

Keep private immutable flight traces in `flight-runs`. Store the public ranking projection in a separate `leaderboard-scores` collection containing a one-way pseudonymous pilot key, generated callsign, score, touchdown measurements, fuel, time, planet, challenge version, and model version. The server action is the only writer.

## Alternatives considered

- Rank every free-flight configuration together.
- Rank by completion time.
- Let the client calculate and write scores directly.
- Make complete command traces public as leaderboard evidence.
- Publish players' account names or email addresses.
- Store every ranked attempt as a public leaderboard row.

## Rationale

A meaningful leaderboard requires comparable attempts. Fixed starting conditions isolate control skill while the planet selection still creates distinct challenges. Replaying commands on the server and calculating the score from the verified result keeps the ranking tied to the same deterministic model used for stored flights.

A separate public projection protects the more detailed private flight history and keeps leaderboard reads small. Generated callsigns provide stable pilot identity without exposing account information. Keeping only the best score gives each pilot one clear position and prevents the board from being flooded by repeat attempts.

## Tradeoffs

- A fixed challenge does not reward creative setup choices.
- The scoring weights express a product judgment and may need tuning after playtesting.
- Generated callsigns are less personal than chosen display names.
- A best-score board does not show improvement history or total participation.
- Simultaneous first submissions can contend for the same unique leaderboard row and require retry handling if this becomes common.

## Consequences

- Ranked starts must exactly match the versioned standard conditions before server replay.
- Score changes require a new challenge key or challenge version so unlike rules are never mixed.
- A failed or unsafe landing must never create or improve a public score.
- The public schema must deny client writes and expose no raw account identifier, email, real name, command trace, or private flight identifier.
- The leaderboard must identify its planet and standardized challenge, explain the scoring weights, and highlight the signed-in pilot's best result.
- Realtime collection updates may refresh rankings, but leaderboard availability must not block free flight or private flight storage.
