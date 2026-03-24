import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CustomerHeader } from "@/components/customer-header"
import {
  ApiError,
  checkInstallServerTemplate,
  getGuilds,
  getMyServerTemplates,
  installServerTemplateWithResult,
  type Guild,
  type InstallApplyResult,
  type InstallCheckResult,
  type ServerTemplate,
} from "@/lib/api"

export function InstallWizardPage() {
  const navigate = useNavigate()
  const { templateId } = useParams<{ templateId: string }>()
  const [templates, setTemplates] = useState<ServerTemplate[]>([])
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [guildId, setGuildId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<InstallCheckResult | null>(null)
  const [installResult, setInstallResult] = useState<InstallApplyResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [allowInstallWithWarnings, setAllowInstallWithWarnings] = useState(false)

  const template = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId])

  useEffect(() => {
    Promise.all([getMyServerTemplates(), getGuilds()])
      .then(([t, g]) => {
        setTemplates(t)
        setGuilds(g)
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
        if (e instanceof ApiError && e.status === 403) return setError("Нет доступа")
        setError(e instanceof Error ? e.message : "Ошибка загрузки")
      })
      .finally(() => setLoading(false))
  }, [navigate])

  if (!templateId) return null

  async function runCheck() {
    if (!guildId) return
    setChecking(true)
    setError(null)
    setInstallResult(null)
    try {
      setCheckResult(await checkInstallServerTemplate(guildId, templateId!))
      setAllowInstallWithWarnings(false)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      if (e instanceof ApiError && e.status === 403) return setError("Нет доступа")
      setError(e instanceof Error ? e.message : "Ошибка preflight")
      setCheckResult(null)
    } finally {
      setChecking(false)
    }
  }

  async function runInstall() {
    if (!guildId) return
    if ((checkResult?.warnings?.length ?? 0) > 0 && !allowInstallWithWarnings) return
    setInstalling(true)
    setError(null)
    try {
      setInstallResult(await installServerTemplateWithResult(guildId, templateId!))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      if (e instanceof ApiError && e.status === 403) return setError("Нет доступа")
      setError(e instanceof Error ? e.message : "Ошибка установки")
      setInstallResult(null)
    } finally {
      setInstalling(false)
    }
  }

  const warnings = checkResult?.warnings ?? []
  const checks = checkResult?.checks ?? {}

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <CustomerHeader title="Установка шаблона" />
      <main className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
        {loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Загрузка...</p> : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Шаг A: Создать сервер по Discord-шаблону</CardTitle>
                <CardDescription>
                  Откройте Discord шаблон, создайте сервер, затем выберите его ниже.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-medium">{template?.name ?? templateId}</p>
                {template?.discordTemplateUrl ? (
                  <Button asChild><a href={template.discordTemplateUrl} target="_blank" rel="noreferrer">Open Discord Template</a></Button>
                ) : (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Ссылка Discord-шаблона не задана.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Шаг B: Выбрать целевой сервер</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 max-w-md">
                  <Label>Сервер</Label>
                  <Select value={guildId || "__none__"} onValueChange={(v) => setGuildId(v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите сервер" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Не выбрано</SelectItem>
                      {guilds.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={runCheck} disabled={!guildId || checking}>
                    {checking ? "Проверка..." : "Шаг C: Preflight check"}
                  </Button>
                  <Button onClick={runInstall} disabled={!guildId || installing}>
                    {installing ? "Установка..." : "Шаг D: Применить настройки бота"}
                  </Button>
                </div>
                {warnings.length > 0 && (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowInstallWithWarnings}
                      onChange={(e) => setAllowInstallWithWarnings(e.target.checked)}
                      className="mt-1"
                    />
                    Продолжить установку, несмотря на предупреждения preflight
                  </label>
                )}
              </CardContent>
            </Card>

            {checkResult && (
              <Card>
                <CardHeader><CardTitle>Результат preflight</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {warnings.length > 0 && (
                    <div>
                      <p className="font-medium">Warnings:</p>
                      <ul className="list-disc pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                    </div>
                  )}
                  {Object.entries(checks).map(([k, list]) => (
                    <div key={k}>
                      <p className="font-medium">{k}</p>
                      <ul className="list-disc pl-5">{(list ?? []).map((x) => <li key={x}>{x}</li>)}</ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {installResult && (
              <Card>
                <CardHeader><CardTitle>Результат установки</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {installResult.summary && (
                    <div>
                      <p className="font-medium">Summary</p>
                      <ul className="list-disc pl-5">
                        {Object.entries(installResult.summary).map(([k, v]) => <li key={k}>{k}: {v}</li>)}
                      </ul>
                    </div>
                  )}
                  {installResult.warnings && installResult.warnings.length > 0 && (
                    <div>
                      <p className="font-medium">Warnings</p>
                      <ul className="list-disc pl-5">{installResult.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                    </div>
                  )}
                  {installResult.skipped && (
                    <div>
                      <p className="font-medium">Skipped</p>
                      {Object.entries(installResult.skipped).map(([k, arr]) => (
                        <div key={k}>
                          <p>{k}</p>
                          <ul className="list-disc pl-5">{arr.map((x) => <li key={x}>{x}</li>)}</ul>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {guildId ? (
                      <Button asChild>
                        <Link to={`/guild/${guildId}`}>Открыть настройки сервера</Link>
                      </Button>
                    ) : null}
                    <Button variant="outline" asChild>
                      <Link to="/my-servers">Мои серверы</Link>
                    </Button>
                    <Button variant="outline" onClick={runInstall} disabled={!guildId || installing}>
                      Повторить установку
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
