# Will I Crash? — Submission Notes

## Submission links

- **Live app:** Pending V3 deployment. Expected URL: `https://will-i-crash.app.space`
- **Repository:** https://github.com/ThatchX/will-i-crash
- **Submission branch:** `v3-live-flight`

> Replace the live-app line with the confirmed production URL after deployment and final production verification.

## What I built

**Will I Crash?** is a one-page planetary landing simulator. The player chooses any planet in the solar system, configures a free-flight approach or selects a standardized ranked approach, and then pilots the lander with live throttle and rotation controls.

The simulation runs at a fixed 30 ticks per second and models planet-specific gravity, thrust, rotation, horizontal and vertical motion, and finite fuel. At touchdown, it grades the landing from vertical speed, horizontal speed, and angle. Completed flights are replayed on the server before they are accepted, which makes saved results and ranked scores verifiable instead of trusting values supplied by the browser.

The finished path includes:

1. Select a planet and flight mode.
2. Configure the approach in Free Flight or use standardized Ranked conditions.
3. Pilot the lander with keyboard, touch, or on-screen controls.
4. Receive a clear safe, marginal, or crash result.
5. Review the verified flight, compare ranked scores, or ask the AI flight instructor for coaching.

## DeepSpace integrations and why I used them

### Authentication

DeepSpace authentication identifies the pilot when a flight begins. Visitors can inspect the simulator before signing in, which keeps the first interaction lightweight while still tying saved flights to a verified identity.

### Server actions

The `completeFlight` server action validates the starting conditions and control trace, replays the deterministic simulation, and calculates the official result and ranked score. Ownership comes from the verified caller rather than client input.

### Realtime records

Private, immutable `flight-runs` records preserve verified flight history and synchronize the latest runs across a pilot's sessions. A separate public `leaderboard-scores` collection stores only the minimum data needed for one best score per pilot, planet, model version, and ranked challenge. Private control traces and account identity are not exposed on the leaderboard.

### AI chat and model proxy

The AI flight instructor provides optional preflight coaching and post-flight debriefs through DeepSpace's model integration. It can read verified flight records through a restricted, read-only tool set. It cannot change records, control the craft, or determine the landing outcome. Responses are capped at 700 tokens per model step to match the concise coaching experience and keep provider credit reservations predictable.

## Main tradeoff

I chose a small, deterministic 2D flight model instead of adding atmosphere, terrain, or orbital mechanics. The narrower model gave me enough depth for live control, planet-specific gravity, fuel management, server replay, scoring, and explainable outcomes while keeping the important path finishable and defensible within the assignment window.

The cost is that the simulator is deliberately arcade-like. Every body uses a flat reference surface, and the gas giants use fictional cloud-top platforms. The interface states those limitations directly rather than presenting the model as realistic aerospace software.

## What the coding agent did

I used a coding agent to help scaffold and implement the DeepSpace application, build the deterministic flight loop and server replay path, add authenticated records and the leaderboard, integrate the AI instructor, refine the HUD and visual treatment, fix reported bugs, write unit tests, run project checks, and maintain the architecture decision log.

I directed the product scope, chose which features and integrations belonged in the core loop, reviewed the running app after each major change, reported failures, and asked for changes when the behavior or presentation did not match the design.

## What I verified myself

I personally used the simulator in the browser and checked the live throttle and rotation controls, the lander's movement toward the surface, touchdown outcomes, planet switching, and the one-page flow. My testing uncovered the altitude-ceiling bug and the live readouts blocking the lander's visual path. I also reviewed the HUD hierarchy, control clarity, instructor placement, color treatment, and the decision to use solid cyan accents with blue-pink glow.

I made the final calls to keep the product focused on live landing, omit orbit, atmosphere, and terrain, add the AI instructor, and use standardized ranked starts so leaderboard scores are comparable.

## Validation performed with the agent

- ESLint passes with no errors.
- TypeScript validation passes.
- All 17 unit tests pass.
- The production build completes successfully.
- The agent tested a real Claude Sonnet 5 response through the instructor popup.
- The V3 source is pushed to the `v3-live-flight` branch at commit `48324ca`.

## Known limitations and next work

- The V3 branch still needs to be deployed and checked at its production URL.
- The landing surface is flat and effectively infinite.
- Atmosphere, terrain, and orbital mechanics are intentionally omitted.
- The AI instructor advises before or after a flight and never enters the real-time control loop.
- A future iteration could add time-based challenges, a bounded landing zone, and richer verified debrief summaries after testing the current experience with players.

## Short portal note

I built **Will I Crash?**, a one-page planetary landing simulator with live controls, eight selectable planets, deterministic physics, finite fuel, touchdown grading, verified ranked leaderboards, and an AI flight instructor. I used DeepSpace authentication, server actions, realtime records, and the managed AI model integration. My main tradeoff was choosing an explainable 2D flight model and omitting atmosphere, terrain, and orbit so I could finish and verify the core experience. The coding agent helped implement the app, fix bugs, write tests, refine the interface, and document engineering decisions. I personally directed the scope and design, tested the controls and outcomes in the browser, found the altitude-ceiling and readout-placement bugs, reviewed the UX and visual system, and decided which features belonged in the submission.
