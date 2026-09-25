import { useMemo, useState, type FormEvent } from 'react'
import { getAuthToken, useMutations, useQuery } from 'deepspace'
import { Gauge, RotateCcw, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { Button, Input, Label, useToast } from '@/components/ui'
import {
  assessLanding,
  type LandingAssessment,
  type LandingCheckRecord,
  type LandingOutcome,
  type LandingTelemetry,
} from '@/domain/landing'

type FieldName = keyof LandingTelemetry
type FieldValues = Record<FieldName, string>

interface ActionResponse {
  success: boolean
  data?: { recordId: string; assessment: LandingAssessment }
  error?: string
  issues?: Array<{ path: string[]; message: string }>
}

const PRESETS: Record<'Safe' | 'Marginal' | 'Crash', FieldValues> = {
  Safe: {
    heightMeters: '100',
    descentSpeedMetersPerSecond: '10',
    enginePowerPercent: '100',
    tiltDegrees: '0',
  },
  Marginal: {
    heightMeters: '20',
    descentSpeedMetersPerSecond: '10',
    enginePowerPercent: '100',
    tiltDegrees: '0',
  },
  Crash: {
    heightMeters: '10',
    descentSpeedMetersPerSecond: '10',
    enginePowerPercent: '100',
    tiltDegrees: '0',
  },
}

const FIELD_CONFIG: Array<{
  name: FieldName
  label: string
  unit: string
  min: number
  max: number
  step: string
}> = [
  { name: 'heightMeters', label: 'Height above surface', unit: 'm', min: 0.01, max: 10_000, step: 'any' },
  { name: 'descentSpeedMetersPerSecond', label: 'Downward speed', unit: 'm/s', min: 0, max: 500, step: 'any' },
  { name: 'enginePowerPercent', label: 'Engine power', unit: '%', min: 0, max: 100, step: 'any' },
  { name: 'tiltDegrees', label: 'Tilt from vertical', unit: '°', min: 0, max: 90, step: 'any' },
]

const OUTCOME_STYLE: Record<LandingOutcome, { label: string; panel: string; text: string }> = {
  SAFE_APPROACH: {
    label: 'Safe approach',
    panel: 'border-success/40 bg-success/10',
    text: 'text-success',
  },
  MARGINAL: {
    label: 'Marginal',
    panel: 'border-warning/50 bg-warning/10',
    text: 'text-warning',
  },
  CRASH_LIKELY: {
    label: 'Crash likely',
    panel: 'border-destructive/50 bg-destructive/10',
    text: 'text-destructive',
  },
}

export default function LandingConsole() {
  const [values, setValues] = useState<FieldValues>(PRESETS.Safe)
  const [assessment, setAssessment] = useState<LandingAssessment | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const toast = useToast()
  const { records, status, error: queryError } = useQuery<LandingCheckRecord>('landing-checks', {
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 10,
  })
  const { ready, removeConfirmed } = useMutations<LandingCheckRecord>('landing-checks')

  const parsedTelemetry = useMemo(() => parseTelemetry(values), [values])

  const applyPreset = (name: keyof typeof PRESETS) => {
    setValues(PRESETS[name])
    setFieldErrors({})
    setAssessment(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return

    const localResult = assessLanding(parsedTelemetry)
    if (!localResult.valid) {
      setFieldErrors(
        Object.fromEntries(localResult.issues.map((issue) => [issue.field, issue.message])),
      )
      setAssessment(null)
      return
    }

    setFieldErrors({})
    setSubmitting(true)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Your sign-in session is unavailable. Please sign in again.')
      const response = await fetch('/api/actions/assessLanding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(parsedTelemetry),
      })
      const payload = (await response.json()) as ActionResponse
      if (!response.ok || !payload.success || !payload.data) {
        if (payload.issues) {
          const issues = payload.issues.flatMap((issue) => {
            const field = issue.path[0] as FieldName | undefined
            return field ? [[field, issue.message] as const] : []
          })
          setFieldErrors(Object.fromEntries(issues))
        }
        throw new Error(payload.error ?? 'The landing check could not be completed.')
      }
      setAssessment(payload.data.assessment)
    } catch (error) {
      toast.error(
        'Could not check the landing',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const deleteCheck = async (recordId: string) => {
    if (deletingId) return
    setDeletingId(recordId)
    try {
      await removeConfirmed(recordId)
      toast.success('Check deleted', 'The saved landing check was removed.')
    } catch (error) {
      toast.error(
        'Could not delete the check',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-primary">
              <Gauge className="size-6" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Lunar descent model · V2
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                Will I crash?
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Enter a lunar lander&apos;s current telemetry. The model estimates whether its
                vertical thrust can stop the descent before the surface.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <section className="space-y-6">
          <form noValidate onSubmit={(event) => void submit(event)} className="rounded-2xl border border-border bg-card p-5 shadow-[0_12px_50px_rgba(0,0,0,0.18)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Current telemetry</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose a preset or enter your own values.</p>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Landing presets">
                {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((name) => (
                  <Button key={name} type="button" variant="secondary" size="sm" onClick={() => applyPreset(name)}>
                    {name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {FIELD_CONFIG.map((field) => (
                <div key={field.name}>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <Label htmlFor={`landing-${field.name}`}>{field.label}</Label>
                    <span className="text-xs text-muted-foreground">{field.unit}</span>
                  </div>
                  <Input
                    id={`landing-${field.name}`}
                    data-testid={`landing-${field.name}`}
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={values[field.name]}
                    aria-invalid={Boolean(fieldErrors[field.name])}
                    aria-describedby={fieldErrors[field.name] ? `landing-${field.name}-error` : undefined}
                    onChange={(event) => {
                      setValues((current) => ({ ...current, [field.name]: event.target.value }))
                      setFieldErrors((current) => ({ ...current, [field.name]: undefined }))
                    }}
                  />
                  {fieldErrors[field.name] && (
                    <p id={`landing-${field.name}-error`} className="mt-1.5 text-xs text-destructive">
                      {fieldErrors[field.name]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Button data-testid="check-landing" className="mt-6 w-full" type="submit" size="lg" loading={submitting}>
              Check landing
            </Button>
          </form>

          {assessment ? (
            <AssessmentCard assessment={assessment} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
              <ShieldCheck className="mx-auto size-7 text-muted-foreground" aria-hidden />
              <p className="mt-3 font-medium text-foreground">Your result will appear here</p>
              <p className="mt-1 text-sm text-muted-foreground">Each successful check is also saved to your private history.</p>
            </div>
          )}
        </section>

        <section data-testid="landing-history" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Recent checks</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your 10 most recent assessments, updated live.</p>
            </div>
            <RotateCcw className="mt-1 size-4 text-muted-foreground" aria-hidden />
          </div>

          {status === 'loading' ? (
            <div className="mt-6 space-y-3" aria-label="Loading landing history">
              {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-muted/50" />)}
            </div>
          ) : status === 'error' ? (
            <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {queryError ?? 'History could not be loaded.'}
            </div>
          ) : records.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No saved checks yet.
            </div>
          ) : (
            <ol className="mt-5 space-y-3">
              {records.map((record) => {
                const style = OUTCOME_STYLE[record.data.outcome]
                return (
                  <li key={record.recordId} className="rounded-xl border border-border bg-background/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-sm font-semibold ${style.text}`}>{style.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(record.createdAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label="Delete landing check"
                        disabled={!ready || deletingId === record.recordId}
                        onClick={() => void deleteCheck(record.recordId)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                    <p className="mt-3 text-sm text-foreground">
                      {formatNumber(record.data.heightMeters)} m high · {formatNumber(record.data.descentSpeedMetersPerSecond)} m/s down
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatNumber(record.data.enginePowerPercent)}% power · {formatNumber(record.data.tiltDegrees)}° tilt
                    </p>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs leading-5 text-muted-foreground sm:px-6">
        Educational estimate only. Assumes constant throttle and tilt, lunar gravity of 1.62 m/s²,
        no atmosphere, and no horizontal velocity.
      </footer>
    </div>
  )
}

function AssessmentCard({ assessment }: { assessment: LandingAssessment }) {
  const style = OUTCOME_STYLE[assessment.outcome]
  return (
    <section data-testid="landing-result" aria-live="polite" className={`rounded-2xl border p-5 sm:p-6 ${style.panel}`}>
      <div className="flex items-start gap-3">
        {assessment.outcome === 'SAFE_APPROACH' ? (
          <ShieldCheck className={`mt-0.5 size-6 ${style.text}`} aria-hidden />
        ) : (
          <TriangleAlert className={`mt-0.5 size-6 ${style.text}`} aria-hidden />
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Assessment</p>
          <h2 className={`mt-1 text-2xl font-bold ${style.text}`}>{style.label}</h2>
          <p className="mt-2 text-sm leading-6 text-foreground">{assessment.explanation}</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Stopping distance" value={formatMetric(assessment.stoppingDistanceMeters, 'm')} />
        <Metric label="Altitude margin" value={formatMetric(assessment.altitudeMarginMeters, 'm')} />
        <Metric label="Net braking" value={formatMetric(assessment.netBrakingAcceleration, 'm/s²')} />
        <Metric label="Minimum power" value={formatMetric(assessment.requiredThrottlePercent, '%')} />
      </dl>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-foreground">{value}</dd>
    </div>
  )
}

function parseTelemetry(values: FieldValues): LandingTelemetry {
  return {
    heightMeters: parseField(values.heightMeters),
    descentSpeedMetersPerSecond: parseField(values.descentSpeedMetersPerSecond),
    enginePowerPercent: parseField(values.enginePowerPercent),
    tiltDegrees: parseField(values.tiltDegrees),
  }
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
