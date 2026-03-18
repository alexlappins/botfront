import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerTemplates, installServerTemplate, type ServerTemplate } from "@/lib/api"
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
  const [templates, setTemplates] = useState<ServerTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [installSuccess, setInstallSuccess] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const list = await getServerTemplates()
      setTemplates(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки шаблонов")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleInstall(templateId: string) {
    if (!guildId) return
    setInstallError(null)
    setInstallSuccess(false)
    setInstallingId(templateId)
    try {
      await installServerTemplate(guildId, templateId)
      setInstallSuccess(true)
      setTimeout(() => setInstallSuccess(false), 4000)
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : "Ошибка установки")
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
            Выберите готовый шаблон — бот развернёт на этом сервере структуру, роли, каналы, эмодзи, сообщения и настройки логов. Один шаблон можно установить только один раз на сервер.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {installSuccess && (
            <p className="text-sm text-[hsl(var(--primary))]">Шаблон успешно установлен.</p>
          )}
          {installError && (
            <p className="text-sm text-[hsl(var(--destructive))]">{installError}</p>
          )}
          {loading ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Загрузка шаблонов…</p>
          ) : error ? (
            <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Нет доступных шаблонов.</p>
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
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                      {formatDate(t.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {t.discordTemplateUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a href={t.discordTemplateUrl} target="_blank" rel="noreferrer">
                          Открыть Discord‑шаблон
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleInstall(t.id)}
                      disabled={!!installingId}
                    >
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
