import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  AuthOverlay,
  getAuthToken,
  useAuth,
  useMutations,
  useQuery,
} from 'deepspace'
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { Button, Input, Label, useToast } from '@/components/ui'
import { ChatPanel } from '@/components/ChatPanel'
import {
  FLIGHT_TICKS_PER_SECOND,
  FLIGHT_TIME_STEP_SECONDS,
  MAX_STARTING_ALTITUDE_METERS,
  MAX_STARTING_HORIZONTAL_SPEED_METERS_PER_SECOND,
  MAX_STARTING_VERTICAL_SPEED_METERS_PER_SECOND,
  MIN_STARTING_ALTITUDE_METERS,
  appendControlEvent,
  createInitialFlightState,
  stepFlight,
  validateInitialConditions,
  type FlightControlEvent,
  type FlightControls,
  type FlightInitialConditions,
  type FlightResult,
  type FlightRunRecord,
  type FlightState,
} from '@/domain/flight'
import {
  MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED,
  PLANETS,
  getPlanet,
  type LandingOutcome,
  type PlanetId,
} from '@/domain/landing'

type ConsoleMode = 'setup' | 'flying' | 'paused' | 'complete'
type InitialField = Exclude<keyof FlightInitialConditions, 'planetId'>
type InitialFieldValues = Record<InitialField, string>

interface CompleteFlightResponse {
  success: boolean
  data?: { recordId: string; result: FlightResult; totalTicks: number }
  error?: string
  issues?: Array<{ path: string[]; message: string }>
}

const INITIAL_VALUES: InitialFieldValues = {
  altitudeMeters: '300',
  verticalSpeedMetersPerSecond: '10',
  horizontalSpeedMetersPerSecond: '8',
}

const INITIAL_CONTROLS: FlightControls = {
  throttlePercent: 0,
  rotationDirection: 0,
}

const SETUP_CONTROLS: Array<{
  name: InitialField
  label: string
  hint: string
  unit: string
  min: number
  max: number
  step: number
}> = [
  {
    name: 'altitudeMeters',
    label: 'Starting altitude',
    hint: 'How much room you have to slow down',
    unit: 'm',
    min: MIN_STARTING_ALTITUDE_METERS,
    max: MAX_STARTING_ALTITUDE_METERS,
    step: 10,
  },
  {
    name: 'verticalSpeedMetersPerSecond',
    label: 'Downward speed',
    hint: 'How quickly the surface is approaching',
    unit: 'm/s',
    min: 0,
    max: MAX_STARTING_VERTICAL_SPEED_METERS_PER_SECOND,
    step: 1,
  },
  {
    name: 'horizontalSpeedMetersPerSecond',
    label: 'Horizontal drift',
    hint: 'Negative is left; positive is right',
    unit: 'm/s',
    min: -MAX_STARTING_HORIZONTAL_SPEED_METERS_PER_SECOND,
    max: MAX_STARTING_HORIZONTAL_SPEED_METERS_PER_SECOND,
    step: 1,
  },
]

const PLANET_ART: Record<PlanetId, {
  sky: string
  surface: string
  accent: string
  glow: string
  detail: string
}> = {
  mercury: { sky: 'linear-gradient(180deg, #09090b 0%, #27211d 100%)', surface: 'linear-gradient(180deg, #91877b 0%, #3f3933 100%)', accent: '#c9b8a1', glow: 'rgba(224,205,180,.28)', detail: 'Airless reference surface' },
  venus: { sky: 'linear-gradient(180deg, #30130c 0%, #a2471f 62%, #d68d45 100%)', surface: 'linear-gradient(180deg, #9c4d27 0%, #442013 100%)', accent: '#ffb45d', glow: 'rgba(255,160,74,.34)', detail: 'Flat reference surface; atmosphere omitted' },
  earth: { sky: 'linear-gradient(180deg, #050a18 0%, #123c66 65%, #5ca7d6 100%)', surface: 'linear-gradient(180deg, #667460 0%, #1f3429 100%)', accent: '#66c8ff', glow: 'rgba(80,185,255,.32)', detail: 'Flat reference surface; atmosphere omitted' },
  mars: { sky: 'linear-gradient(180deg, #170c0a 0%, #7c2f1c 62%, #c4663e 100%)', surface: 'linear-gradient(180deg, #b85b36 0%, #522517 100%)', accent: '#ff8657', glow: 'rgba(255,112,68,.3)', detail: 'Flat iron-rich reference surface' },
  jupiter: { sky: 'linear-gradient(180deg, #120d16 0%, #563a37 55%, #a7785e 100%)', surface: 'repeating-linear-gradient(180deg, #d7a879 0 10px, #8b5d4d 10px 20px, #ead0a6 20px 31px)', accent: '#f2bd86', glow: 'rgba(241,185,124,.34)', detail: 'Fictional cloud-top platform' },
  saturn: { sky: 'linear-gradient(180deg, #0b0b16 0%, #504633 58%, #b8a277 100%)', surface: 'repeating-linear-gradient(180deg, #d9c596 0 12px, #9a845f 12px 22px, #eadbb4 22px 32px)', accent: '#e3ce99', glow: 'rgba(232,208,153,.32)', detail: 'Fictional cloud-top platform' },
  uranus: { sky: 'linear-gradient(180deg, #06131a 0%, #194d59 58%, #70c0c6 100%)', surface: 'linear-gradient(180deg, #8bd5d8 0%, #397981 100%)', accent: '#9be2e4', glow: 'rgba(132,222,226,.3)', detail: 'Fictional cloud-top platform' },
  neptune: { sky: 'linear-gradient(180deg, #030719 0%, #102b72 58%, #2459b8 100%)', surface: 'linear-gradient(180deg, #356fce 0%, #142d69 100%)', accent: '#6c9dff', glow: 'rgba(71,123,255,.34)', detail: 'Fictional cloud-top platform' },
}

const OUTCOME_COPY: Record<LandingOutcome, {
  gameLabel: string
  engineeringLabel: string
  text: string
  border: string
}> = {
  SAFE_APPROACH: { gameLabel: 'Landing secured', engineeringLabel: 'Safe touchdown', text: 'text-success', border: 'border-success/50 bg-success/10' },
  MARGINAL: { gameLabel: 'Close call', engineeringLabel: 'Marginal touchdown', text: 'text-warning', border: 'border-warning/50 bg-warning/10' },
  CRASH_LIKELY: { gameLabel: 'Surface impact', engineeringLabel: 'Crash', text: 'text-destructive', border: 'border-destructive/50 bg-destructive/10' },
}

export default function LiveFlightConsole() {
  const [planetId, setPlanetId] = useState<PlanetId>('earth')
  const [values, setValues] = useState<InitialFieldValues>(INITIAL_VALUES)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<InitialField, string>>>({})
  const [mode, setMode] = useState<ConsoleMode>('setup')
  const [flight, setFlight] = useState<FlightState | null>(null)
  const [controls, setControls] = useState<FlightControls>(INITIAL_CONTROLS)
  const [verifiedResult, setVerifiedResult] = useState<FlightResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [stageHeight, setStageHeight] = useState(520)
  const stageRef = useRef<HTMLElement>(null)
  const flightRef = useRef<FlightState | null>(null)
  const controlsRef = useRef<FlightControls>(INITIAL_CONTROLS)
  const commandsRef = useRef<FlightControlEvent[]>([])
  const activeInitialRef = useRef<FlightInitialConditions | null>(null)
  const persistedTickRef = useRef<number | null>(null)
  const toast = useToast()
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { records, status, error: queryError } = useQuery<FlightRunRecord>('flight-runs', {
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 10,
  })
  const { ready, removeConfirmed } = useMutations<FlightRunRecord>('flight-runs')

  const initial = useMemo<FlightInitialConditions>(() => ({
    planetId,
    altitudeMeters: parseField(values.altitudeMeters),
    verticalSpeedMetersPerSecond: parseField(values.verticalSpeedMetersPerSecond),
    horizontalSpeedMetersPerSecond: parseField(values.horizontalSpeedMetersPerSecond),
  }), [planetId, values])
  const planet = getPlanet(planetId)
  const art = PLANET_ART[planetId]
  const result = verifiedResult ?? flight?.result ?? null

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const update = () => setStageHeight(element.getBoundingClientRect().height)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const persistCompletedFlight = useCallback(async (finalState: FlightState) => {
    if (!finalState.result || persistedTickRef.current === finalState.tick) return
    const flightInitial = activeInitialRef.current
    if (!flightInitial) return
    persistedTickRef.current = finalState.tick
    setSaving(true)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Your sign-in session is unavailable. Please sign in again.')
      const response = await fetch('/api/actions/completeFlight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ initial: flightInitial, commands: commandsRef.current }),
      })
      const payload = (await response.json()) as CompleteFlightResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'The verified flight could not be saved.')
      }
      setVerifiedResult(payload.data.result)
    } catch (error) {
      persistedTickRef.current = null
      toast.error('Flight finished but was not saved', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }, [toast])

  useEffect(() => {
    if (mode !== 'flying') return
    let animationFrame = 0
    let previousTime = performance.now()
    let accumulator = 0
    const frame = (now: number) => {
      const elapsed = Math.min((now - previousTime) / 1_000, 0.1)
      previousTime = now
      accumulator += elapsed
      let next = flightRef.current
      if (!next) return
      while (accumulator >= FLIGHT_TIME_STEP_SECONDS && next.phase === 'flying') {
        next = stepFlight(next, controlsRef.current, planet.gravity)
        accumulator -= FLIGHT_TIME_STEP_SECONDS
      }
      flightRef.current = next
      setFlight(next)
      if (next.phase === 'complete') {
        setMode('complete')
        setVerifiedResult(next.result)
        void persistCompletedFlight(next)
        return
      }
      animationFrame = requestAnimationFrame(frame)
    }
    animationFrame = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animationFrame)
  }, [mode, persistCompletedFlight, planet.gravity])

  const commitControls = useCallback((patch: Partial<FlightControls>) => {
    const next: FlightControls = {
      throttlePercent: clamp(patch.throttlePercent ?? controlsRef.current.throttlePercent, 0, 100),
      rotationDirection: patch.rotationDirection ?? controlsRef.current.rotationDirection,
    }
    controlsRef.current = next
    setControls(next)
    const current = flightRef.current
    if (current && (mode === 'flying' || mode === 'paused')) {
      commandsRef.current = appendControlEvent(commandsRef.current, { tick: current.tick, ...next })
    }
  }, [mode])

  useEffect(() => {
    if (mode !== 'flying' && mode !== 'paused') return
    const isFormControl = (target: EventTarget | null) =>
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
    const onKeyDown = (event: KeyboardEvent) => {
      if (isFormControl(event.target)) return
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key)) {
        event.preventDefault()
      }
      if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') {
        commitControls({ throttlePercent: controlsRef.current.throttlePercent + 5 })
      } else if (event.key === 's' || event.key === 'S' || event.key === 'ArrowDown') {
        commitControls({ throttlePercent: controlsRef.current.throttlePercent - 5 })
      } else if (event.key === 'a' || event.key === 'A' || event.key === 'ArrowLeft') {
        commitControls({ rotationDirection: -1 })
      } else if (event.key === 'd' || event.key === 'D' || event.key === 'ArrowRight') {
        commitControls({ rotationDirection: 1 })
      } else if (event.key === ' ') {
        commitControls({ throttlePercent: 0 })
      } else if (event.key === 'p' || event.key === 'P') {
        setMode((current) => current === 'flying' ? 'paused' : 'flying')
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (
        (['a', 'A', 'ArrowLeft'].includes(event.key) && controlsRef.current.rotationDirection === -1) ||
        (['d', 'D', 'ArrowRight'].includes(event.key) && controlsRef.current.rotationDirection === 1)
      ) {
        commitControls({ rotationDirection: 0 })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [commitControls, mode])

  const startFlight = () => {
    const issues = validateInitialConditions(initial)
    if (issues.length > 0) {
      setFieldErrors(Object.fromEntries(issues.flatMap((issue) =>
        issue.field === 'planetId' || issue.field === 'commands' ? [] : [[issue.field, issue.message]],
      )))
      return
    }
    if (!isSignedIn) {
      setShowAuthModal(true)
      return
    }
    const nextFlight = createInitialFlightState(initial)
    activeInitialRef.current = initial
    flightRef.current = nextFlight
    controlsRef.current = INITIAL_CONTROLS
    commandsRef.current = [{ tick: 0, ...INITIAL_CONTROLS }]
    persistedTickRef.current = null
    setFlight(nextFlight)
    setControls(INITIAL_CONTROLS)
    setVerifiedResult(null)
    setFieldErrors({})
    setMode('flying')
  }

  const resetFlight = () => {
    flightRef.current = null
    activeInitialRef.current = null
    commandsRef.current = []
    controlsRef.current = INITIAL_CONTROLS
    persistedTickRef.current = null
    setFlight(null)
    setControls(INITIAL_CONTROLS)
    setVerifiedResult(null)
    setMode('setup')
  }

  const deleteRun = async (recordId: string) => {
    if (deletingId) return
    setDeletingId(recordId)
    try {
      await removeConfirmed(recordId)
      toast.success('Flight deleted', 'The saved flight was removed from your log.')
    } catch (error) {
      toast.error('Could not delete the flight', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const currentInitial = activeInitialRef.current ?? initial
  const altitudeProgress = flight
    ? clamp(1 - flight.altitudeMeters / currentInitial.altitudeMeters, 0, 1)
    : 0
  const landerTop = 70 + altitudeProgress * Math.max(0, stageHeight - 226)
  const landerLeft = flight
    ? clamp(50 + flight.horizontalPositionMeters * 0.12, 8, 92)
    : 50
  const landerStyle = {
    left: `${landerLeft}%`,
    top: `${landerTop}px`,
    '--lander-tilt': `${flight?.angleDegrees ?? 0}deg`,
    '--planet-accent': art.accent,
    '--engine-power': mode === 'complete' ? 0 : controls.throttlePercent / 100,
  } as CSSProperties
  const touchdownClass =
    mode !== 'complete' || !result
      ? ''
      : result.outcome === 'SAFE_APPROACH'
        ? 'lander-success'
        : result.outcome === 'CRASH_LIKELY'
          ? 'lander-crash'
          : 'lander-marginal'
  const warning = mode === 'complete' && result
    ? touchdownNotice(result)
    : flight
      ? flightWarning(flight)
      : { text: 'Configure the approach, then take control.', tone: 'border-white/15 text-white/75' }

  return (
    <div className="min-h-full bg-background text-foreground">
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Live planetary landing simulator · Model 03</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">You have the controls.</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 font-mono text-xs text-muted-foreground">
            <Gauge className="size-4 text-primary" aria-hidden />
            MAX ENGINE {MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED} m/s²
          </div>
        </header>

        <section aria-label="Choose a planet" className="mb-5 overflow-x-auto rounded-2xl border border-border bg-card/65 p-2">
          <div className="grid min-w-[760px] grid-cols-8 gap-1">
            {PLANETS.map((candidate) => {
              const selected = candidate.id === planetId
              return (
                <button
                  key={candidate.id}
                  type="button"
                  data-testid={`planet-${candidate.id}`}
                  aria-pressed={selected}
                  disabled={mode !== 'setup'}
                  onClick={() => setPlanetId(candidate.id)}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                >
                  <span className="size-3 rounded-full border border-white/20 shadow-[inset_-2px_-2px_4px_rgba(0,0,0,.35)]" style={{ backgroundColor: PLANET_ART[candidate.id].accent }} aria-hidden />
                  {candidate.name}
                </button>
              )
            })}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,.75fr)]">
          <section
            ref={stageRef}
            data-testid="flight-stage"
            className="relative min-h-[520px] overflow-hidden rounded-3xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,.35)]"
            style={{ background: art.sky }}
          >
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,255,255,.85)_.7px,transparent_.7px)] [background-size:43px_43px]" />
            <div className="absolute left-1/2 top-[-180px] size-[420px] -translate-x-1/2 rounded-full blur-3xl" style={{ backgroundColor: art.glow }} aria-hidden />

            <div className="absolute left-4 top-4 z-20 rounded-xl border border-white/15 bg-black/25 px-3 py-2 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[.2em] text-white/55">{planet.name}</p>
              <p className="mt-1 font-mono text-sm text-white">Gravity {planet.gravity} m/s²</p>
            </div>
            <div className="absolute right-4 top-4 z-20 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-right backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[.2em] text-white/55">{mode}</p>
              <p className="mt-1 font-mono text-sm text-white">{formatNumber(flight?.tick ? flight.tick / FLIGHT_TICKS_PER_SECOND : 0)} s</p>
            </div>

            <div data-testid="live-lander" className={`live-lander absolute z-20 ${touchdownClass}`} style={landerStyle} aria-label={`Live lander above ${planet.name}`}>
              <div className="lander-touchdown"><LanderGraphic /></div>
            </div>

            {mode === 'complete' && result?.outcome === 'SAFE_APPROACH' && <SuccessEffect left={landerLeft} />}
            {mode === 'complete' && result?.outcome === 'CRASH_LIKELY' && <CrashEffect left={landerLeft} />}

            <div className="absolute inset-x-0 bottom-0 z-10 h-[76px] border-t border-white/20" style={{ background: art.surface }}>
              <div className="absolute inset-x-0 top-2 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[.25em] text-white/60">
                <span className="h-px w-8 bg-white/25" />{planet.surfaceKind}<span className="h-px w-8 bg-white/25" />
              </div>
              <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/45">{art.detail}</p>
            </div>

            <div className="absolute inset-x-4 bottom-[92px] z-20 grid grid-cols-3 gap-2 sm:grid-cols-6">
              <HudMetric label="Altitude" value={`${formatNumber(flight?.altitudeMeters ?? initial.altitudeMeters)} m`} />
              <HudMetric label="Vertical" value={`${formatSigned(flight?.verticalSpeedMetersPerSecond ?? initial.verticalSpeedMetersPerSecond)} m/s`} />
              <HudMetric label="Horizontal" value={`${formatSigned(flight?.horizontalSpeedMetersPerSecond ?? initial.horizontalSpeedMetersPerSecond)} m/s`} />
              <HudMetric label="Angle" value={`${formatSigned(flight?.angleDegrees ?? 0)}°`} />
              <HudMetric label="Throttle" value={`${formatNumber(controls.throttlePercent)}%`} />
              <HudMetric label="Fuel" value={`${formatNumber(flight?.fuelPercent ?? 100)}%`} />
            </div>

            <div className={`absolute left-4 top-24 z-20 max-w-[260px] rounded-lg border bg-black/30 px-3 py-2 text-xs backdrop-blur-sm ${warning.tone}`} data-testid="flight-warning">
              {warning.text}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-[0_18px_60px_rgba(0,0,0,.22)]">
            {mode === 'setup' ? (
              <PreflightControls
                values={values}
                errors={fieldErrors}
                accent={art.accent}
                onChange={(field, value) => {
                  setValues((current) => ({ ...current, [field]: value }))
                  setFieldErrors((current) => ({ ...current, [field]: undefined }))
                }}
                onReset={() => { setValues(INITIAL_VALUES); setFieldErrors({}) }}
                onStart={startFlight}
                authReady={isLoaded}
              />
            ) : (
              <PilotControls
                mode={mode}
                controls={controls}
                saving={saving}
                onThrottle={(value) => commitControls({ throttlePercent: value })}
                onRotate={(direction) => commitControls({ rotationDirection: direction })}
                onPause={() => setMode((current) => current === 'flying' ? 'paused' : 'flying')}
                onReset={resetFlight}
              />
            )}
          </section>
        </div>

        <section className="mt-5" data-testid="flight-result" aria-live="polite">
          {result ? <FlightResultPanel result={result} saving={saving} /> : (
            <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-border bg-card/35 px-5 text-center">
              <p className="text-sm text-muted-foreground">Start the flight, manage your energy, cancel horizontal drift, and reach the surface upright.</p>
            </div>
          )}
        </section>

        <section data-testid="flight-history" className="mt-5 rounded-2xl border border-border bg-card/55 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-semibold">Flight log</h2><p className="mt-0.5 text-xs text-muted-foreground">Verified V3 flights update live across signed-in sessions.</p></div>
            <span className="font-mono text-xs text-muted-foreground">{records.length}/10</span>
          </div>
          {status === 'loading' ? (
            <div className="mt-4 flex gap-3 overflow-hidden" aria-label="Loading flight log">{[0, 1, 2].map((item) => <div key={item} className="h-28 min-w-64 animate-pulse rounded-xl bg-muted/50" />)}</div>
          ) : status === 'error' ? (
            <p className="mt-4 text-sm text-destructive">{queryError ?? 'The flight log could not be loaded.'}</p>
          ) : records.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{isSignedIn ? 'Complete a flight to create your V3 log.' : 'Sign in to fly and create a private flight log.'}</p>
          ) : (
            <ol className="mt-4 flex gap-3 overflow-x-auto pb-2">{records.map((record) => <FlightCard key={record.recordId} record={record} deleting={deletingId === record.recordId} canDelete={ready} onDelete={() => void deleteRun(record.recordId)} />)}</ol>
          )}
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card/55" data-testid="flight-instructor">
          {isSignedIn && userId ? (
            <div className="h-[520px]">
              <ChatPanel
                chatId={null}
                userId={userId}
                compact
                className="bg-transparent"
                emptyStatePrompts={[
                  `Give me a short preflight briefing for ${planet.name} with ${formatNumber(initial.altitudeMeters)} m altitude, ${formatNumber(initial.verticalSpeedMetersPerSecond)} m/s downward speed, and ${formatSigned(initial.horizontalSpeedMetersPerSecond)} m/s horizontal drift.`,
                  'Debrief my most recent verified flight and give me two things to practice.',
                  'Explain how throttle, tilt, and fuel interact in this simulator.',
                ]}
                header={<div className="flex items-center gap-3 border-b border-border px-5 py-4"><span className="rounded-lg bg-primary/15 p-2 text-primary"><Bot className="size-5" aria-hidden /></span><div><h2 className="font-semibold">AI flight instructor</h2><p className="text-xs text-muted-foreground">Preflight guidance and verified-flight debriefs</p></div></div>}
              />
            </div>
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
              <Bot className="size-7 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold">AI flight instructor</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Sign in to get a preflight briefing or a debrief grounded in your verified flights.</p>
              <Button className="mt-4" onClick={() => setShowAuthModal(true)}>Sign in for coaching</Button>
            </div>
          )}
        </section>

        <footer className="px-2 py-6 text-center text-xs leading-5 text-muted-foreground">Deterministic 2D model: fixed-step gravity, thrust, horizontal motion, and finite fuel. Atmosphere, terrain, and orbit are intentionally omitted.</footer>
      </main>
      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </div>
  )
}

function PreflightControls({ values, errors, accent, onChange, onReset, onStart, authReady }: {
  values: InitialFieldValues
  errors: Partial<Record<InitialField, string>>
  accent: string
  onChange: (field: InitialField, value: string) => void
  onReset: () => void
  onStart: () => void
  authReady: boolean
}) {
  return <>
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Preflight conditions</h2><p className="mt-1 text-xs text-muted-foreground">Set the approach. Throttle and rotation unlock after launch.</p></div><button type="button" onClick={onReset} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Reset preflight conditions"><RotateCcw className="size-4" aria-hidden /></button></div>
    <div className="mt-5 space-y-5">{SETUP_CONTROLS.map((control) => <SetupControl key={control.name} {...control} value={values[control.name]} error={errors[control.name]} accent={accent} onChange={(value) => onChange(control.name, value)} />)}</div>
    <Button data-testid="start-flight" className="mt-6 w-full" type="button" size="lg" disabled={!authReady} onClick={onStart}><Play className="size-4" aria-hidden /> Begin flight</Button>
    <p className="mt-3 text-center text-xs text-muted-foreground">W/S throttle · A/D rotate · Space cuts engine · P pauses</p>
  </>
}

function PilotControls({ mode, controls, saving, onThrottle, onRotate, onPause, onReset }: {
  mode: ConsoleMode
  controls: FlightControls
  saving: boolean
  onThrottle: (value: number) => void
  onRotate: (direction: -1 | 0 | 1) => void
  onPause: () => void
  onReset: () => void
}) {
  const active = mode === 'flying' || mode === 'paused'
  const holdRotation = (direction: -1 | 1) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    onRotate(direction)
  }
  return <>
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Pilot controls</h2><p className="mt-1 text-xs text-muted-foreground">Make small corrections. Reach the surface slow, level, and with little drift.</p></div><Fuel className="mt-1 size-5 text-primary" aria-hidden /></div>
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between"><Label htmlFor="live-throttle">Throttle</Label><span className="font-mono text-xl font-semibold">{formatNumber(controls.throttlePercent)}%</span></div>
      <input id="live-throttle" data-testid="live-throttle" type="range" min="0" max="100" step="1" value={controls.throttlePercent} disabled={!active} onChange={(event) => onThrottle(Number(event.target.value))} className="planet-slider w-full" />
      <div className="mt-3 grid grid-cols-3 gap-2"><Button type="button" variant="outline" disabled={!active} onClick={() => onThrottle(controls.throttlePercent - 5)}>− 5%</Button><Button type="button" variant="outline" disabled={!active} onClick={() => onThrottle(0)}><Zap className="size-4" aria-hidden /> Cut</Button><Button type="button" variant="outline" disabled={!active} onClick={() => onThrottle(controls.throttlePercent + 5)}>+ 5%</Button></div>
    </div>
    <div className="mt-7"><div className="mb-2 flex items-center justify-between"><Label>Craft rotation</Label><span className="text-xs text-muted-foreground">Hold to rotate</span></div><div className="grid grid-cols-2 gap-3"><Button data-testid="rotate-left" type="button" size="lg" variant={controls.rotationDirection === -1 ? 'default' : 'outline'} disabled={!active} onPointerDown={holdRotation(-1)} onPointerUp={() => onRotate(0)} onPointerCancel={() => onRotate(0)} onPointerLeave={() => onRotate(0)}><ChevronLeft className="size-5" aria-hidden /> Left</Button><Button data-testid="rotate-right" type="button" size="lg" variant={controls.rotationDirection === 1 ? 'default' : 'outline'} disabled={!active} onPointerDown={holdRotation(1)} onPointerUp={() => onRotate(0)} onPointerCancel={() => onRotate(0)} onPointerLeave={() => onRotate(0)}>Right <ChevronRight className="size-5" aria-hidden /></Button></div></div>
    <div className="mt-7 grid grid-cols-2 gap-3">{mode !== 'complete' ? <Button data-testid="pause-flight" type="button" variant="outline" size="lg" onClick={onPause}>{mode === 'paused' ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}{mode === 'paused' ? 'Resume' : 'Pause'}</Button> : <div />}<Button data-testid="reset-flight" type="button" size="lg" disabled={saving} onClick={onReset}><RotateCcw className="size-4" aria-hidden /> {mode === 'complete' ? 'New flight' : 'Restart'}</Button></div>
    <div className="mt-5 rounded-xl border border-border bg-background/55 p-3 font-mono text-[11px] leading-5 text-muted-foreground"><p>W/S or ↑/↓ — throttle</p><p>A/D or ←/→ — rotate</p><p>Space — cut engine · P — pause</p></div>
  </>
}

function SetupControl({ name, label, hint, unit, min, max, step, value, error, accent, onChange }: (typeof SETUP_CONTROLS)[number] & { value: string; error?: string; accent: string; onChange: (value: string) => void }) {
  return <div><div className="mb-2 flex items-start justify-between gap-3"><div><Label htmlFor={`flight-${name}`}>{label}</Label><p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p></div><div className="flex items-center gap-1.5"><Input id={`flight-${name}`} data-testid={`flight-${name}`} type="number" min={min} max={max} step="any" value={value} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} className="h-8 w-24 px-2 text-right font-mono text-xs" /><span className="w-8 text-xs text-muted-foreground">{unit}</span></div></div><input type="range" min={min} max={max} step={step} value={Number.isFinite(Number(value)) ? value : min} onChange={(event) => onChange(event.target.value)} className="planet-slider w-full" style={{ accentColor: accent }} aria-label={`${label} slider`} /><div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground"><span>{min}</span><span>{max}</span></div>{error && <p className="mt-1 text-xs text-destructive">{error}</p>}</div>
}

function FlightResultPanel({ result, saving }: { result: FlightResult; saving: boolean }) {
  const copy = OUTCOME_COPY[result.outcome]
  return <div className={`grid gap-4 rounded-2xl border p-5 sm:grid-cols-[1fr_auto] sm:items-center ${copy.border}`}><div className="flex items-start gap-3">{result.outcome === 'SAFE_APPROACH' ? <ShieldCheck className={`mt-1 size-6 shrink-0 ${copy.text}`} aria-hidden /> : <TriangleAlert className={`mt-1 size-6 shrink-0 ${copy.text}`} aria-hidden />}<div><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className={`text-2xl font-bold ${copy.text}`}>{copy.gameLabel}</h2><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{copy.engineeringLabel}</span>{saving && <span className="text-xs text-muted-foreground">Verifying…</span>}</div><p className="mt-1 text-sm text-foreground">{result.explanation}</p></div></div><dl className="grid grid-cols-2 gap-2 sm:grid-cols-5"><ResultMetric label="Vertical" value={`${formatNumber(result.touchdownVerticalSpeed)} m/s`} /><ResultMetric label="Horizontal" value={`${formatSigned(result.touchdownHorizontalSpeed)} m/s`} /><ResultMetric label="Angle" value={`${formatSigned(result.touchdownAngleDegrees)}°`} /><ResultMetric label="Fuel" value={`${formatNumber(result.fuelRemainingPercent)}%`} /><ResultMetric label="Time" value={`${formatNumber(result.flightTimeSeconds)} s`} /></dl></div>
}

function HudMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-white/12 bg-black/35 px-2 py-2 backdrop-blur-sm"><p className="text-[9px] uppercase tracking-wider text-white/45">{label}</p><p className="mt-0.5 truncate font-mono text-xs font-semibold text-white">{value}</p></div> }
function ResultMetric({ label, value }: { label: string; value: string }) { return <div className="min-w-28 rounded-xl border border-border/60 bg-background/55 px-3 py-2.5"><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-sm font-semibold">{value}</dd></div> }

function FlightCard({ record, deleting, canDelete, onDelete }: { record: { recordId: string; createdAt: string; data: FlightRunRecord }; deleting: boolean; canDelete: boolean; onDelete: () => void }) {
  const runPlanet = getPlanet(record.data.planetId)
  const copy = OUTCOME_COPY[record.data.outcome]
  return <li className="min-w-72 rounded-xl border border-border bg-background/55 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[.16em] text-muted-foreground">{runPlanet.name}</p><p className={`mt-1 text-sm font-semibold ${copy.text}`}>{copy.gameLabel}</p></div><Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" aria-label={`Delete ${runPlanet.name} flight`} disabled={!canDelete || deleting} onClick={onDelete}><Trash2 className="size-3.5" aria-hidden /></Button></div><p className="mt-3 text-xs text-foreground">{formatNumber(record.data.touchdownVerticalSpeed)} m/s vertical · {formatNumber(Math.abs(record.data.touchdownHorizontalSpeed))} m/s horizontal</p><p className="mt-1 text-[11px] text-muted-foreground">Started {formatNumber(record.data.altitudeMeters)} m · {formatNumber(record.data.fuelRemainingPercent)}% fuel · {formatDate(record.createdAt)}</p></li>
}

function SuccessEffect({ left }: { left: number }) { return <div data-testid="success-animation" className="touchdown-effects absolute bottom-[68px] z-30" style={{ left: `${left}%` }} aria-hidden><span className="success-ring" /><span className="success-ring success-ring-delayed" />{[1, 2, 3, 4, 5, 6].map((item) => <span key={item} className={`touchdown-spark spark-${item}`} />)}</div> }
function CrashEffect({ left }: { left: number }) { return <div data-testid="crash-animation" className="touchdown-effects absolute bottom-[64px] z-30" style={{ left: `${left}%` }} aria-hidden><span className="impact-flash" /><span className="impact-burst" />{[1, 2, 3, 4, 5, 6].map((item) => <span key={item} className={`impact-debris debris-${item}`} />)}</div> }

function LanderGraphic() { return <svg width="76" height="94" viewBox="0 0 76 94" role="img" aria-label="Planetary lander"><defs><linearGradient id="live-lander-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6f7f9" /><stop offset="1" stopColor="#7e8997" /></linearGradient><linearGradient id="live-engine-flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff7c2" /><stop offset=".45" stopColor="var(--planet-accent)" /><stop offset="1" stopColor="transparent" /></linearGradient></defs><path d="M27 58 L15 80 M49 58 L61 80 M9 80 H22 M54 80 H67" fill="none" stroke="#d8dee8" strokeWidth="3" strokeLinecap="round" /><path d="M23 22 Q38 6 53 22 L58 57 Q38 67 18 57 Z" fill="url(#live-lander-body)" stroke="#f8fafc" strokeWidth="1.5" /><circle cx="38" cy="31" r="9" fill="#10233f" stroke="var(--planet-accent)" strokeWidth="2" /><path d="M26 17 L22 7 M50 17 L54 7 M19 48 L8 43 M57 48 L68 43" stroke="#d8dee8" strokeWidth="3" strokeLinecap="round" /><rect x="29" y="58" width="18" height="8" rx="2" fill="#697586" /><path d="M31 66 Q38 94 45 66 Z" fill="url(#live-engine-flame)" opacity="var(--engine-power)" /></svg> }

function flightWarning(flight: FlightState): { text: string; tone: string } {
  if (flight.fuelPercent <= 12) return { text: 'FUEL CRITICAL — reserve thrust for touchdown', tone: 'border-destructive/50 text-red-200' }
  if (flight.altitudeMeters <= 100 && flight.verticalSpeedMetersPerSecond > 10) return { text: 'VERTICAL SPEED HIGH — increase downward thrust', tone: 'border-destructive/50 text-red-200' }
  if (Math.abs(flight.horizontalSpeedMetersPerSecond) > 6) return { text: 'HORIZONTAL DRIFT — tilt against the drift', tone: 'border-warning/50 text-amber-100' }
  if (flight.altitudeMeters <= 80 && Math.abs(flight.angleDegrees) > 20) return { text: 'ATTITUDE WARNING — return upright for touchdown', tone: 'border-warning/50 text-amber-100' }
  return { text: 'FLIGHT PATH NOMINAL', tone: 'border-success/40 text-emerald-100' }
}

function touchdownNotice(result: FlightResult): { text: string; tone: string } {
  if (result.outcome === 'SAFE_APPROACH') return { text: 'TOUCHDOWN SECURED', tone: 'border-success/40 text-emerald-100' }
  if (result.outcome === 'MARGINAL') return { text: 'TOUCHDOWN — MARGINS NARROW', tone: 'border-warning/50 text-amber-100' }
  return { text: 'SURFACE IMPACT — FLIGHT COMPLETE', tone: 'border-destructive/50 text-red-200' }
}

function parseField(value: string): number { return value.trim() === '' ? Number.NaN : Number(value) }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)) }
function formatNumber(value: number): string { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value) }
function formatSigned(value: number): string { const rounded = Math.abs(value) < 0.005 ? 0 : value; return `${rounded > 0 ? '+' : ''}${formatNumber(rounded)}` }
function formatDate(value: string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
