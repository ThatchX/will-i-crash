# Will I Crash?

Will I Crash? is a one-page planetary landing sandbox built on DeepSpace. A player chooses any planet, sets the lander's altitude, downward speed, engine power, and tilt, then watches the lander descend toward a fixed reference surface. The app returns an explainable **Landing secured**, **Close call**, or **Surface impact** result and saves signed-in attempts to a private realtime flight log.

## The model

Model 2 uses a deliberately small deterministic calculation:

- the same lander has a maximum engine acceleration of 35 m/s² on every planet
- vertical engine acceleration: `maximum acceleration × power × cos(tilt)`
- net braking acceleration: `vertical engine acceleration − planetary gravity`
- stopping distance: `speed² ÷ (2 × net braking acceleration)`
- a safe approach uses no more than 70% of the available altitude
- minimum safe power is the throttle required to meet that 70% stopping budget

The eight planet gravities are stored as named configuration data. The model assumes constant power and tilt, no atmosphere, and no horizontal velocity. Gas giants use a fictional cloud-top reference platform. It is an educational estimate, not flight software.

## Product decisions

- The simulator is a single page with no authored missions. Players create their own conditions.
- The surface stays fixed while the lander moves toward it.
- Sliders provide fast experimentation and paired number inputs allow exact values.
- Planet changes affect gravity and artwork while keeping the lander constant.
- Results show stopping distance, remaining altitude, minimum safe power, and power margin.
- Attempts are not ranked globally because player-selected starting conditions are not comparable.
- The animation illustrates the deterministic result in a short sequence rather than pretending to be a continuous physics engine.

## DeepSpace features

- DeepSpace authentication identifies the pilot when an attempt is run.
- An authenticated server action validates telemetry, calculates the result, and assigns ownership from the verified caller identity.
- A private immutable `descent-attempts` collection stores model inputs and outputs. Users can read and delete only their own attempts.
- Realtime records synchronize the most recent 10 attempts across the pilot's signed-in sessions.

## Engineering decisions

The reasoning behind the product, physics model, interface, data, and DeepSpace choices is recorded in the [architecture decision log](docs/decisions/README.md). New material decisions should be added there when they are made so the implementation and its rationale stay connected.

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

The normal validation commands still run separately:

```bash
npm run validate
npm run lint
npm run build
```

## Possible V3 directions

V3 could add shared instructor rooms, alerts, or an optional AI flight instructor. Those features are intentionally outside this focused version.
