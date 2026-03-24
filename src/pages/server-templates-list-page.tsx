import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AdminHeader } from "@/components/admin-header"
import { useAuth } from "@/contexts/auth-context"
import { getServerTemplates, createServerTemplate, type ServerTemplate } from "@/lib/api"
import { Plus } from "lucide-react"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function ServerTemplatesListPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<ServerTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createDiscordUrl, setCreateDiscordUrl] = useState("")

  useEffect(() => {
    if (!user) return
    getServerTemplates()
      .then(setTemplates)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true })
  }, [authLoading, user, navigate])

  async function handleCreate() {
    const name = createName.trim()
    if (!name) return
    setCreateError(null)
    setCreating(true)
    try {
      const created = await createServerTemplate({
        name,
        description: createDescription.trim() || null,
        discordTemplateUrl: createDiscordUrl.trim() || null,
      })
      setTemplates((prev) => [created, ...prev])
      setCreateOpen(false)
      setCreateName("")
      setCreateDescription("")
      setCreateDiscordUrl("")
      navigate(`/server-templates/${created.id}`)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Ошибка создания")
    } finally {
      setCreating(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <AdminHeader title="Редактор шаблонов сервера" />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]">
            {error}
          </div>
        )}
        <div className="flex justify-end mb-6">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Создать шаблон
          </Button>
        </div>
        {loading ? (
          <p className="text-[hsl(var(--muted-foreground))]">Загрузка…</p>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-[hsl(var(--muted-foreground))]">
              <p>Нет шаблонов.</p>
              <p className="text-sm mt-2">Создайте шаблон и настройте роли, каналы, сообщения и автороли для развёртывания на серверах.</p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Создать шаблон
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {templates.map((t) => (
              <li key={t.id}>
                <Card className="hover:border-[hsl(var(--primary))] transition-colors">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link to={`/server-templates/${t.id}`}>
                        <CardTitle className="text-lg hover:underline">{t.name}</CardTitle>
                      </Link>
                      {t.description && (
                        <CardDescription className="mt-1">{t.description}</CardDescription>
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
                            {t.discordTemplateUrl}
                          </a>
                        </p>
                      )}
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                        {formatDate(t.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Link
                        to={`/server-templates/${t.id}`}
                        className="text-sm text-[hsl(var(--primary))] hover:underline"
                      >
                        Открыть редактор
                      </Link>
                    </div>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый шаблон</DialogTitle>
            <DialogDescription>Название обязательно. Описание можно добавить позже в редакторе.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="st-name">Название *</Label>
              <Input
                id="st-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Например: Lineage 2 Community"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="st-desc">Описание</Label>
              <Input
                id="st-desc"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Краткое описание шаблона"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="st-discord-url">Ссылка Discord‑шаблона</Label>
              <Input
                id="st-discord-url"
                value={createDiscordUrl}
                onChange={(e) => setCreateDiscordUrl(e.target.value)}
                placeholder="https://discord.new/..."
              />
            </div>
            {createError && (
              <p className="text-sm text-[hsl(var(--destructive))]">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button onClick={handleCreate} disabled={creating || !createName.trim()}>
              {creating ? "Создание…" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
