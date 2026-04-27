import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { CheckCircle2, Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CustomerHeader } from "@/components/customer-header"
import {
  ApiError,
  getGuilds,
  getMyServerTemplates,
  installServerTemplateWithResult,
  liftBotRole,
  type Guild,
  type InstallApplyResult,
  type ServerTemplate,
} from "@/lib/api"

const BOT_INVITE_URL = import.meta.env.VITE_BOT_INVITE_URL as string | undefined

type Step = 1 | 2 | 3

export function InstallWizardPage() {
  const navigate = useNavigate()
  const { templateId } = useParams<{ templateId: string }>()

  const [template, setTemplate] = useState<ServerTemplate | null>(null)
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [guildId, setGuildId] = useState("")
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [step1Done, setStep1Done] = useState(false)
  const [step2Done, setStep2Done] = useState(false)

  const [installing, setInstalling] = useState(false)
  const [installResult, setInstallResult] = useState<InstallApplyResult | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [botRoleLifted, setBotRoleLifted] = useState<null | { ok: boolean; needsManual?: boolean }>(null)

  const [waitSeconds, setWaitSeconds] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  // ID серверов, которые были в списке на момент входа на Шаг 3.
  // Всё, что появилось потом, — это "новые" серверы (пометим бейджем).
  const [baselineGuildIds, setBaselineGuildIds] = useState<Set<string> | null>(null)

  useEffect(() => {
    Promise.all([getMyServerTemplates(), getGuilds()])
      .then(([templates, g]) => {
        const found = templates.find((t) => t.id === templateId) ?? null
        setTemplate(found)
        setGuilds(g)
        if (g.length === 1) setGuildId(g[0].id)
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
        setPageError(e instanceof Error ? e.message : "Loading error")
      })
      .finally(() => setLoading(false))
  }, [navigate, templateId])

  async function refreshGuilds(opts?: { force?: boolean }) {
    setRefreshing(true)
    try {
      const g = await getGuilds({ forceRefresh: opts?.force })
      setGuilds(g)
      if (!guildId) {
        // Если есть новые серверы (появились после входа на Шаг 3) — автовыбор первого нового
        const newOnes = baselineGuildIds
          ? g.filter((x) => !baselineGuildIds.has(x.id))
          : []
        if (newOnes.length === 1) setGuildId(newOnes[0].id)
        else if (g.length === 1) setGuildId(g[0].id)
      }
    } catch {
      // not critical
    } finally {
      setRefreshing(false)
    }
  }

  // Фиксируем baseline серверов при входе на Шаг 3
  useEffect(() => {
    if (currentStep === 3 && baselineGuildIds === null) {
      setBaselineGuildIds(new Set(guilds.map((g) => g.id)))
    }
  }, [currentStep, guilds, baselineGuildIds])

  // Автообновление списка серверов на шаге 3.
  // Пока не появилось новых серверов (относительно baseline) — force-refresh каждые 5 сек (обходит 60-сек кэш).
  // Когда новый сервер появился — мягко обновляем каждые 10 сек.
  useEffect(() => {
    if (currentStep !== 3) return
    if (installing || installResult) return

    const hasNew = baselineGuildIds
      ? guilds.some((g) => !baselineGuildIds.has(g.id))
      : false
    const intervalMs = hasNew ? 10000 : 5000
    const interval = setInterval(() => {
      refreshGuilds({ force: !hasNew })
    }, intervalMs)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, installing, installResult, guilds, baselineGuildIds])

  // Счётчик ожидания — тикает пока не появились новые серверы (после baseline)
  useEffect(() => {
    if (currentStep !== 3 || installResult) {
      setWaitSeconds(0)
      return
    }
    const hasNew = baselineGuildIds
      ? guilds.some((g) => !baselineGuildIds.has(g.id))
      : false
    if (hasNew) {
      setWaitSeconds(0)
      return
    }
    const tick = setInterval(() => setWaitSeconds((s) => s + 1), 1000)
    return () => clearInterval(tick)
  }, [currentStep, guilds, installResult, baselineGuildIds])

  async function handleInstall() {
    if (!guildId || !templateId) return
    setInstalling(true)
    setInstallError(null)
    setBotRoleLifted(null)
    try {
      const result = await installServerTemplateWithResult(guildId, templateId)
      setInstallResult(result)
      // Сразу пытаемся поднять роль бота через OAuth-токен пользователя.
      // Если Discord не примет — покажем инструкцию сделать вручную.
      try {
        const lift = await liftBotRole(guildId)
        setBotRoleLifted({ ok: lift.ok, needsManual: lift.needsManual })
      } catch {
        setBotRoleLifted({ ok: false, needsManual: true })
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      setInstallError(e instanceof Error ? e.message : "Install error")
    } finally {
      setInstalling(false)
    }
  }

  function handleStep1Click() {
    if (template?.discordTemplateUrl) {
      window.open(template.discordTemplateUrl, "_blank", "noopener,noreferrer")
    }
    setStep1Done(true)
  }

  function handleStep2Click() {
    if (BOT_INVITE_URL) {
      window.open(BOT_INVITE_URL, "_blank", "noopener,noreferrer")
    }
    refreshGuilds()
    setStep2Done(true)
  }

  function confirmStep1() {
    setStep1Done(true)
    setCurrentStep(2)
  }

  function confirmStep2() {
    setStep2Done(true)
    setCurrentStep(3)
    refreshGuilds()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <CustomerHeader title="Template installation" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <CustomerHeader title="Template installation" />
        <div className="container mx-auto max-w-2xl px-4 py-8">
          <p className="text-[hsl(var(--destructive))]">{pageError}</p>
          <Link to="/" className="text-[hsl(var(--primary))] hover:underline mt-4 inline-block">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  // Final success screen
  if (installResult?.ok) {
    const s = installResult.summary
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <CustomerHeader title="Installation complete" />
        <main className="container mx-auto max-w-2xl px-4 py-12 flex flex-col items-center text-center space-y-6">
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-16 w-16 text-[hsl(var(--primary))]" />
            <h1 className="text-2xl font-bold">Server installed successfully!</h1>
            <p className="text-[hsl(var(--muted-foreground))] max-w-sm">
              All extra elements have been deployed. Your Discord server is ready to use.
            </p>
          </div>

          {s && (
            <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {s.rolesCreated > 0 && <StatCard label="Roles" value={s.rolesCreated} />}
              {s.channelsCreated > 0 && <StatCard label="Channels" value={s.channelsCreated} />}
              {s.messagesSent > 0 && <StatCard label="Messages" value={s.messagesSent} />}
              {s.reactionRolesBound > 0 && <StatCard label="Auto-roles" value={s.reactionRolesBound} />}
              {s.logChannelsSet > 0 && <StatCard label="Log channels" value={s.logChannelsSet} />}
            </div>
          )}

          {installResult.warnings && installResult.warnings.length > 0 && (
            <div className="w-full text-left p-4 rounded-lg bg-[hsl(var(--muted))] text-sm space-y-1">
              <p className="font-medium text-[hsl(var(--muted-foreground))]">Warnings:</p>
              <ul className="list-disc pl-5 space-y-1 text-[hsl(var(--muted-foreground))]">
                {installResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Bot role lift status */}
          {botRoleLifted?.ok && (
            <div className="w-full text-left p-4 rounded-lg bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.3)] text-sm">
              <p className="font-medium text-[hsl(var(--primary))]">
                ✓ Bot role automatically promoted on the server
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Auto-role buttons should work without any extra action.
              </p>
            </div>
          )}
          {botRoleLifted?.needsManual && (
            <div className="w-full text-left p-4 rounded-lg bg-[hsl(var(--muted))] border text-sm space-y-2">
              <p className="font-medium">
                ⚠ You need to promote the bot role manually one time
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Discord did not allow updating the role hierarchy automatically. To make the auto-role
                buttons work, open in Discord:
              </p>
              <ol className="text-xs text-[hsl(var(--muted-foreground))] list-decimal pl-5 space-y-0.5">
                <li><b>Server Settings</b> → <b>Roles</b></li>
                <li>Find the bot role (usually named after the bot, e.g. "Level UP")</li>
                <li>Drag it <b>to the top</b>, above all roles that should be assigned by buttons</li>
                <li>Click <b>Save Changes</b></li>
              </ol>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                This is a one-time action. After that all auto-role buttons will work.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg">
              <a href="https://discord.com" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Discord
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/my-servers">My servers</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <CustomerHeader title="Template installation" />

      <main className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{template?.name ?? "Template installation"}</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">
            Follow three simple steps to deploy a fully configured Discord server
          </p>
        </div>

        {/* Progress bar */}
        <StepProgress currentStep={currentStep} step1Done={step1Done} step2Done={step2Done} done={false} />

        {/* Step 1 */}
        <StepCard
          number={1}
          title="Create server from Discord template"
          done={step1Done}
          active={currentStep === 1}
        >
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Click the button to open the Discord template. Create a new server — Discord will ask you
            for a name and icon.
          </p>
          <Button
            onClick={handleStep1Click}
            disabled={!template?.discordTemplateUrl}
            className="w-full sm:w-auto"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Install server template
          </Button>
          {!template?.discordTemplateUrl && (
            <p className="text-xs text-[hsl(var(--destructive))]">Template URL is not set</p>
          )}
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            After creating the server in Discord, return to this page and click "Continue".
          </p>
          {!step1Done && (
            <Button variant="outline" size="sm" onClick={confirmStep1} className="w-full sm:w-auto">
              I created the server — continue
            </Button>
          )}
          {step1Done && currentStep === 1 && (
            <Button size="sm" onClick={() => setCurrentStep(2)} className="w-full sm:w-auto">
              Continue →
            </Button>
          )}
        </StepCard>

        {/* Step 2 */}
        <StepCard
          number={2}
          title="Add the bot to the server"
          done={step2Done}
          active={currentStep === 2}
          locked={!step1Done}
        >
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Click the button to add the bot. When Discord asks which server to add it to, pick the one
            you just created in step one.
          </p>
          <Button
            onClick={handleStep2Click}
            disabled={!BOT_INVITE_URL}
            className="w-full sm:w-auto"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Add bot to server
          </Button>
          {!BOT_INVITE_URL && (
            <p className="text-xs text-[hsl(var(--destructive))]">Bot invite URL is not configured</p>
          )}
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            After adding the bot return to this page and click "Continue".
          </p>
          {!step2Done && currentStep === 2 && (
            <Button variant="outline" size="sm" onClick={confirmStep2} className="w-full sm:w-auto">
              I added the bot — continue
            </Button>
          )}
          {step2Done && currentStep === 2 && (
            <Button size="sm" onClick={() => setCurrentStep(3)} className="w-full sm:w-auto">
              Continue →
            </Button>
          )}
        </StepCard>

        {/* Step 3 */}
        <StepCard
          number={3}
          title="Deploy extra features"
          done={!!installResult?.ok}
          active={currentStep === 3}
          locked={!step2Done}
        >
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Pick the server you just created and click "Finish installation". The bot will automatically
            deploy all messages, auto-roles, logs and other features.
          </p>

          <div className="space-y-3">
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Pick a server</p>
              <Select value={guildId || "__none__"} onValueChange={(v) => setGuildId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a server from the list" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not selected</SelectItem>
                  {[...guilds].sort((a, b) => {
                    const aNew = baselineGuildIds && !baselineGuildIds.has(a.id)
                    const bNew = baselineGuildIds && !baselineGuildIds.has(b.id)
                    if (aNew && !bNew) return -1
                    if (!aNew && bNew) return 1
                    return a.name.localeCompare(b.name)
                  }).map((g) => {
                    const isNew = baselineGuildIds && !baselineGuildIds.has(g.id)
                    return (
                      <SelectItem key={g.id} value={g.id}>
                        <span className="flex items-center gap-2">
                          {g.name}
                          {isNew && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold">
                              NEW
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {(() => {
                const newCount = baselineGuildIds
                  ? guilds.filter((g) => !baselineGuildIds.has(g.id)).length
                  : 0
                const hasNew = newCount > 0
                const isEmpty = guilds.length === 0
                if (installResult) return null

                return (
                  <div className="rounded-lg border border-dashed p-3 space-y-2 bg-[hsl(var(--muted)/0.3)]">
                    {isEmpty ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--primary))]" />
                        <span>Waiting for the server to appear… ({waitSeconds}s)</span>
                      </div>
                    ) : hasNew ? (
                      <div className="flex items-center gap-2 text-sm text-[hsl(var(--primary))]">
                        <span className="font-medium">✓ A new server appeared in the list</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--primary))]" />
                        <span>Waiting for a new server to appear… ({waitSeconds}s)</span>
                      </div>
                    )}

                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      After adding the bot, the server needs time to appear in the Discord API — usually <b>up to 2–3 minutes</b>.
                      Don't close the page, the list will refresh automatically.
                      {guilds.length > 1 && " New servers are marked with a \"NEW\" badge and pinned to the top of the list."}
                    </p>

                    {waitSeconds > 30 && !hasNew && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        Still no server? Make sure that:
                        {" "}(1) the bot was actually added to the right server;
                        {" "}(2) you have administrator permissions on that server.
                      </p>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refreshGuilds({ force: true })}
                      disabled={refreshing}
                    >
                      {refreshing ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Refreshing…</>
                      ) : (
                        "Refresh now"
                      )}
                    </Button>
                  </div>
                )
              })()}
            </div>

            <Button
              onClick={handleInstall}
              disabled={!guildId || installing}
              className="w-full sm:w-auto"
              size="lg"
            >
              {installing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Installing…
                </>
              ) : (
                "Finish installation"
              )}
            </Button>
          </div>

          {installError && (
            <p className="text-sm text-[hsl(var(--destructive))]">{installError}</p>
          )}

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Click the button to automatically install all extra elements on the server.
            This will finish setup and deploy the entire feature set.
          </p>
        </StepCard>
      </main>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepProgress({
  currentStep,
  step1Done,
  step2Done,
  done,
}: {
  currentStep: Step
  step1Done: boolean
  step2Done: boolean
  done: boolean
}) {
  const steps = [
    { n: 1 as Step, label: "Server template", done: step1Done },
    { n: 2 as Step, label: "Add bot", done: step2Done },
    { n: 3 as Step, label: "Deploy", done },
  ]
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((step, idx) => (
        <div key={step.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={[
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                step.done
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : currentStep === step.n
                  ? "border-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                  : "border-2 border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
              ].join(" ")}
            >
              {step.done ? <CheckCircle2 className="h-5 w-5" /> : step.n}
            </div>
            <span
              className={[
                "text-xs hidden sm:block",
                currentStep === step.n
                  ? "text-[hsl(var(--foreground))] font-medium"
                  : "text-[hsl(var(--muted-foreground))]",
              ].join(" ")}
            >
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={[
                "h-0.5 w-16 sm:w-24 mx-1 mb-5 transition-colors",
                step.done ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--border))]",
              ].join(" ")}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function StepCard({
  number,
  title,
  done,
  active,
  locked = false,
  children,
}: {
  number: number
  title: string
  done: boolean
  active: boolean
  locked?: boolean
  children: React.ReactNode
}) {
  return (
    <Card
      className={[
        "transition-all",
        done
          ? "border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.04)]"
          : active
          ? "border-[hsl(var(--primary)/0.6)] shadow-sm"
          : "opacity-50",
      ].join(" ")}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div
            className={[
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
              done
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : active
                ? "border-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                : "border-2 border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
            ].join(" ")}
          >
            {done ? <CheckCircle2 className="h-4 w-4" /> : number}
          </div>
          <CardTitle className="text-base">
            {title}
            {done && (
              <span className="ml-2 text-xs font-normal text-[hsl(var(--primary))]">Done</span>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      {(active || done) && !locked && (
        <CardContent className="space-y-3 pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-2xl font-bold text-[hsl(var(--primary))]">{value}</p>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
    </div>
  )
}
