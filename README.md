# Will I Crash?

Will I Crash? is a one-page, live planetary landing game built on DeepSpace. Choose any planet, practice with your own starting conditions, or fly a standardized ranked approach, then pilot the lander with throttle and rotation controls. The same deterministic simulation runs in the browser and on the server, so every saved result and public score can be replayed and verified.

The interface uses a void-black flight deck with solid cyan controls and restrained blue, violet, and pink ambient glow. Each planet keeps its own environmental palette, while green, amber, and red remain reserved for flight status.

## The flight model

Model 03 advances at a fixed 30 ticks per second. Each tick applies:

- the selected planet's gravity
- the lander's thrust, split into vertical and horizontal acceleration by its angle
- rotation at a fixed rate while a left or right input is held
- fuel consumption in proportion to throttle
- horizontal and vertical movement toward a flat reference surface

At surface contact, the model evaluates vertical speed, horizontal speed, and angle:

| Result | Vertical speed | Horizontal speed | Absolute angle |
| --- | ---: | ---: | ---: |
| Landing secured | ≤ 5 m/s | ≤ 3 m/s | ≤ 10° |
| Close call | ≤ 10 m/s | ≤ 6 m/s | ≤ 20° |
| Surface impact | Any larger value | Any larger value | Any larger value |

The model intentionally omits atmosphere, terrain, and orbit. Gas giants use a fictional cloud-top platform. This is an educational simulation, not flight software.

## How to play

1. Select one of the eight planets.
2. Choose Free Flight and set the approach, or choose Ranked for standardized starting conditions.
3. Start the flight and manage throttle, rotation, and finite fuel.
4. Reach the surface slowly, with little drift, and close to upright.
5. Review the verified result, compare ranked scores, or ask the AI flight instructor for a debrief.

The interface supports sliders and buttons on touch devices, plus keyboard controls:

- `W` / `S` or `↑` / `↓`: increase or decrease throttle
- `A` / `D` or `←` / `→`: hold to rotate
- `Space`: cut the engine
- `P`: pause or resume

## DeepSpace integrations

- **Authentication** identifies the pilot only when they begin a flight, so visitors can inspect the simulator first.
- **Server actions** replay the submitted control trace with the shared flight engine before accepting a result.
- **Realtime records** store private, immutable, versioned flight runs and synchronize the latest ten runs across the pilot's sessions.
- **Public realtime leaderboard** shows one server-verified best score per pilot and planet while keeping private flight traces and account identity out of the ranking record.
- **AI chat** provides optional preflight guidance and post-flight coaching. Its tools are read-only, and it cannot control the craft or determine the outcome.

Model 02 descent attempts remain in their original collection. Model 03 writes to a separate `flight-runs` collection so old results are never reinterpreted.

## Engineering decisions

The product scope, physics, interface, data model, security, and AI boundaries are recorded in the [architecture decision log](docs/decisions/README.md).

The assignment-facing project summary, integration rationale, tradeoff, agent contribution, verification record, and known limitations are collected in the [submission notes](docs/SUBMISSION.md).

## Run locally

Use a supported Node release (22.15+, 24, or 26), then:

```bash
npm install
npx deepspace dev start
```

If macOS exhausts file watchers while starting the optional live ESLint checker:

```bash
SKIP_DEV_CHECKER=1 npx deepspace dev start
```

Run the project checks with:

```bash
npm run validate
npm run lint
npm run build
```

## Honest limits and possible next work

The current surface is flat and effectively infinite, the flight model is intentionally arcade-like, and the AI instructor responds before or after a flight rather than inside the control loop. Future work could add time-based challenges, a landing zone, or richer debrief summaries after the core V3 experience has been evaluated with players.
