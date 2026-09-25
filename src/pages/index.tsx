/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * That makes it cheap to serve and safe for logged-out / crawler traffic.
 *
 * Need live data or auth here? Move this file to src/pages/(app)/index.tsx
 * and it becomes a dynamic page. Conversely, any page you want to keep static
 * (marketing, docs, legal) belongs at this top level.
 */

import { Link } from 'react-router-dom'
import { APP_DISPLAY_NAME } from '../constants'

export default function Landing() {
  return (
    <div data-testid="static-landing" className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_20%_20%,rgba(245,158,11,0.17),transparent_24%),radial-gradient(circle_at_80%_45%,rgba(56,189,248,0.12),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.7)_0.7px,transparent_0.7px)] [background-size:42px_42px]" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="text-sm font-semibold tracking-tight">{APP_DISPLAY_NAME}</Link>
        <Link to="/home" className="rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
          Open console
        </Link>
      </header>

      <main className="relative mx-auto grid min-h-[calc(100vh-88px)] max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Lunar landing risk check</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-bold tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            Know whether you can stop before the surface.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Enter height, descent speed, engine power, and tilt. Get an immediate,
            explainable estimate based on lunar gravity and your available braking force.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/home" className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              Check a landing
            </Link>
            <a href="#model" className="rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card">
              See the model
            </a>
          </div>
        </div>

        <div id="model" className="relative rounded-3xl border border-border bg-card/80 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.35)] backdrop-blur sm:p-8">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Model 01</p>
              <p className="mt-1 font-semibold">Powered lunar descent</p>
            </div>
            <span className="size-3 rounded-full bg-success shadow-[0_0_18px_rgba(16,185,129,0.8)]" aria-label="Model ready" />
          </div>
          <dl className="mt-6 space-y-4">
            <LandingFact label="Gravity" value="1.62 m/s²" />
            <LandingFact label="Maximum engine acceleration" value="5.00 m/s²" />
            <LandingFact label="Safe stopping budget" value="70% of altitude" />
          </dl>
          <div className="mt-6 rounded-xl border border-border bg-background/60 p-4 font-mono text-sm leading-7 text-muted-foreground">
            vertical thrust = max thrust × power × cos(tilt)
            <br />
            stopping distance = speed² ÷ (2 × net braking)
          </div>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            Built as an educational estimate with clear assumptions. It is not flight software.
          </p>
        </div>
      </main>
    </div>
  )
}

function LandingFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm font-semibold text-foreground">{value}</dd>
    </div>
  )
}
