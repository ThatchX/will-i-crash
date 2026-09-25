# Will I Crash?

Will I Crash? is a small full-stack DeepSpace app that evaluates a powered lunar descent. A signed-in user enters the lander's height, downward speed, engine power, and tilt. The app returns an explainable **Safe approach**, **Marginal**, or **Crash likely** result and saves the check to that user's private realtime history.

## The model

Version 1 uses a deliberately small deterministic model:

- lunar gravity: 1.62 m/s²
- maximum engine acceleration: 5.0 m/s²
- vertical engine acceleration: `max acceleration × throttle × cos(tilt)`
- net braking acceleration: `vertical engine acceleration − lunar gravity`
- stopping distance: `speed² ÷ (2 × net braking acceleration)`
- a safe approach uses no more than 70% of the available altitude

The model assumes constant power and tilt, no atmosphere, and no horizontal velocity. It is an educational estimate, not flight software.

## DeepSpace features

- DeepSpace authentication protects the landing console.
- An authenticated server action validates and evaluates telemetry, then owns the saved record using the verified caller identity.
- A private `landing-checks` collection stores immutable results. Users can read and delete only their own checks.
- Realtime records keep the most recent 10 checks synchronized across the user's open sessions.
- The public landing page stays static, so it does not start an auth request or records connection.

## Main tradeoff

The app favors a calculation the author can explain and defend over a more realistic simulation. It does not model fuel burn, horizontal motion, changing throttle, terrain, or guidance. Those additions would make the result look more precise without improving the core screening demonstration.

## Run locally

Use a supported Node release (22.15+, 24, or 26), then:

```bash
npm install
npx deepspace dev start
```

Run validation with:

```bash
npm run validate
npm run lint
npm run build
npx deepspace test run all
```

## Possible V3 directions

V3 can build on the focused core with a shared instructor room, an optional AI flight instructor, threshold alerts, or scenario import. Those features are intentionally outside V2.
