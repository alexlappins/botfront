import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ApiError,
  getMyServerTemplates,
  installServerTemplateWithResult,
  type InstallApplyResult,
  type ServerTemplate,
} from "@/lib/api"
import { ServerCog } from "lucide-react"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function GuildInstallTemplatePage() {
  const { guildId } = useParams<{ guildId: string }>()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<ServerTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [installResult, setInstallResult] = useState<InstallApplyResult | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const list = await getMyServerTemplates()
      setTemplates(list)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate("/login", { replace: true })
        return
      }
      if (e instanceof ApiError && e.status === 403) {
        setError("Нет доступа к списку шаблонов (купите шаблон или получите доступ).")
        return
      }
      setError(e instanceof Error ? e.message : "Ошибка загрузки шаблонов")
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    load()
  }, [load])

  async function handleInstall(templateId: string) {
    if (!guildId) return
    setInstallError(null)
    setInstallResult(null)
    setInstallingId(templateId)
    try {
      const result = await installServerTemplateWithResult(guildId, templateId)
      setInstallResult(result)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate("/login", { replace: true })
        return
      }
      setInstallError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Ошибка установки")
    } finally {
      setInstallingId(null)
    }
  }

  if (!guildId) return null

  return (
    <div className="space-y-6 sm:space-y-8">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ServerCog className="h-5 w-5" />
            Установить шаблон сервера
          </CardTitle>
          <CardDescription>
            Список — только шаблоны, к которым у вас есть доступ (покупка / выдача). Установка целиком делает бот по{" "}
            <code className="text-xs">POST /api/guilds/…/install-template</code> (сообщения, автороли, логи и т.д. — на
            стороне сервера). Если что-то пропущено, смотрите блок «Результат установки» ниже (skipped / warnings).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {installResult && (
            <Card className="border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--muted)/0.2)]">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Результат установки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm pt-0">
                {installResult.summary && Object.keys(installResult.summary).length > 0 && (
                  <div>
                    <p className="font-medium">Сводка</p>
                    <ul className="list-disc pl-5">
                      {Object.entries(installResult.summary).map(([k, v]) => (
                        <li key={k}>
                          {k}: {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {installResult.warnings && installResult.warnings.length > 0 && (
                  <div>
                    <p className="font-medium">Предупреждения</p>
                    <ul className="list-disc pl-5">
                      {installResult.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {installResult.skipped && Object.keys(installResult.skipped).length > 0 && (
                  <div>
                    <p className="font-medium">Пропущено</p>
                    {Object.entries(installResult.skipped).map(([k, arr]) => (
                      <div key={k}>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{k}</p>
                        <ul className="list-disc pl-5">{arr.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" asChild>
                    <Link to={`/guild/${guildId}`}>Настройки сервера</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/my-servers">Мои серверы</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {installError && <p className="text-sm text-[hsl(var(--destructive))]">{installError}</p>}
          {loading ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Загрузка шаблонов…</p>
          ) : error ? (
            <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Нет доступных шаблонов. Оформите покупку в магазине или попросите администратора выдать доступ.
            </p>
          ) : (
            <ul className="space-y-4">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-[hsl(var(--border))] p-4 bg-[hsl(var(--muted)/0.3)] flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.name}</p>
                    {t.description && (
                      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{t.description}</p>
                    )}
                    {t.discordTemplateUrl && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 break-all">
                        Discord‑шаблон:{" "}
                        <a
                          href={t.discordTemplateUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[hsl(var(--primary))] hover:underline"
                        >
                          открыть
                        </a>
                      </p>
                    )}
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">{formatDate(t.createdAt)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {t.discordTemplateUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={t.discordTemplateUrl} target="_blank" rel="noreferrer">
                          Открыть Discord‑шаблон
                        </a>
                      </Button>
                    )}
                    <Button size="sm" onClick={() => void handleInstall(t.id)} disabled={!!installingId}>
                      {installingId === t.id ? "Установка…" : "Установить на этот сервер"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
