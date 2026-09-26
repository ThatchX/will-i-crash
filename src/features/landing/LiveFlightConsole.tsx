import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
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
  Gauge,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Trash2,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react'
import { Button, Input, Label, Modal, useToast } from '@/components/ui'
import { ChatPanel } from '@/components/ChatPanel'
import {
  FLIGHT_MODEL_VERSION,
  FLIGHT_TICKS_PER_SECOND,
  FLIGHT_TIME_STEP_SECONDS,
  MARGINAL_ANGLE_DEGREES,
  MARGINAL_HORIZONTAL_SPEED_METERS_PER_SECOND,
  MARGINAL_VERTICAL_SPEED_METERS_PER_SECOND,
  MAX_STARTING_ALTITUDE_METERS,
  MAX_STARTING_HORIZONTAL_SPEED_METERS_PER_SECOND,
  MAX_STARTING_VERTICAL_SPEED_METERS_PER_SECOND,
  MIN_STARTING_ALTITUDE_METERS,
  RANKED_CHALLENGE_KEY,
  SAFE_ANGLE_DEGREES,
  SAFE_HORIZONTAL_SPEED_METERS_PER_SECOND,
  SAFE_VERTICAL_SPEED_METERS_PER_SECOND,
  appendControlEvent,
  createInitialFlightState,
  getLeaderboardPilotKey,
  getRankedInitialConditions,
  stepFlight,
  validateInitialConditions,
  type FlightControlEvent,
  type FlightControls,
  type FlightInitialConditions,
  type FlightResult,
  type FlightRunRecord,
  type FlightState,
  type LeaderboardScoreRecord,
} from '@/domain/flight'
import {
  MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED,
  PLANETS,
  getPlanet,
  type LandingOutcome,
  type PlanetId,
} from '@/domain/landing'

type ConsoleMode = 'setup' | 'flying' | 'paused' | 'complete'
type FlightMode = 'free' | 'ranked'
type InitialField = Exclude<keyof FlightInitialConditions, 'planetId'>
type InitialFieldValues = Record<InitialField, string>
type FlightWarningKey = 'fuel' | 'vertical' | 'angle' | 'horizontal' | 'nominal'

interface FlightWarning {
  key: FlightWarningKey
  text: string
  tone: string
}

interface CompleteFlightResponse {
  success: boolean
  data?: {
    recordId: string
    result: FlightResult
    totalTicks: number
    leaderboard?: RankedSubmission
  }
  error?: string
  issues?: Array<{ path: string[]; message: string }>
}

interface RankedSubmission {
  score: number
  qualified: boolean
  isPersonalBest: boolean
  saved: boolean
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
  const [flightMode, setFlightMode] = useState<FlightMode>('free')
  const [values, setValues] = useState<InitialFieldValues>(INITIAL_VALUES)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<InitialField, string>>>({})
  const [mode, setMode] = useState<ConsoleMode>('setup')
  const [flight, setFlight] = useState<FlightState | null>(null)
  const [controls, setControls] = useState<FlightControls>(INITIAL_CONTROLS)
  const [verifiedResult, setVerifiedResult] = useState<FlightResult | null>(null)
  const [rankedSubmission, setRankedSubmission] = useState<RankedSubmission | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [instructorOpen, setInstructorOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [leaderboardPlanetId, setLeaderboardPlanetId] = useState<PlanetId>('earth')
  const [instructorConversation, setInstructorConversation] = useState<{
    userId: string
    chatId: string
  } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [stageHeight, setStageHeight] = useState(520)
  const stageRef = useRef<HTMLElement>(null)
  const flightRef = useRef<FlightState | null>(null)
  const controlsRef = useRef<FlightControls>(INITIAL_CONTROLS)
  const commandsRef = useRef<FlightControlEvent[]>([])
  const activeInitialRef = useRef<FlightInitialConditions | null>(null)
  const activeFlightModeRef = useRef<FlightMode>('free')
  const persistedTickRef = useRef<number | null>(null)
  const warningKeyRef = useRef<FlightWarningKey>('nominal')
  const instructorTriggerRef = useRef<HTMLButtonElement>(null)
  const instructorDialogRef = useRef<HTMLElement>(null)
  const instructorWasOpenedRef = useRef(false)
  const toast = useToast()
  const { isLoaded, isSignedIn, userId } = useAuth()
  const leaderboardPilotKey = userId ? getLeaderboardPilotKey(userId) : '__signed_out__'
  const { records: flightRecords, status: flightHistoryStatus, error: flightHistoryError } = useQuery<FlightRunRecord>('flight-runs', {
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 10,
  })
  const { ready, removeConfirmed } = useMutations<FlightRunRecord>('flight-runs')
  const { records: leaderboardRecords, status: leaderboardStatus, error: leaderboardError } = useQuery<LeaderboardScoreRecord>('leaderboard-scores', {
    where: { planetId: leaderboardPlanetId, modelVersion: FLIGHT_MODEL_VERSION, challengeKey: RANKED_CHALLENGE_KEY },
    orderBy: 'score',
    orderDir: 'desc',
    limit: 10,
  })
  const { records: personalBestRecords } = useQuery<LeaderboardScoreRecord>('leaderboard-scores', {
    where: { pilotKey: leaderboardPilotKey, planetId: leaderboardPlanetId, modelVersion: FLIGHT_MODEL_VERSION, challengeKey: RANKED_CHALLENGE_KEY },
    limit: 1,
  })

  const freeInitial = useMemo<FlightInitialConditions>(() => ({
    planetId,
    altitudeMeters: parseField(values.altitudeMeters),
    verticalSpeedMetersPerSecond: parseField(values.verticalSpeedMetersPerSecond),
    horizontalSpeedMetersPerSecond: parseField(values.horizontalSpeedMetersPerSecond),
  }), [planetId, values])
  const initial = flightMode === 'ranked' ? getRankedInitialConditions(planetId) : freeInitial
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

  const openInstructor = useCallback(() => {
    if (mode === 'flying') setMode('paused')
    instructorWasOpenedRef.current = true
    setInstructorOpen(true)
  }, [mode])

  const closeInstructor = useCallback(() => setInstructorOpen(false), [])
  const openLeaderboard = useCallback(() => {
    if (mode === 'flying') setMode('paused')
    setLeaderboardPlanetId(planetId)
    setLeaderboardOpen(true)
  }, [mode, planetId])

  useEffect(() => {
    if (!instructorOpen) {
      if (instructorWasOpenedRef.current) instructorTriggerRef.current?.focus()
      return
    }

    instructorDialogRef.current?.focus()
    const trapDialogFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeInstructor()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = instructorDialogRef.current
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ))
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (document.activeElement === dialog) {
        event.preventDefault()
        const focusTarget = event.shiftKey ? last : first
        focusTarget.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', trapDialogFocus)
    return () => window.removeEventListener('keydown', trapDialogFocus)
  }, [closeInstructor, instructorOpen])

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
        body: JSON.stringify({
          initial: flightInitial,
          commands: commandsRef.current,
          ranked: activeFlightModeRef.current === 'ranked',
        }),
      })
      const payload = (await response.json()) as CompleteFlightResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'The verified flight could not be saved.')
      }
      setVerifiedResult(payload.data.result)
      setRankedSubmission(payload.data.leaderboard ?? null)
      if (payload.data.leaderboard && !payload.data.leaderboard.saved) {
        toast.warning('Flight verified', 'The flight was saved, but the leaderboard could not update.')
      }
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
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement
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
    activeFlightModeRef.current = flightMode
    flightRef.current = nextFlight
    controlsRef.current = INITIAL_CONTROLS
    commandsRef.current = [{ tick: 0, ...INITIAL_CONTROLS }]
    persistedTickRef.current = null
    setFlight(nextFlight)
    setControls(INITIAL_CONTROLS)
    setVerifiedResult(null)
    setRankedSubmission(null)
    setFieldErrors({})
    warningKeyRef.current = 'nominal'
    setMode('flying')
  }

  const resetFlight = () => {
    flightRef.current = null
    activeInitialRef.current = null
    activeFlightModeRef.current = 'free'
    commandsRef.current = []
    controlsRef.current = INITIAL_CONTROLS
    persistedTickRef.current = null
    setFlight(null)
    setControls(INITIAL_CONTROLS)
    setVerifiedResult(null)
    setRankedSubmission(null)
    warningKeyRef.current = 'nominal'
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
    // Keep the surface as the lower visual boundary, but do not impose an
    // artificial ceiling. A climbing craft can leave the frame and re-enter.
    ? Math.min(1, 1 - flight.altitudeMeters / currentInitial.altitudeMeters)
    : 0
  const landerStartTop = mode === 'setup' ? 70 : 110
  const landerTop = landerStartTop + altitudeProgress * Math.max(0, stageHeight - landerStartTop - 156)
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
      ? flightWarning(flight, warningKeyRef.current)
      : { key: 'nominal' as const, text: 'Configure the approach, then take control.', tone: 'border-white/15 text-white/75' }
  warningKeyRef.current = warning.key

  return (
    <div className="landing-shell min-h-full text-foreground">
      <main className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${mode === 'setup' ? 'py-5' : 'py-3'}`}>
        <header className={`flex flex-wrap items-end justify-between gap-3 ${mode === 'setup' ? 'mb-5' : 'mb-3'}`}>
          <div>
            <p className="aurora-text text-xs font-semibold uppercase tracking-[0.24em]">Live planetary landing simulator · Model 03</p>
            <h1 className={`mt-1 font-bold tracking-tight ${mode === 'setup' ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>You have the <span className="aurora-text">controls.</span></h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mode === 'setup' && <div className="glass-panel flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 font-mono text-xs text-muted-foreground">
              <Gauge className="size-4 text-primary" aria-hidden />
              MAX ENGINE {MAX_ENGINE_ACCELERATION_METERS_PER_SECOND_SQUARED} m/s²
            </div>}
            <Button type="button" size="lg" variant="outline" className="rounded-full border-primary/25 bg-card/55 px-5 hover:border-primary/45 hover:bg-accent/80" onClick={openLeaderboard}><Trophy className="size-4 text-primary" aria-hidden />Leaderboard</Button>
            {!instructorOpen && <Button ref={instructorTriggerRef} type="button" size="lg" data-testid="open-flight-instructor" className="rounded-full px-5" onClick={openInstructor}><Bot className="size-5" aria-hidden />Ask instructor</Button>}
          </div>
        </header>

        {mode === 'setup' && <section aria-label="Choose a planet" className="glass-panel mb-5 overflow-x-auto rounded-2xl border p-2">
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
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-55 ${selected ? 'aurora-selection font-semibold' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'}`}
                >
                  <span className="size-3 rounded-full border border-white/20 shadow-[inset_-2px_-2px_4px_rgba(0,0,0,.35)]" style={{ backgroundColor: PLANET_ART[candidate.id].accent }} aria-hidden />
                  {candidate.name}
                </button>
              )
            })}
          </div>
        </section>}

        <div className={mode === 'setup' ? 'grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,.75fr)]' : 'aurora-frame overflow-hidden rounded-3xl border bg-card'}>
          <section
            ref={stageRef}
            data-testid="flight-stage"
            className={`relative min-h-[460px] overflow-hidden sm:min-h-[500px] ${mode === 'setup' ? 'aurora-frame rounded-3xl border' : ''}`}
            style={{ background: art.sky }}
          >
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,255,255,.85)_.7px,transparent_.7px)] [background-size:43px_43px]" />
            <div className="stage-aurora pointer-events-none absolute inset-0" aria-hidden />
            <div className="absolute left-1/2 top-[-180px] size-[420px] -translate-x-1/2 rounded-full blur-3xl" style={{ backgroundColor: art.glow }} aria-hidden />

            {mode === 'setup' ? <><div className="absolute left-4 top-4 z-20 rounded-xl border border-white/15 bg-black/25 px-3 py-2 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[.2em] text-white/55">{planet.name}</p>
              <p className="mt-1 font-mono text-sm text-white">Gravity {planet.gravity} m/s²</p>
            </div>
            <div className="absolute right-4 top-4 z-20 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-right backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[.2em] text-white/55">{mode}</p>
              <p className="mt-1 font-mono text-sm text-white">{formatNumber(flight?.tick ? flight.tick / FLIGHT_TICKS_PER_SECOND : 0)} s</p>
            </div></> : <FlightHud flight={flight} initial={currentInitial} controls={controls} planet={planet} mode={mode} warning={warning} ranked={activeFlightModeRef.current === 'ranked'} />}

            <div data-testid="live-lander" className={`live-lander absolute z-20 ${touchdownClass}`} style={landerStyle} aria-label={`Live lander above ${planet.name}`}>
              <div className="lander-touchdown"><LanderGraphic /></div>
            </div>

            {mode === 'complete' && result?.outcome === 'SAFE_APPROACH' && <SuccessEffect left={landerLeft} />}
            {mode === 'complete' && result?.outcome === 'CRASH_LIKELY' && <CrashEffect left={landerLeft} />}

            <div className="surface-horizon absolute inset-x-0 bottom-0 z-10 h-[76px] border-t border-white/20" style={{ background: art.surface }}>
              <div className="absolute inset-x-0 top-2 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[.25em] text-white/60">
                <span className="h-px w-8 bg-white/25" />{planet.surfaceKind}<span className="h-px w-8 bg-white/25" />
              </div>
              <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/45">{art.detail}</p>
            </div>

            {mode === 'setup' && <div role="status" aria-live="polite" aria-atomic="true" className={`absolute left-4 top-24 z-20 max-w-[290px] rounded-lg border bg-black/35 px-3 py-2 text-xs font-medium backdrop-blur-sm ${warning.tone}`} data-testid="flight-warning">
              {warning.text}
            </div>}
          </section>

          {mode === 'setup' ? <section className="glass-panel rounded-3xl border p-4 sm:p-5 lg:h-[500px] lg:overflow-y-auto">
            <PreflightControls
                flightMode={flightMode}
                rankedInitial={getRankedInitialConditions(planetId)}
                values={values}
                errors={fieldErrors}
                accent={art.accent}
                onChange={(field, value) => {
                  setValues((current) => ({ ...current, [field]: value }))
                  setFieldErrors((current) => ({ ...current, [field]: undefined }))
                }}
                onReset={() => { setValues(INITIAL_VALUES); setFieldErrors({}) }}
                onFlightMode={setFlightMode}
                onStart={startFlight}
                authReady={isLoaded}
              />
          </section> : <div className="control-deck border-t border-white/10 p-3 backdrop-blur-md sm:p-4">
            {mode === 'complete' && result ? (
              <FlightResultPanel result={result} saving={saving} ranked={activeFlightModeRef.current === 'ranked'} rankedSubmission={rankedSubmission} onReset={resetFlight} onLeaderboard={openLeaderboard} />
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
          </div>}
        </div>

        <details data-testid="flight-history" className="glass-panel group mt-4 rounded-2xl border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5">
            <div><h2 className="font-semibold">Flight log</h2><p className="mt-0.5 text-xs text-muted-foreground">Open verified flights after touchdown.</p></div>
            <span className="font-mono text-xs text-muted-foreground">{flightRecords.length}/10 · <span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span></span>
          </summary>
          <div className="border-t border-border px-4 pb-4 sm:px-5 sm:pb-5">
            {flightHistoryStatus === 'loading' ? (
              <div className="mt-4 flex gap-3 overflow-hidden" aria-label="Loading flight log">{[0, 1, 2].map((item) => <div key={item} className="h-28 min-w-64 animate-pulse rounded-xl bg-muted/50" />)}</div>
            ) : flightHistoryStatus === 'error' ? (
              <p className="mt-4 text-sm text-destructive">{flightHistoryError ?? 'The flight log could not be loaded.'}</p>
            ) : flightRecords.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{isSignedIn ? 'Complete a flight to create your V3 log.' : 'Sign in to fly and create a private flight log.'}</p>
            ) : (
              <ol className="mt-4 flex gap-3 overflow-x-auto pb-2">{flightRecords.map((record) => <FlightCard key={record.recordId} record={record} deleting={deletingId === record.recordId} canDelete={ready} onDelete={() => void deleteRun(record.recordId)} />)}</ol>
            )}
          </div>
        </details>

        <footer className="px-2 py-6 text-center text-xs leading-5 text-muted-foreground">Deterministic 2D model: fixed-step gravity, thrust, horizontal motion, and finite fuel. Atmosphere, terrain, and orbit are intentionally omitted.</footer>
      </main>

      {instructorOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) closeInstructor() }}>
          <aside
            ref={instructorDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="flight-instructor-title"
            tabIndex={-1}
            data-testid="flight-instructor"
            className="glass-panel-strong absolute inset-x-3 bottom-3 h-[min(680px,calc(100vh-1.5rem))] overflow-hidden rounded-2xl border outline-none sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(680px,calc(100vh-6rem))] sm:w-[420px]"
          >
            {isSignedIn && userId ? (
              <ChatPanel
                chatId={instructorConversation?.userId === userId ? instructorConversation.chatId : null}
                userId={userId}
                onChatCreated={(chatId) => setInstructorConversation({ userId, chatId })}
                compact
                className="bg-transparent"
                emptyStatePrompts={[
                  `Give me a short preflight briefing for ${planet.name} with ${formatNumber(initial.altitudeMeters)} m altitude, ${formatNumber(initial.verticalSpeedMetersPerSecond)} m/s downward speed, and ${formatDirection(initial.horizontalSpeedMetersPerSecond, 'left', 'right')} horizontal drift.`,
                  'Debrief my most recent verified flight and give me two things to practice.',
                  'Explain how throttle, tilt, and fuel interact in this simulator.',
                ]}
                header={<InstructorHeader flightPaused={mode === 'paused'} onClose={closeInstructor} />}
              />
            ) : (
              <div className="flex h-full flex-col">
                <InstructorHeader flightPaused={mode === 'paused'} onClose={closeInstructor} />
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                  <Bot className="size-8 text-primary" aria-hidden />
                  <h3 className="mt-3 font-semibold">Sign in for coaching</h3>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">The instructor advises before and after flights. It never controls the craft or changes an outcome.</p>
                  <Button className="mt-4" onClick={() => setShowAuthModal(true)}>Sign in</Button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
      <LeaderboardModal
        open={leaderboardOpen}
        planetId={leaderboardPlanetId}
        records={leaderboardRecords}
        personalBest={personalBestRecords[0]?.data ?? null}
        status={leaderboardStatus}
        error={leaderboardError}
        pilotKey={leaderboardPilotKey}
        onPlanet={setLeaderboardPlanetId}
        onClose={() => setLeaderboardOpen(false)}
      />
      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </div>
  )
}

function InstructorHeader({ flightPaused, onClose }: { flightPaused: boolean; onClose: () => void }) {
  return <div className="flex items-center gap-3 border-b border-border px-4 py-3.5"><span className="aurora-soft rounded-lg border p-2 text-primary"><Bot className="size-5" aria-hidden /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 id="flight-instructor-title" className="font-semibold">AI flight instructor</h2>{flightPaused && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">Flight paused</span>}</div><p className="truncate text-xs text-muted-foreground">Advises only · never controls the craft</p></div><Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Close flight instructor" onClick={onClose}><X className="size-4" aria-hidden /></Button></div>
}

function PreflightControls({ flightMode, rankedInitial, values, errors, accent, onChange, onReset, onFlightMode, onStart, authReady }: {
  flightMode: FlightMode
  rankedInitial: FlightInitialConditions
  values: InitialFieldValues
  errors: Partial<Record<InitialField, string>>
  accent: string
  onChange: (field: InitialField, value: string) => void
  onReset: () => void
  onFlightMode: (mode: FlightMode) => void
  onStart: () => void
  authReady: boolean
}) {
  return <>
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Preflight conditions</h2><p className="mt-1 text-xs text-muted-foreground">Practice freely or fly the standardized ranked approach.</p></div>{flightMode === 'free' && <button type="button" onClick={onReset} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Reset preflight conditions"><RotateCcw className="size-4" aria-hidden /></button>}</div>
    <div className="glass-panel mt-4 grid grid-cols-2 rounded-xl border p-1" aria-label="Flight mode"><button type="button" aria-pressed={flightMode === 'free'} onClick={() => onFlightMode('free')} className={`min-h-11 rounded-lg px-3 text-sm font-medium transition-all ${flightMode === 'free' ? 'aurora-selection' : 'text-muted-foreground hover:text-foreground'}`}>Free Flight</button><button type="button" aria-pressed={flightMode === 'ranked'} onClick={() => onFlightMode('ranked')} className={`min-h-11 rounded-lg px-3 text-sm font-medium transition-all ${flightMode === 'ranked' ? 'aurora-selection' : 'text-muted-foreground hover:text-foreground'}`}><Trophy className="mr-1 inline size-4" aria-hidden />Ranked</button></div>
    <ol className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" aria-label="First flight checklist"><li className="rounded-lg border border-border bg-background/35 px-2 py-2"><span className="aurora-text block">1</span>Slow descent</li><li className="rounded-lg border border-border bg-background/35 px-2 py-2"><span className="aurora-text block">2</span>Cancel drift</li><li className="rounded-lg border border-border bg-background/35 px-2 py-2"><span className="aurora-text block">3</span>Land level</li></ol>
    {flightMode === 'free' ? <div className="mt-5 space-y-5">{SETUP_CONTROLS.map((control) => <SetupControl key={control.name} {...control} value={values[control.name]} error={errors[control.name]} accent={accent} onChange={(value) => onChange(control.name, value)} />)}</div> : <div className="aurora-soft mt-5 rounded-xl border p-4"><p className="aurora-text text-xs font-semibold uppercase tracking-wider">Standardized approach</p><dl className="mt-3 grid grid-cols-3 gap-2"><RankedCondition label="Altitude" value={`${rankedInitial.altitudeMeters} m`} /><RankedCondition label="Descent" value={`${rankedInitial.verticalSpeedMetersPerSecond} m/s`} /><RankedCondition label="Drift" value={`Right ${rankedInitial.horizontalSpeedMetersPerSecond}`} /></dl><p className="mt-3 text-xs leading-5 text-muted-foreground">Only safe landings qualify. Score rewards descent control, low drift, level attitude, and remaining fuel.</p></div>}
    <Button data-testid="start-flight" className="mt-6 w-full" type="button" size="lg" disabled={!authReady} onClick={onStart}><Play className="size-4" aria-hidden /> Begin {flightMode === 'ranked' ? 'ranked ' : ''}flight</Button>
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
  const pressStartedAtRef = useRef(0)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minimumRotationPulseMilliseconds = 110
  useEffect(() => () => { if (stopTimerRef.current) clearTimeout(stopTimerRef.current) }, [])
  const holdRotation = (direction: -1 | 1) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    pressStartedAtRef.current = performance.now()
    onRotate(direction)
  }
  const releaseRotation = () => {
    const remainingPulse = minimumRotationPulseMilliseconds - (performance.now() - pressStartedAtRef.current)
    if (remainingPulse <= 0) {
      onRotate(0)
      return
    }
    stopTimerRef.current = setTimeout(() => onRotate(0), remainingPulse)
  }
  const rotationButtonProps = (direction: -1 | 1) => ({
    onPointerDown: holdRotation(direction),
    onPointerUp: releaseRotation,
    onPointerCancel: releaseRotation,
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => { if (event.key === 'Enter' || event.key === ' ') onRotate(direction) },
    onKeyUp: (event: ReactKeyboardEvent<HTMLButtonElement>) => { if (event.key === 'Enter' || event.key === ' ') onRotate(0) },
  })
  return <section aria-label="Pilot controls" className="mx-auto max-w-6xl">
    <div className="grid items-end gap-3 sm:grid-cols-[auto_minmax(260px,1fr)_auto]">
      <Button data-testid="rotate-left" type="button" size="lg" variant={controls.rotationDirection === -1 ? 'default' : 'outline'} disabled={!active} {...rotationButtonProps(-1)}><ChevronLeft className="size-5" aria-hidden />Rotate left</Button>
      <div><div className="mb-2 flex items-center justify-between"><Label htmlFor="live-throttle">Throttle</Label><span className="font-mono text-lg font-semibold">{formatNumber(controls.throttlePercent)}%</span></div><input id="live-throttle" data-testid="live-throttle" type="range" min="0" max="100" step="1" value={controls.throttlePercent} disabled={!active} onChange={(event) => onThrottle(Number(event.target.value))} className="planet-slider w-full" /><div className="mt-2 flex justify-center gap-2"><Button className="min-h-11" type="button" variant="ghost" disabled={!active} onClick={() => onThrottle(controls.throttlePercent - 5)}>−5</Button><Button className="min-h-11" type="button" variant="outline" disabled={!active} onClick={() => onThrottle(0)}><Zap className="size-4" aria-hidden />Cut engine</Button><Button className="min-h-11" type="button" variant="ghost" disabled={!active} onClick={() => onThrottle(controls.throttlePercent + 5)}>+5</Button></div></div>
      <Button data-testid="rotate-right" type="button" size="lg" variant={controls.rotationDirection === 1 ? 'default' : 'outline'} disabled={!active} {...rotationButtonProps(1)}>Rotate right<ChevronRight className="size-5" aria-hidden /></Button>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2"><span className="mr-2 text-[10px] uppercase tracking-wider text-muted-foreground">Safe: descent ≤5 · drift ≤3 · tilt ≤10°</span><Button data-testid="pause-flight" type="button" variant="ghost" onClick={onPause}>{mode === 'paused' ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}{mode === 'paused' ? 'Resume' : 'Pause'}</Button><Button data-testid="reset-flight" type="button" variant="ghost" disabled={saving} onClick={onReset}><RotateCcw className="size-4" aria-hidden />Restart</Button></div>
  </section>
}

function RankedCondition({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-xs font-semibold">{value}</dd></div>
}

function SetupControl({ name, label, hint, unit, min, max, step, value, error, accent, onChange }: (typeof SETUP_CONTROLS)[number] & { value: string; error?: string; accent: string; onChange: (value: string) => void }) {
  return <div><div className="mb-2 flex items-start justify-between gap-3"><div><Label htmlFor={`flight-${name}`}>{label}</Label><p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p></div><div className="flex items-center gap-1.5"><Input id={`flight-${name}`} data-testid={`flight-${name}`} type="number" min={min} max={max} step="any" value={value} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} className="h-8 w-24 px-2 text-right font-mono text-xs" /><span className="w-8 text-xs text-muted-foreground">{unit}</span></div></div><input type="range" min={min} max={max} step={step} value={Number.isFinite(Number(value)) ? value : min} onChange={(event) => onChange(event.target.value)} className="planet-slider w-full" style={{ accentColor: accent }} aria-label={`${label} slider`} /><div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground"><span>{min}</span><span>{max}</span></div>{error && <p className="mt-1 text-xs text-destructive">{error}</p>}</div>
}

function FlightHud({ flight, initial, controls, planet, mode, warning, ranked }: { flight: FlightState | null; initial: FlightInitialConditions; controls: FlightControls; planet: import('@/domain/landing').PlanetConfig; mode: ConsoleMode; warning: FlightWarning; ranked: boolean }) {
  const altitude = flight?.altitudeMeters ?? initial.altitudeMeters
  const vertical = flight?.verticalSpeedMetersPerSecond ?? initial.verticalSpeedMetersPerSecond
  const horizontal = flight?.horizontalSpeedMetersPerSecond ?? initial.horizontalSpeedMetersPerSecond
  const angle = flight?.angleDegrees ?? 0
  const fuel = flight?.fuelPercent ?? 100
  const verticalStatus = limitStatus(Math.max(0, vertical), SAFE_VERTICAL_SPEED_METERS_PER_SECOND, MARGINAL_VERTICAL_SPEED_METERS_PER_SECOND)
  const driftStatus = limitStatus(Math.abs(horizontal), SAFE_HORIZONTAL_SPEED_METERS_PER_SECOND, MARGINAL_HORIZONTAL_SPEED_METERS_PER_SECOND)
  const angleStatus = limitStatus(Math.abs(angle), SAFE_ANGLE_DEGREES, MARGINAL_ANGLE_DEGREES)
  return <section data-testid="flight-telemetry" aria-label="Live flight telemetry" className="pointer-events-none absolute inset-0 z-30 font-mono text-white [text-shadow:0_2px_8px_rgba(0,0,0,.9)]">
    <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-4 text-[10px] uppercase tracking-[.16em] text-white/65 sm:inset-x-5"><p>{planet.name} · {planet.gravity} m/s²{ranked ? ' · Ranked' : ''}</p><p>{mode} · {formatNumber(flight?.tick ? flight.tick / FLIGHT_TICKS_PER_SECOND : 0)} s</p><p className={fuel <= 12 ? 'text-red-200' : fuel <= 25 ? 'text-amber-100' : ''}>Fuel {formatNumber(fuel)}%</p></div>
    <div role="status" aria-live="polite" aria-atomic="true" data-testid="flight-warning" className={`absolute left-1/2 top-14 max-w-[min(88%,430px)] -translate-x-1/2 rounded-full bg-black/35 px-4 py-2 text-center text-[10px] font-semibold tracking-wide backdrop-blur-sm ${warning.tone}`}>{warning.text}</div>
    <div className="absolute left-4 top-28 space-y-5 sm:left-6 sm:top-32"><HudReadout label="Altitude" value={`${formatNumber(Math.max(0, altitude))} m`} status="neutral" prominent /><HudReadout label="Descent" value={describeVertical(vertical)} status={verticalStatus} prominent /></div>
    <div className="absolute right-4 top-28 space-y-5 text-right sm:right-6 sm:top-32"><HudReadout label="Drift" value={formatDirection(horizontal, 'left', 'right')} status={driftStatus} /><HudReadout label="Attitude" value={formatDirection(angle, 'left', 'right', '°')} status={angleStatus} /><HudReadout label="Throttle" value={`${formatNumber(controls.throttlePercent)}%`} status="neutral" /></div>
  </section>
}

function FlightResultPanel({ result, saving, ranked, rankedSubmission, onReset, onLeaderboard }: { result: FlightResult; saving: boolean; ranked: boolean; rankedSubmission: RankedSubmission | null; onReset: () => void; onLeaderboard: () => void }) {
  const copy = OUTCOME_COPY[result.outcome]
  const rankedText = !ranked ? null : saving ? 'Verifying ranked result…' : !rankedSubmission ? null : !rankedSubmission.saved ? 'Score calculated, but the leaderboard could not update.' : !rankedSubmission.qualified ? 'Ranked flight did not qualify — only safe landings score.' : rankedSubmission.isPersonalBest ? `New personal best · ${formatNumber(rankedSubmission.score)} points` : `Ranked score · ${formatNumber(rankedSubmission.score)} points`
  return <section data-testid="flight-result" role="status" aria-live="polite" className={`mx-auto grid max-w-6xl gap-4 rounded-2xl border p-4 lg:grid-cols-[minmax(240px,1fr)_minmax(420px,1.5fr)_auto] lg:items-center ${copy.border}`}><div className="flex items-start gap-3">{result.outcome === 'SAFE_APPROACH' ? <ShieldCheck className={`mt-0.5 size-6 shrink-0 ${copy.text}`} aria-hidden /> : <TriangleAlert className={`mt-0.5 size-6 shrink-0 ${copy.text}`} aria-hidden />}<div><div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><h2 className={`text-xl font-bold ${copy.text}`}>{copy.gameLabel}</h2><span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{copy.engineeringLabel}</span></div><p className="mt-1 text-xs leading-5 text-foreground">{result.explanation}</p>{rankedText && <p className="aurora-text mt-1 text-xs font-semibold">{rankedText}</p>}</div></div><dl className="grid grid-cols-2 gap-2 sm:grid-cols-4"><ResultMetric label="Descent" value={describeVertical(result.touchdownVerticalSpeed)} /><ResultMetric label="Drift" value={formatDirection(result.touchdownHorizontalSpeed, 'left', 'right')} /><ResultMetric label="Attitude" value={formatDirection(result.touchdownAngleDegrees, 'left', 'right', '°')} /><ResultMetric label="Fuel" value={`${formatNumber(result.fuelRemainingPercent)}%`} /></dl><div className="flex gap-2 lg:flex-col"><Button data-testid="reset-flight" className="flex-1" type="button" size="lg" disabled={saving} onClick={onReset}><RotateCcw className="size-4" aria-hidden />New flight</Button>{rankedSubmission && <Button className="flex-1" type="button" size="lg" variant="outline" onClick={onLeaderboard}><Trophy className="size-4 text-primary" aria-hidden />Leaderboard</Button>}</div></section>
}

type MetricStatus = 'safe' | 'caution' | 'critical' | 'neutral'
const HUD_STATUS_STYLES: Record<MetricStatus, string> = { safe: 'text-white/55', caution: 'text-amber-100', critical: 'text-red-200', neutral: 'text-white/75' }
function HudReadout({ label, value, status, prominent = false }: { label: string; value: string; status: MetricStatus; prominent?: boolean }) { return <div className={HUD_STATUS_STYLES[status]}><p className="text-[9px] uppercase tracking-[.18em] opacity-75">{label}{status === 'caution' ? ' · Caution' : status === 'critical' ? ' · Critical' : ''}</p><p className={`mt-1 font-semibold ${prominent ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'}`}>{value}</p></div> }
function ResultMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border/60 bg-background/55 px-3 py-2"><dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-xs font-semibold">{value}</dd></div> }

function LeaderboardModal({ open, planetId, records, personalBest, status, error, pilotKey, onPlanet, onClose }: {
  open: boolean
  planetId: PlanetId
  records: Array<{ recordId: string; createdAt: string; data: LeaderboardScoreRecord }>
  personalBest: LeaderboardScoreRecord | null
  status: 'loading' | 'ready' | 'error'
  error?: string
  pilotKey: string
  onPlanet: (planetId: PlanetId) => void
  onClose: () => void
}) {
  const planet = getPlanet(planetId)
  return <Modal open={open} onClose={onClose} size="lg" className="glass-panel-strong">
    <Modal.Header><Modal.Title className="aurora-text">Ranked flight leaderboard</Modal.Title><Modal.Description>Verified safe landings using the same starting conditions. Only each pilot&apos;s best score appears.</Modal.Description></Modal.Header>
    <Modal.Body className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Leaderboard planet">{PLANETS.map((candidate) => <button key={candidate.id} type="button" aria-pressed={candidate.id === planetId} onClick={() => onPlanet(candidate.id)} className={`min-h-11 shrink-0 rounded-full px-4 text-sm transition-all ${candidate.id === planetId ? 'aurora-selection font-semibold' : 'border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'}`}>{candidate.name}</button>)}</div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-semibold">{planet.name} · Standard challenge</p><p className="mt-1 text-xs text-muted-foreground">1,000 points maximum: descent 40% · drift 30% · attitude 20% · fuel 10%. Time does not affect score.</p></div>{personalBest && <div className="personal-best-glow rounded-xl border px-4 py-2 text-right"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Your best</p><p className="aurora-text font-mono text-lg font-bold">{formatNumber(personalBest.score)}</p></div>}</div>
      {status === 'loading' ? <div className="space-y-2" aria-label="Loading leaderboard">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted/50" />)}</div> : status === 'error' ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error ?? 'The leaderboard could not be loaded.'}</p> : records.length === 0 ? <p className="aurora-soft rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No qualified {planet.name} landings yet. The first safe ranked flight takes the lead.</p> : <ol className="space-y-2">{records.map((record, index) => { const currentPilot = record.data.pilotKey === pilotKey; return <li key={record.recordId} className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-xl border px-3 py-3 ${currentPilot ? 'personal-best-glow' : 'border-border bg-background/55'}`}><span className={`font-mono text-lg font-bold ${index === 0 ? 'aurora-text' : index < 3 ? 'text-primary' : 'text-muted-foreground'}`}>#{index + 1}</span><div><p className="text-sm font-semibold">{record.data.callsign}{currentPilot ? ' · You' : ''}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{formatNumber(record.data.touchdownVerticalSpeed)} m/s descent · {formatNumber(Math.abs(record.data.touchdownHorizontalSpeed))} m/s drift · {formatNumber(Math.abs(record.data.touchdownAngleDegrees))}° tilt · {formatNumber(record.data.fuelRemainingPercent)}% fuel</p></div><span className={index === 0 ? 'aurora-text font-mono text-lg font-bold' : 'font-mono text-lg font-bold'}>{formatNumber(record.data.score)}</span></li> })}</ol>}
    </Modal.Body>
  </Modal>
}

function FlightCard({ record, deleting, canDelete, onDelete }: { record: { recordId: string; createdAt: string; data: FlightRunRecord }; deleting: boolean; canDelete: boolean; onDelete: () => void }) {
  const runPlanet = getPlanet(record.data.planetId)
  const copy = OUTCOME_COPY[record.data.outcome]
  return <li className="min-w-72 rounded-xl border border-border bg-background/55 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[.16em] text-muted-foreground">{runPlanet.name}</p><p className={`mt-1 text-sm font-semibold ${copy.text}`}>{copy.gameLabel}</p></div><Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground hover:text-destructive" aria-label={`Delete ${runPlanet.name} flight`} disabled={!canDelete || deleting} onClick={onDelete}><Trash2 className="size-4" aria-hidden /></Button></div><p className="mt-3 text-xs text-foreground">{formatNumber(record.data.touchdownVerticalSpeed)} m/s vertical · {formatNumber(Math.abs(record.data.touchdownHorizontalSpeed))} m/s horizontal</p><p className="mt-1 text-[11px] text-muted-foreground">Started {formatNumber(record.data.altitudeMeters)} m · {formatNumber(record.data.fuelRemainingPercent)}% fuel · {formatDate(record.createdAt)}</p></li>
}

function SuccessEffect({ left }: { left: number }) { return <div data-testid="success-animation" className="touchdown-effects absolute bottom-[68px] z-30" style={{ left: `${left}%` }} aria-hidden><span className="success-ring" /><span className="success-ring success-ring-delayed" />{[1, 2, 3, 4, 5, 6].map((item) => <span key={item} className={`touchdown-spark spark-${item}`} />)}</div> }
function CrashEffect({ left }: { left: number }) { return <div data-testid="crash-animation" className="touchdown-effects absolute bottom-[64px] z-30" style={{ left: `${left}%` }} aria-hidden><span className="impact-flash" /><span className="impact-burst" />{[1, 2, 3, 4, 5, 6].map((item) => <span key={item} className={`impact-debris debris-${item}`} />)}</div> }

function LanderGraphic() { return <svg width="76" height="94" viewBox="0 0 76 94" role="img" aria-label="Planetary lander"><defs><linearGradient id="live-lander-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6f7f9" /><stop offset=".55" stopColor="#c8d4e8" /><stop offset="1" stopColor="#737e92" /></linearGradient><linearGradient id="live-engine-flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f9fbff" /><stop offset=".3" stopColor="#72dcff" /><stop offset=".78" stopColor="#72dcff" stopOpacity=".65" /><stop offset="1" stopColor="#72dcff" stopOpacity="0" /></linearGradient></defs><path d="M27 58 L15 80 M49 58 L61 80 M9 80 H22 M54 80 H67" fill="none" stroke="#d8dee8" strokeWidth="3" strokeLinecap="round" /><path d="M23 22 Q38 6 53 22 L58 57 Q38 67 18 57 Z" fill="url(#live-lander-body)" stroke="#f8fafc" strokeWidth="1.5" /><circle cx="38" cy="31" r="9" fill="#080d1d" stroke="var(--planet-accent)" strokeWidth="2" /><path d="M26 17 L22 7 M50 17 L54 7 M19 48 L8 43 M57 48 L68 43" stroke="#d8dee8" strokeWidth="3" strokeLinecap="round" /><rect x="29" y="58" width="18" height="8" rx="2" fill="#697586" /><path className="lander-flame" d="M31 66 Q38 94 45 66 Z" fill="url(#live-engine-flame)" opacity="var(--engine-power)" /></svg> }

function flightWarning(flight: FlightState, previous: FlightWarningKey): FlightWarning {
  const fuelCritical = flight.fuelPercent <= (previous === 'fuel' ? 16 : 12)
  const descentCritical = flight.altitudeMeters <= 100 && flight.verticalSpeedMetersPerSecond > (previous === 'vertical' ? 8.5 : MARGINAL_VERTICAL_SPEED_METERS_PER_SECOND)
  const angleCritical = flight.altitudeMeters <= 80 && Math.abs(flight.angleDegrees) > (previous === 'angle' ? 16 : MARGINAL_ANGLE_DEGREES)
  const driftCritical = Math.abs(flight.horizontalSpeedMetersPerSecond) > (previous === 'horizontal' ? 5 : MARGINAL_HORIZONTAL_SPEED_METERS_PER_SECOND)

  if (fuelCritical) return { key: 'fuel', text: 'FUEL CRITICAL — reduce throttle and reserve fuel for touchdown', tone: 'border-destructive/50 text-red-200' }
  if (descentCritical) return { key: 'vertical', text: 'DESCENT TOO FAST — increase throttle now', tone: 'border-destructive/50 text-red-200' }
  if (angleCritical) {
    const correction = flight.angleDegrees < 0 ? 'right' : 'left'
    return { key: 'angle', text: `CRAFT NOT LEVEL — rotate ${correction} before touchdown`, tone: 'border-warning/50 text-amber-100' }
  }
  if (driftCritical) {
    const correction = flight.horizontalSpeedMetersPerSecond < 0 ? 'right' : 'left'
    return { key: 'horizontal', text: `DRIFT TOO HIGH — tilt ${correction} to cancel it`, tone: 'border-warning/50 text-amber-100' }
  }
  return { key: 'nominal', text: 'FLIGHT PATH NOMINAL — stay inside all three limits', tone: 'border-success/40 text-emerald-100' }
}

function touchdownNotice(result: FlightResult): FlightWarning {
  if (result.outcome === 'SAFE_APPROACH') return { key: 'nominal', text: 'TOUCHDOWN SECURED', tone: 'border-success/40 text-emerald-100' }
  if (result.outcome === 'MARGINAL') return { key: 'nominal', text: 'TOUCHDOWN — MARGINS NARROW', tone: 'border-warning/50 text-amber-100' }
  return { key: 'nominal', text: 'SURFACE IMPACT — FLIGHT COMPLETE', tone: 'border-destructive/50 text-red-200' }
}

function parseField(value: string): number { return value.trim() === '' ? Number.NaN : Number(value) }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)) }
function formatNumber(value: number): string { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value) }
function formatDirection(value: number, negativeDirection: string, positiveDirection: string, unit = ' m/s'): string {
  const rounded = Math.abs(value) < 0.005 ? 0 : value
  if (rounded === 0) return `None · ${formatNumber(0)}${unit}`
  return `${rounded < 0 ? negativeDirection : positiveDirection} · ${formatNumber(Math.abs(rounded))}${unit}`
}
function describeVertical(value: number): string {
  if (Math.abs(value) < 0.005) return 'Stable · 0 m/s'
  return `${value > 0 ? 'Descending' : 'Climbing'} · ${formatNumber(Math.abs(value))} m/s`
}
function limitStatus(value: number, safe: number, marginal: number): MetricStatus {
  if (value <= safe) return 'safe'
  if (value <= marginal) return 'caution'
  return 'critical'
}
function formatDate(value: string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
