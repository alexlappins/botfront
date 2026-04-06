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
        setPageError(e instanceof Error ? e.message : "Ошибка загрузки")
      })
      .finally(() => setLoading(false))
  }, [navigate, templateId])

  async function refreshGuilds() {
    try {
      const g = await getGuilds()
      setGuilds(g)
      if (g.length === 1) setGuildId(g[0].id)
    } catch {
      // not critical
    }
  }

  async function handleInstall() {
    if (!guildId || !templateId) return
    setInstalling(true)
    setInstallError(null)
    try {
      const result = await installServerTemplateWithResult(guildId, templateId)
      setInstallResult(result)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      setInstallError(e instanceof Error ? e.message : "Ошибка установки")
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
        <CustomerHeader title="Установка шаблона" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <CustomerHeader title="Установка шаблона" />
        <div className="container mx-auto max-w-2xl px-4 py-8">
          <p className="text-[hsl(var(--destructive))]">{pageError}</p>
          <Link to="/" className="text-[hsl(var(--primary))] hover:underline mt-4 inline-block">
            На главную
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
        <CustomerHeader title="Установка завершена" />
        <main className="container mx-auto max-w-2xl px-4 py-12 flex flex-col items-center text-center space-y-6">
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-16 w-16 text-[hsl(var(--primary))]" />
            <h1 className="text-2xl font-bold">Сервер успешно установлен!</h1>
            <p className="text-[hsl(var(--muted-foreground))] max-w-sm">
              Все дополнительные элементы развёрнуты. Ваш Discord-сервер готов к использованию.
            </p>
          </div>

          {s && (
            <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {s.rolesCreated > 0 && <StatCard label="Роли" value={s.rolesCreated} />}
              {s.channelsCreated > 0 && <StatCard label="Каналы" value={s.channelsCreated} />}
              {s.messagesSent > 0 && <StatCard label="Сообщения" value={s.messagesSent} />}
              {s.reactionRolesBound > 0 && <StatCard label="Автороли" value={s.reactionRolesBound} />}
              {s.logChannelsSet > 0 && <StatCard label="Каналы логов" value={s.logChannelsSet} />}
            </div>
          )}

          {installResult.warnings && installResult.warnings.length > 0 && (
            <div className="w-full text-left p-4 rounded-lg bg-[hsl(var(--muted))] text-sm space-y-1">
              <p className="font-medium text-[hsl(var(--muted-foreground))]">Предупреждения:</p>
              <ul className="list-disc pl-5 space-y-1 text-[hsl(var(--muted-foreground))]">
                {installResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg">
              <a href="https://discord.com" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Открыть Discord
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/my-servers">Мои серверы</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <CustomerHeader title="Установка шаблона" />

      <main className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{template?.name ?? "Установка шаблона"}</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">
            Следуйте трём простым шагам, чтобы развернуть готовый Discord-сервер
          </p>
        </div>

        {/* Progress bar */}
        <StepProgress currentStep={currentStep} step1Done={step1Done} step2Done={step2Done} done={false} />

        {/* Step 1 */}
        <StepCard
          number={1}
          title="Создать сервер по шаблону Discord"
          done={step1Done}
          active={currentStep === 1}
        >
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Нажмите на кнопку, чтобы открыть шаблон Discord. Создайте новый сервер — Discord сам предложит
            задать название и иконку.
          </p>
          <Button
            onClick={handleStep1Click}
            disabled={!template?.discordTemplateUrl}
            className="w-full sm:w-auto"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Установить шаблон сервера
          </Button>
          {!template?.discordTemplateUrl && (
            <p className="text-xs text-[hsl(var(--destructive))]">Ссылка шаблона не задана</p>
          )}
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            После создания сервера в Discord вернитесь на эту страницу и нажмите «Продолжить».
          </p>
          {!step1Done && (
            <Button variant="outline" size="sm" onClick={confirmStep1} className="w-full sm:w-auto">
              Я создал сервер — продолжить
            </Button>
          )}
          {step1Done && currentStep === 1 && (
            <Button size="sm" onClick={() => setCurrentStep(2)} className="w-full sm:w-auto">
              Продолжить →
            </Button>
          )}
        </StepCard>

        {/* Step 2 */}
        <StepCard
          number={2}
          title="Добавить бота на сервер"
          done={step2Done}
          active={currentStep === 2}
          locked={!step1Done}
        >
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Нажмите на кнопку, чтобы добавить бота. Когда Discord спросит, на какой сервер, выберите тот,
            что вы только что создали на первом шаге.
          </p>
          <Button
            onClick={handleStep2Click}
            disabled={!BOT_INVITE_URL}
            className="w-full sm:w-auto"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Добавить бота на сервер
          </Button>
          {!BOT_INVITE_URL && (
            <p className="text-xs text-[hsl(var(--destructive))]">Ссылка приглашения бота не настроена</p>
          )}
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            После добавления бота вернитесь на эту страницу и нажмите «Продолжить».
          </p>
          {!step2Done && currentStep === 2 && (
            <Button variant="outline" size="sm" onClick={confirmStep2} className="w-full sm:w-auto">
              Я добавил бота — продолжить
            </Button>
          )}
          {step2Done && currentStep === 2 && (
            <Button size="sm" onClick={() => setCurrentStep(3)} className="w-full sm:w-auto">
              Продолжить →
            </Button>
          )}
        </StepCard>

        {/* Step 3 */}
        <StepCard
          number={3}
          title="Развернуть дополнительные функции"
          done={!!installResult?.ok}
          active={currentStep === 3}
          locked={!step2Done}
        >
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Выберите сервер, который вы только что создали, и нажмите «Завершить установку». Бот автоматически
            развернёт все сообщения, автороли, логи и другие функции.
          </p>

          <div className="space-y-3">
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Выберите сервер</p>
              <Select value={guildId || "__none__"} onValueChange={(v) => setGuildId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите сервер из списка" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Не выбрано</SelectItem>
                  {guilds.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {guilds.length === 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Серверов не найдено. Убедитесь, что бот добавлен на сервер, и{" "}
                  <button onClick={refreshGuilds} className="underline hover:no-underline">
                    обновите список
                  </button>
                  .
                </p>
              )}
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
                  Установка…
                </>
              ) : (
                "Завершить установку"
              )}
            </Button>
          </div>

          {installError && (
            <p className="text-sm text-[hsl(var(--destructive))]">{installError}</p>
          )}

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Нажмите кнопку, чтобы автоматически установить все дополнительные элементы сервера.
            Это завершит настройку и развернёт весь функционал.
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
    { n: 1 as Step, label: "Шаблон сервера", done: step1Done },
    { n: 2 as Step, label: "Добавить бота", done: step2Done },
    { n: 3 as Step, label: "Развернуть", done },
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
              <span className="ml-2 text-xs font-normal text-[hsl(var(--primary))]">Выполнено</span>
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
