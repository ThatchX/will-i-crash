import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { AuthOverlay, getAuthToken, useAuthProfileReady, useMutations, useQuery } from 'deepspace'
import { Gauge, RotateCcw, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { Button, Input, Label, useToast } from '@/components/ui'
import {
  MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED,
  PLANETS,
  assessLanding,
  getPlanet,
  type LandingAssessment,
  type LandingCheckRecord,
  type LandingOutcome,
  type LandingTelemetry,
  type PlanetId,
} from '@/domain/landing'

type NumericField = Exclude<keyof LandingTelemetry, 'planetId'>
type FieldValues = Record<NumericField, string>
type FlightPhase = 'ready' | 'running' | 'complete'

interface ActionResponse {
  success: boolean
  data?: { recordId: string; assessment: LandingAssessment }
  error?: string
  issues?: Array<{ path: string[]; message: string }>
}

const INITIAL_VALUES: FieldValues = {
  heightMeters: '120',
  descentSpeedMetersPerSecond: '18',
  enginePowerPercent: '50',
  tiltDegrees: '0',
}

const CONTROLS: Array<{
  name: NumericField
  label: string
  shortLabel: string
  unit: string
  min: number
  max: number
  step: number
}> = [
  { name: 'heightMeters', label: 'Starting altitude', shortLabel: 'Altitude', unit: 'm', min: 1, max: 10_000, step: 1 },
  { name: 'descentSpeedMetersPerSecond', label: 'Downward speed', shortLabel: 'Speed', unit: 'm/s', min: 0, max: 500, step: 1 },
  { name: 'enginePowerPercent', label: 'Engine power', shortLabel: 'Power', unit: '%', min: 0, max: 100, step: 1 },
  { name: 'tiltDegrees', label: 'Tilt from vertical', shortLabel: 'Tilt', unit: '°', min: 0, max: 90, step: 1 },
]

const PLANET_ART: Record<PlanetId, {
  sky: string
  surface: string
  accent: string
  glow: string
  detail: string
}> = {
  mercury: {
    sky: 'linear-gradient(180deg, #09090b 0%, #27211d 100%)',
    surface: 'linear-gradient(180deg, #91877b 0%, #3f3933 100%)',
    accent: '#c9b8a1',
    glow: 'rgba(224, 205, 180, 0.28)',
    detail: 'Airless, cratered surface',
  },
  venus: {
    sky: 'linear-gradient(180deg, #30130c 0%, #a2471f 62%, #d68d45 100%)',
    surface: 'linear-gradient(180deg, #9c4d27 0%, #442013 100%)',
    accent: '#ffb45d',
    glow: 'rgba(255, 160, 74, 0.34)',
    detail: 'Simplified surface; atmosphere ignored',
  },
  earth: {
    sky: 'linear-gradient(180deg, #050a18 0%, #123c66 65%, #5ca7d6 100%)',
    surface: 'linear-gradient(180deg, #667460 0%, #1f3429 100%)',
    accent: '#66c8ff',
    glow: 'rgba(80, 185, 255, 0.32)',
    detail: 'Reference surface; atmosphere ignored',
  },
  mars: {
    sky: 'linear-gradient(180deg, #170c0a 0%, #7c2f1c 62%, #c4663e 100%)',
    surface: 'linear-gradient(180deg, #b85b36 0%, #522517 100%)',
    accent: '#ff8657',
    glow: 'rgba(255, 112, 68, 0.3)',
    detail: 'Rocky iron-rich surface',
  },
  jupiter: {
    sky: 'linear-gradient(180deg, #120d16 0%, #563a37 55%, #a7785e 100%)',
    surface: 'repeating-linear-gradient(180deg, #d7a879 0 10px, #8b5d4d 10px 20px, #ead0a6 20px 31px)',
    accent: '#f2bd86',
    glow: 'rgba(241, 185, 124, 0.34)',
    detail: 'Fictional cloud-top platform',
  },
  saturn: {
    sky: 'linear-gradient(180deg, #0b0b16 0%, #504633 58%, #b8a277 100%)',
    surface: 'repeating-linear-gradient(180deg, #d9c596 0 12px, #9a845f 12px 22px, #eadbb4 22px 32px)',
    accent: '#e3ce99',
    glow: 'rgba(232, 208, 153, 0.32)',
    detail: 'Fictional cloud-top platform',
  },
  uranus: {
    sky: 'linear-gradient(180deg, #06131a 0%, #194d59 58%, #70c0c6 100%)',
    surface: 'linear-gradient(180deg, #8bd5d8 0%, #397981 100%)',
    accent: '#9be2e4',
    glow: 'rgba(132, 222, 226, 0.3)',
    detail: 'Fictional cloud-top platform',
  },
  neptune: {
    sky: 'linear-gradient(180deg, #030719 0%, #102b72 58%, #2459b8 100%)',
    surface: 'linear-gradient(180deg, #356fce 0%, #142d69 100%)',
    accent: '#6c9dff',
    glow: 'rgba(71, 123, 255, 0.34)',
    detail: 'Fictional cloud-top platform',
  },
}

const OUTCOME_COPY: Record<LandingOutcome, {
  gameLabel: string
  engineeringLabel: string
  text: string
  border: string
}> = {
  SAFE_APPROACH: {
    gameLabel: 'Landing secured',
    engineeringLabel: 'Safe approach',
    text: 'text-success',
    border: 'border-success/50 bg-success/10',
  },
  MARGINAL: {
    gameLabel: 'Close call',
    engineeringLabel: 'Marginal',
    text: 'text-warning',
    border: 'border-warning/50 bg-warning/10',
  },
  CRASH_LIKELY: {
    gameLabel: 'Surface impact',
    engineeringLabel: 'Crash likely',
    text: 'text-destructive',
    border: 'border-destructive/50 bg-destructive/10',
  },
}

export default function LandingConsole() {
  const [planetId, setPlanetId] = useState<PlanetId>('earth')
  const [values, setValues] = useState<FieldValues>(INITIAL_VALUES)
  const [assessment, setAssessment] = useState<LandingAssessment | null>(null)
  const [phase, setPhase] = useState<FlightPhase>('ready')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<NumericField, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const animationTimer = useRef<number | null>(null)
  const toast = useToast()
  const { isSignedIn } = useAuthProfileReady({ requireUser: true })
  const { records, status, error: queryError } = useQuery<LandingCheckRecord>('descent-attempts', {
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 10,
  })
  const { ready, removeConfirmed } = useMutations<LandingCheckRecord>('descent-attempts')

  const telemetry = useMemo<LandingTelemetry>(
    () => ({
      planetId,
      heightMeters: parseField(values.heightMeters),
      descentSpeedMetersPerSecond: parseField(values.descentSpeedMetersPerSecond),
      enginePowerPercent: parseField(values.enginePowerPercent),
      tiltDegrees: parseField(values.tiltDegrees),
    }),
    [planetId, values],
  )
  const planet = getPlanet(planetId)
  const art = PLANET_ART[planetId]

  useEffect(() => () => {
    if (animationTimer.current !== null) window.clearTimeout(animationTimer.current)
  }, [])

  const resetResult = () => {
    if (animationTimer.current !== null) window.clearTimeout(animationTimer.current)
    animationTimer.current = null
    setAssessment(null)
    setPhase('ready')
  }

  const choosePlanet = (nextPlanetId: PlanetId) => {
    setPlanetId(nextPlanetId)
    resetResult()
  }

  const updateValue = (field: NumericField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    resetResult()
  }

  const runDescent = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting || phase === 'running') return

    const localResult = assessLanding(telemetry)
    if (!localResult.valid) {
      setFieldErrors(
        Object.fromEntries(
          localResult.issues.flatMap((issue) =>
            issue.field === 'planetId' ? [] : [[issue.field, issue.message]],
          ),
        ),
      )
      resetResult()
      return
    }

    if (!isSignedIn) {
      setShowAuthModal(true)
      return
    }

    setFieldErrors({})
    setSubmitting(true)
    resetResult()
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Your sign-in session is unavailable. Please sign in again.')
      const response = await fetch('/api/actions/runDescent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(telemetry),
      })
      const payload = (await response.json()) as ActionResponse
      if (!response.ok || !payload.success || !payload.data) {
        if (payload.issues) {
          const issues = payload.issues.flatMap((issue) => {
            const field = issue.path[0] as NumericField | undefined
            return field && field !== ('planetId' as NumericField)
              ? [[field, issue.message] as const]
              : []
          })
          setFieldErrors(Object.fromEntries(issues))
        }
        throw new Error(payload.error ?? 'The descent could not be completed.')
      }

      setAssessment(payload.data.assessment)
      setPhase('running')
      animationTimer.current = window.setTimeout(() => {
        setPhase('complete')
        animationTimer.current = null
      }, 1900)
    } catch (error) {
      toast.error(
        'Could not run the descent',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const deleteAttempt = async (recordId: string) => {
    if (deletingId) return
    setDeletingId(recordId)
    try {
      await removeConfirmed(recordId)
      toast.success('Attempt deleted', 'The saved descent was removed from your flight log.')
    } catch (error) {
      toast.error(
        'Could not delete the attempt',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  const brakingZoneOffsetPixels = assessment
    ? Math.min(Math.max(assessment.stoppingRatio ?? 1, 0), 1) * 180
    : 0
  const touchdownClass =
    phase !== 'complete' || !assessment
      ? ''
      : assessment.outcome === 'SAFE_APPROACH'
        ? 'lander-success'
        : assessment.outcome === 'CRASH_LIKELY'
          ? 'lander-crash'
          : 'lander-marginal'
  const landerStyle = {
    '--lander-tilt': `${telemetry.tiltDegrees}deg`,
    '--planet-accent': art.accent,
    '--engine-power': phase === 'complete' ? 0 : Math.max(0.08, telemetry.enginePowerPercent / 100),
  } as CSSProperties

  return (
    <div className="min-h-full bg-background text-foreground">
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Planetary descent sandbox · Model 02
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Choose a world. Try to land.</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 font-mono text-xs text-muted-foreground">
            <Gauge className="size-4 text-primary" aria-hidden />
            MAX ENGINE {MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED} m/s²
          </div>
        </header>

        <section aria-label="Choose a planet" className="mb-5 overflow-x-auto rounded-2xl border border-border bg-card/65 p-2">
          <div className="grid min-w-[760px] grid-cols-8 gap-1">
            {PLANETS.map((candidate) => {
              const candidateArt = PLANET_ART[candidate.id]
              const selected = candidate.id === planetId
              return (
                <button
                  key={candidate.id}
                  type="button"
                  data-testid={`planet-${candidate.id}`}
                  aria-pressed={selected}
                  onClick={() => choosePlanet(candidate.id)}
                  className={`group flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <span
                    className="size-3 rounded-full border border-white/20 shadow-[inset_-2px_-2px_4px_rgba(0,0,0,0.35)]"
                    style={{ backgroundColor: candidateArt.accent }}
                    aria-hidden
                  />
                  {candidate.name}
                </button>
              )
            })}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
          <section
            data-testid="descent-stage"
            className="relative min-h-[420px] overflow-hidden rounded-3xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
            style={{ background: art.sky }}
          >
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,255,255,0.85)_0.7px,transparent_0.7px)] [background-size:43px_43px]" />
            <div
              className="absolute left-1/2 top-[-180px] size-[420px] -translate-x-1/2 rounded-full blur-3xl"
              style={{ backgroundColor: art.glow }}
              aria-hidden
            />

            <div className="absolute left-4 top-4 z-20 rounded-xl border border-white/15 bg-black/25 px-3 py-2 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">{planet.name}</p>
              <p className="mt-1 font-mono text-sm text-white">Gravity {planet.gravity} m/s²</p>
            </div>
            <div className="absolute right-4 top-4 z-20 text-right">
              <p className="font-mono text-2xl font-semibold text-white">{formatNumber(telemetry.heightMeters)} m</p>
              <p className="text-xs text-white/55">starting altitude</p>
            </div>

            <div
              data-testid="lander"
              className={`lander absolute left-1/2 z-20 motion-reduce:transition-none ${
                phase === 'running' ? 'lander-running' : ''
              } ${phase === 'complete' ? 'lander-complete' : ''} ${touchdownClass}`}
              style={landerStyle}
              aria-label={`Lander above ${planet.name}`}
            >
              <div className="lander-touchdown">
                <LanderGraphic />
              </div>
            </div>

            {phase === 'complete' && assessment?.outcome === 'SAFE_APPROACH' && (
              <div
                data-testid="success-animation"
                className="touchdown-effects absolute bottom-[68px] left-1/2 z-30"
                aria-hidden
              >
                <span className="success-ring" />
                <span className="success-ring success-ring-delayed" />
                <span className="touchdown-spark spark-1" />
                <span className="touchdown-spark spark-2" />
                <span className="touchdown-spark spark-3" />
                <span className="touchdown-spark spark-4" />
                <span className="touchdown-spark spark-5" />
                <span className="touchdown-spark spark-6" />
              </div>
            )}

            {assessment && assessment.stoppingDistanceMeters !== null && (
              <div
                className="absolute bottom-[78px] left-1/2 z-10 w-24 -translate-x-1/2 rounded-full border border-dashed border-white/35 bg-white/5 px-2 py-1 text-center text-[10px] uppercase tracking-widest text-white/60"
                style={{ transform: `translateX(-50%) translateY(${-brakingZoneOffsetPixels}px)` }}
              >
                braking zone
              </div>
            )}

            {phase === 'complete' && assessment?.outcome === 'CRASH_LIKELY' && (
              <div
                data-testid="crash-animation"
                className="touchdown-effects absolute bottom-[64px] left-1/2 z-30"
                aria-hidden
              >
                <span className="impact-flash" />
                <span className="impact-burst" />
                <span className="impact-debris debris-1" />
                <span className="impact-debris debris-2" />
                <span className="impact-debris debris-3" />
                <span className="impact-debris debris-4" />
                <span className="impact-debris debris-5" />
                <span className="impact-debris debris-6" />
              </div>
            )}

            <div
              className="absolute inset-x-0 bottom-0 z-10 h-[76px] border-t border-white/20"
              style={{ background: art.surface }}
            >
              <div className="absolute inset-x-0 top-2 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60">
                <span className="h-px w-8 bg-white/25" />
                {planet.surfaceKind}
                <span className="h-px w-8 bg-white/25" />
              </div>
              <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/45">{art.detail}</p>
            </div>

            <div className="absolute bottom-[90px] left-4 z-20 font-mono text-xs text-white/55">
              ↓ {formatNumber(telemetry.descentSpeedMetersPerSecond)} m/s
            </div>
          </section>

          <form noValidate onSubmit={(event) => void runDescent(event)} className="rounded-3xl border border-border bg-card p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Flight controls</h2>
                <p className="mt-1 text-xs text-muted-foreground">Tune all four values, then run the descent.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setValues(INITIAL_VALUES)
                  setFieldErrors({})
                  resetResult()
                }}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Reset flight controls"
              >
                <RotateCcw className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {CONTROLS.map((control) => (
                <TelemetryControl
                  key={control.name}
                  {...control}
                  value={values[control.name]}
                  error={fieldErrors[control.name]}
                  accent={art.accent}
                  disabled={submitting || phase === 'running'}
                  onChange={(value) => updateValue(control.name, value)}
                />
              ))}
            </div>

            <Button
              data-testid="run-descent"
              className="mt-6 w-full"
              type="submit"
              size="lg"
              loading={submitting}
              disabled={phase === 'running'}
            >
              {phase === 'running' ? 'Descent in progress…' : 'Run descent'}
            </Button>
            {!isSignedIn && (
              <p className="mt-3 text-center text-xs text-muted-foreground">Sign in when you run your first descent to save the attempt.</p>
            )}
          </form>
        </div>

        <section className="mt-5" data-testid="landing-result" aria-live="polite">
          {assessment ? (
            <AssessmentPanel assessment={assessment} phase={phase} />
          ) : (
            <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-border bg-card/35 px-5 text-center">
              <p className="text-sm text-muted-foreground">
                Select a planet, tune the flight controls, and run the descent.
              </p>
            </div>
          )}
        </section>

        <section data-testid="landing-history" className="mt-5 rounded-2xl border border-border bg-card/55 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Flight log</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Your recent attempts update live across signed-in sessions.</p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{records.length}/10</span>
          </div>

          {status === 'loading' ? (
            <div className="mt-4 flex gap-3 overflow-hidden" aria-label="Loading flight log">
              {[0, 1, 2].map((item) => <div key={item} className="h-28 min-w-64 animate-pulse rounded-xl bg-muted/50" />)}
            </div>
          ) : status === 'error' ? (
            <p className="mt-4 text-sm text-destructive">{queryError ?? 'The flight log could not be loaded.'}</p>
          ) : records.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              {isSignedIn ? 'No attempts yet. Your first descent will appear here.' : 'Sign in to create a private flight log.'}
            </p>
          ) : (
            <ol className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {records.map((record) => (
                <AttemptCard
                  key={record.recordId}
                  record={record}
                  deleting={deletingId === record.recordId}
                  canDelete={ready}
                  onDelete={() => void deleteAttempt(record.recordId)}
                />
              ))}
            </ol>
          )}
        </section>

        <footer className="px-2 py-6 text-center text-xs leading-5 text-muted-foreground">
          Simplified educational model: constant power and tilt, no atmosphere or horizontal motion. Gas giants use a fictional cloud-top reference platform.
        </footer>
      </main>

      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </div>
  )
}

function TelemetryControl({
  name,
  label,
  shortLabel,
  unit,
  min,
  max,
  step,
  value,
  error,
  accent,
  disabled,
  onChange,
}: {
  name: NumericField
  label: string
  shortLabel: string
  unit: string
  min: number
  max: number
  step: number
  value: string
  error?: string
  accent: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label htmlFor={`landing-${name}`}>{label}</Label>
        <div className="flex items-center gap-1.5">
          <Input
            id={`landing-${name}`}
            data-testid={`landing-${name}`}
            type="number"
            min={min}
            max={max}
            step="any"
            value={value}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-label={`${shortLabel} exact value`}
            onChange={(event) => onChange(event.target.value)}
            className="h-8 w-24 px-2 text-right font-mono text-xs"
          />
          <span className="w-8 text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(Number(value)) ? value : min}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="planet-slider w-full"
        style={{ accentColor: accent }}
        aria-label={`${shortLabel} slider`}
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

function LanderGraphic() {
  return (
    <svg width="76" height="94" viewBox="0 0 76 94" role="img" aria-label="Planetary lander">
      <defs>
        <linearGradient id="lander-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6f7f9" />
          <stop offset="1" stopColor="#7e8997" />
        </linearGradient>
        <linearGradient id="engine-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7c2" />
          <stop offset="0.45" stopColor="var(--planet-accent)" />
          <stop offset="1" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d="M27 58 L15 80 M49 58 L61 80 M9 80 H22 M54 80 H67" fill="none" stroke="#d8dee8" strokeWidth="3" strokeLinecap="round" />
      <path d="M23 22 Q38 6 53 22 L58 57 Q38 67 18 57 Z" fill="url(#lander-body)" stroke="#f8fafc" strokeWidth="1.5" />
      <circle cx="38" cy="31" r="9" fill="#10233f" stroke="var(--planet-accent)" strokeWidth="2" />
      <path d="M26 17 L22 7 M50 17 L54 7 M19 48 L8 43 M57 48 L68 43" stroke="#d8dee8" strokeWidth="3" strokeLinecap="round" />
      <rect x="29" y="58" width="18" height="8" rx="2" fill="#697586" />
      <path
        d="M31 66 Q38 94 45 66 Z"
        fill="url(#engine-flame)"
        opacity="var(--engine-power)"
      />
    </svg>
  )
}

function AssessmentPanel({ assessment, phase }: { assessment: LandingAssessment; phase: FlightPhase }) {
  const copy = OUTCOME_COPY[assessment.outcome]
  return (
    <div className={`grid gap-4 rounded-2xl border p-5 sm:grid-cols-[1fr_auto] sm:items-center ${copy.border}`}>
      <div className="flex items-start gap-3">
        {assessment.outcome === 'SAFE_APPROACH' ? (
          <ShieldCheck className={`mt-1 size-6 shrink-0 ${copy.text}`} aria-hidden />
        ) : (
          <TriangleAlert className={`mt-1 size-6 shrink-0 ${copy.text}`} aria-hidden />
        )}
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className={`text-2xl font-bold ${copy.text}`}>
              {phase === 'running' ? 'Descent in progress…' : copy.gameLabel}
            </h2>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{copy.engineeringLabel}</span>
          </div>
          <p className="mt-1 text-sm text-foreground">{assessment.explanation}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ResultMetric label="Stopping distance" value={formatMetric(assessment.stoppingDistanceMeters, 'm')} />
        <ResultMetric label="Altitude remaining" value={formatMetric(assessment.altitudeMarginMeters, 'm')} />
        <ResultMetric label="Minimum safe power" value={formatMetric(assessment.requiredThrottlePercent, '%')} />
        <ResultMetric label="Power margin" value={formatMetric(assessment.powerAboveMinimumPercent, '%')} />
      </dl>
    </div>
  )
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-32 rounded-xl border border-border/60 bg-background/55 px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold">{value}</dd>
    </div>
  )
}

function AttemptCard({
  record,
  deleting,
  canDelete,
  onDelete,
}: {
  record: { recordId: string; createdAt: string; data: LandingCheckRecord }
  deleting: boolean
  canDelete: boolean
  onDelete: () => void
}) {
  const attemptPlanet = getPlanet(record.data.planetId)
  const copy = OUTCOME_COPY[record.data.outcome]
  return (
    <li className="min-w-72 rounded-xl border border-border bg-background/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{attemptPlanet.name}</p>
          <p className={`mt-1 text-sm font-semibold ${copy.text}`}>{copy.gameLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${attemptPlanet.name} descent attempt`}
          disabled={!canDelete || deleting}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
      <p className="mt-3 text-xs text-foreground">
        {formatNumber(record.data.heightMeters)} m · {formatNumber(record.data.descentSpeedMetersPerSecond)} m/s · {formatNumber(record.data.enginePowerPercent)}% power
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(record.createdAt)}</p>
    </li>
  )
}

function parseField(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

function formatMetric(value: number | null, unit: string): string {
  return value === null ? 'Not achievable' : `${formatNumber(value)} ${unit}`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
