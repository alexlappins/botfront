import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import {
  getServerTemplate,
  updateServerTemplate,
  getGuilds,
  getChannels,
  getGuildRoles,
  createTemplateRole,
  deleteTemplateRole,
  createTemplateCategory,
  deleteTemplateCategory,
  createTemplateChannel,
  deleteTemplateChannel,
  createTemplateMessage,
  deleteTemplateMessage,
  createTemplateReactionRole,
  deleteTemplateReactionRole,
  createTemplateLogChannel,
  deleteTemplateLogChannel,
  type ServerTemplateDetail,
  type TemplateRole,
  type TemplateCategory,
  type TemplateChannel,
  type TemplateMessage,
  type TemplateReactionRole,
  type TemplateLogChannel,
  type TemplateLogType,
  type Guild,
  type Channel,
  type GuildRole,
  LOG_TYPES,
} from "@/lib/api"
import {
  FileStack,
  Shield,
  Folder,
  Hash,
  MessageSquare,
  Smile,
  ScrollText,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react"

const LOG_TYPE_LABELS: Record<TemplateLogType, string> = {
  joinLeave: "Вход/выход",
  messages: "Сообщения",
  moderation: "Модерация",
  channel: "Канал",
  banKick: "Бан/кик",
}

/** Подсказка, если живой сервер не выбран */
const CHANNEL_NAME_HINT_MANUAL =
  "Имя канала без #. Можно выбрать сервер выше — подставятся каналы из Discord (кэш бота). Или введите вручную."

function ChannelNameField({
  id,
  value,
  onChange,
  channels,
  liveChannels = [],
  placeholder = "например general",
}: {
  id: string
  value: string
  onChange: (v: string) => void
  channels: TemplateChannel[]
  /** Каналы с живого сервера: GET /api/guilds/:guildId/channels */
  liveChannels?: Channel[]
  placeholder?: string
}) {
  const listId = `${id}-channel-datalist`
  const seen = new Set<string>()
  const options: { key: string; name: string }[] = []
  for (const c of channels) {
    if (!seen.has(c.name)) {
      seen.add(c.name)
      options.push({ key: `t-${c.id}`, name: c.name })
    }
  }
  for (const c of liveChannels) {
    if (!seen.has(c.name)) {
      seen.add(c.name)
      options.push({ key: `g-${c.id}`, name: c.name })
    }
  }
  const hint =
    liveChannels.length > 0
      ? "Имена из выбранного сервера (кэш бота) и из блока «Каналы» шаблона. Можно ввести другое имя вручную."
      : CHANNEL_NAME_HINT_MANUAL
  return (
    <div className="grid gap-2">
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.key} value={o.name} />
        ))}
      </datalist>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>
    </div>
  )
}

function RoleNameField({
  id,
  value,
  onChange,
  roles,
  liveRoles = [],
  placeholder = "например Member",
}: {
  id: string
  value: string
  onChange: (v: string) => void
  roles: TemplateRole[]
  /** Роли с живого сервера: GET /api/guilds/:guildId/roles */
  liveRoles?: GuildRole[]
  placeholder?: string
}) {
  const listId = `${id}-role-datalist`
  const seen = new Set<string>()
  const options: { key: string; name: string }[] = []
  for (const r of roles) {
    if (!seen.has(r.name)) {
      seen.add(r.name)
      options.push({ key: `t-${r.id}`, name: r.name })
    }
  }
  for (const r of liveRoles) {
    if (!seen.has(r.name)) {
      seen.add(r.name)
      options.push({ key: `g-${r.id}`, name: r.name })
    }
  }
  const hint =
    liveRoles.length > 0
      ? "Имена из выбранного сервера и из блока «Роли» шаблона. Можно ввести вручную."
      : "Имя роли как на сервере. Выберите сервер выше для подсказок из Discord или введите вручную."
  return (
    <div className="grid gap-2">
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.key} value={o.name} />
        ))}
      </datalist>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>
    </div>
  )
}

export function ServerTemplateEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  const [template, setTemplate] = useState<ServerTemplateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editMetaOpen, setEditMetaOpen] = useState(false)
  const [metaName, setMetaName] = useState("")
  const [metaDescription, setMetaDescription] = useState("")
  const [metaDiscordUrl, setMetaDiscordUrl] = useState("")
  const [savingMeta, setSavingMeta] = useState(false)
  const [addRoleOpen, setAddRoleOpen] = useState(false)
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [addChannelOpen, setAddChannelOpen] = useState(false)
  const [addMessageOpen, setAddMessageOpen] = useState(false)
  const [addRROpen, setAddRROpen] = useState(false)
  const [addLogChannelOpen, setAddLogChannelOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /** Подсказки каналов/ролей с живого сервера (GET /api/guilds/:id/channels, /roles) */
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [sourceGuildId, setSourceGuildId] = useState("")
  const [liveChannels, setLiveChannels] = useState<Channel[]>([])
  const [liveRoles, setLiveRoles] = useState<GuildRole[]>([])
  const [loadingLive, setLoadingLive] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getServerTemplate(id)
      setTemplate(data)
      setMetaName(data.name)
      setMetaDescription(data.description ?? "")
      setMetaDiscordUrl(data.discordTemplateUrl ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    getGuilds()
      .then(setGuilds)
      .catch(() => {
        /* список гильдий опционален */
      })
  }, [])

  useEffect(() => {
    if (!sourceGuildId) {
      setLiveChannels([])
      setLiveRoles([])
      setLiveError(null)
      return
    }
    setLoadingLive(true)
    setLiveError(null)
    Promise.all([getChannels(sourceGuildId), getGuildRoles(sourceGuildId)])
      .then(([ch, r]) => {
        setLiveChannels(ch)
        setLiveRoles(r)
      })
      .catch((e) => {
        setLiveError(e instanceof Error ? e.message : "Не удалось загрузить каналы и роли сервера")
        setLiveChannels([])
        setLiveRoles([])
      })
      .finally(() => setLoadingLive(false))
  }, [sourceGuildId])

  useEffect(() => {
    if (template) {
      setMetaName(template.name)
      setMetaDescription(template.description ?? "")
      setMetaDiscordUrl(template.discordTemplateUrl ?? "")
    }
  }, [template])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Загрузка…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Link to="/login">Войти</Link>
      </div>
    )
  }

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[hsl(var(--muted-foreground))]">Шаблон не выбран</p>
      </div>
    )
  }

  if (loading && !template) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Загрузка шаблона…</div>
      </div>
    )
  }

  if (error && !template) {
    return (
      <div className="min-h-screen p-4">
        <Link to="/server-templates" className="text-[hsl(var(--primary))] hover:underline">
          ← К списку шаблонов
        </Link>
        <div className="mt-4 p-4 rounded-lg bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]">
          {error}
        </div>
      </div>
    )
  }

  if (!template) return null

  async function handleSaveMeta() {
    setFormError(null)
    setSavingMeta(true)
    try {
      const updated = await updateServerTemplate(id!, {
        name: metaName.trim(),
        description: metaDescription.trim() || null,
        discordTemplateUrl: metaDiscordUrl.trim() || null,
      })
      setTemplate((prev) => (prev ? { ...prev, ...updated } : null))
      setEditMetaOpen(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Ошибка сохранения")
    } finally {
      setSavingMeta(false)
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <Link
              to="/server-templates"
              className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              ← Шаблоны
            </Link>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <FileStack className="h-5 w-5" />
                {template.name}
              </h1>
              {template.description && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{template.description}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditMetaOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              Изменить
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        {/* Блок Discord‑шаблона (основной сценарий развёртывания) */}
        <Card>
          <CardHeader>
            <CardTitle>Discord‑шаблон сервера</CardTitle>
            <CardDescription>
              Укажи ссылку на нативный Discord‑шаблон. Через него создаётся структура ролей и каналов,
              а бот сверху накидывает сообщения, автороли и логи.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="meta-discord-url">Ссылка Discord‑шаблона</Label>
              <Input
                id="meta-discord-url"
                value={metaDiscordUrl}
                onChange={(e) => setMetaDiscordUrl(e.target.value)}
                placeholder="https://discord.new/..."
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={handleSaveMeta} disabled={savingMeta}>
                {savingMeta ? "Сохранение…" : "Сохранить"}
              </Button>
              {template.discordTemplateUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                >
                  <a href={template.discordTemplateUrl} target="_blank" rel="noreferrer">
                    Открыть в Discord
                  </a>
                </Button>
              )}
            </div>
            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Подсказки с живого сервера</CardTitle>
            <CardDescription>
              После того как сервер уже создан по Discord-шаблону, выберите его здесь — в формах ниже в подсказках появятся реальные имена каналов и ролей из кэша бота (
              <code className="text-xs">GET /api/guilds/…/channels</code>,{" "}
              <code className="text-xs">GET /api/guilds/…/roles</code>
              ). Это не меняет записи шаблона в БД — только помогает ввести те же имена, что при установке.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-w-lg">
            <div className="grid gap-2">
              <Label htmlFor="source-guild">Сервер для подсказок</Label>
              <Select
                value={sourceGuildId || "__none__"}
                onValueChange={(v) => setSourceGuildId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="source-guild">
                  <SelectValue placeholder="Не выбрано" />
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
            </div>
            {loadingLive && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Загрузка каналов и ролей…</p>
            )}
            {liveError && (
              <p className="text-sm text-[hsl(var(--destructive))]">{liveError}</p>
            )}
            {sourceGuildId && !loadingLive && !liveError && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Загружено: {liveChannels.length} каналов, {liveRoles.length} ролей (без @everyone и managed).
              </p>
            )}
          </CardContent>
        </Card>

        {/* Расширенный режим: наши сущности поверх Discord‑шаблона */}
        <SectionRoles
          templateId={id}
          roles={template.roles}
          onUpdate={load}
          addOpen={addRoleOpen}
          setAddOpen={setAddRoleOpen}
          formError={formError}
          setFormError={setFormError}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
        <SectionCategories
          templateId={id}
          categories={template.categories}
          onUpdate={load}
          addOpen={addCategoryOpen}
          setAddOpen={setAddCategoryOpen}
          formError={formError}
          setFormError={setFormError}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
        <SectionChannels
          templateId={id}
          channels={template.channels}
          categories={template.categories}
          onUpdate={load}
          addOpen={addChannelOpen}
          setAddOpen={setAddChannelOpen}
          formError={formError}
          setFormError={setFormError}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
        <SectionMessages
          templateId={id}
          messages={template.messages}
          channels={template.channels}
          liveChannels={liveChannels}
          onUpdate={load}
          addOpen={addMessageOpen}
          setAddOpen={setAddMessageOpen}
          formError={formError}
          setFormError={setFormError}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
        <SectionReactionRoles
          templateId={id}
          reactionRoles={template.reactionRoles}
          channels={template.channels}
          roles={template.roles}
          liveChannels={liveChannels}
          liveRoles={liveRoles}
          onUpdate={load}
          addOpen={addRROpen}
          setAddOpen={setAddRROpen}
          formError={formError}
          setFormError={setFormError}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
        <SectionLogChannels
          templateId={id}
          logChannels={template.logChannels}
          channels={template.channels}
          liveChannels={liveChannels}
          onUpdate={load}
          addOpen={addLogChannelOpen}
          setAddOpen={setAddLogChannelOpen}
          formError={formError}
          setFormError={setFormError}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      </main>

      <Dialog open={editMetaOpen} onOpenChange={setEditMetaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Название и описание</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название</Label>
              <Input value={metaName} onChange={(e) => setMetaName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Описание</Label>
              <Input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meta-discord-url-modal">Ссылка Discord‑шаблона</Label>
              <Input
                id="meta-discord-url-modal"
                value={metaDiscordUrl}
                onChange={(e) => setMetaDiscordUrl(e.target.value)}
                placeholder="https://discord.new/..."
              />
            </div>
            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMetaOpen(false)}>Отмена</Button>
            <Button onClick={handleSaveMeta} disabled={savingMeta}>
              {savingMeta ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionRoles({
  templateId,
  roles,
  onUpdate,
  addOpen,
  setAddOpen,
  formError,
  setFormError,
  submitting,
  setSubmitting,
}: {
  templateId: string
  roles: TemplateRole[]
  onUpdate: () => void
  addOpen: boolean
  setAddOpen: (v: boolean) => void
  formError: string | null
  setFormError: (v: string | null) => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [name, setName] = useState("")

  async function handleAdd() {
    const n = name.trim()
    if (!n) return
    setFormError(null)
    setSubmitting(true)
    try {
      await createTemplateRole(templateId, { name: n })
      setName("")
      setAddOpen(false)
      onUpdate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(roleId: string) {
    if (!confirm("Удалить роль из шаблона?")) return
    try {
      await deleteTemplateRole(templateId, roleId)
      onUpdate()
    } catch {}
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Роли
          </CardTitle>
          <CardDescription>Роли, создаваемые при установке шаблона</CardDescription>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </CardHeader>
      <CardContent>
        {roles.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Нет ролей</p>
        ) : (
          <ul className="space-y-2">
            {roles.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border border-[hsl(var(--border))] px-3 py-2 text-sm">
                <span>{r.name}</span>
                <Button size="sm" variant="ghost" className="text-[hsl(var(--destructive))]" onClick={() => handleDelete(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить роль</DialogTitle>
            <DialogDescription>Минимально — только название. Остальное можно задать в API или расширить форму.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название роли" />
            </div>
            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd} disabled={submitting || !name.trim()}>{submitting ? "Добавление…" : "Добавить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SectionCategories({
  templateId,
  categories,
  onUpdate,
  addOpen,
  setAddOpen,
  formError,
  setFormError,
  submitting,
  setSubmitting,
}: {
  templateId: string
  categories: TemplateCategory[]
  onUpdate: () => void
  addOpen: boolean
  setAddOpen: (v: boolean) => void
  formError: string | null
  setFormError: (v: string | null) => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [name, setName] = useState("")

  async function handleAdd() {
    const n = name.trim()
    if (!n) return
    setFormError(null)
    setSubmitting(true)
    try {
      await createTemplateCategory(templateId, { name: n })
      setName("")
      setAddOpen(false)
      onUpdate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(categoryId: string) {
    if (!confirm("Удалить категорию?")) return
    try {
      await deleteTemplateCategory(templateId, categoryId)
      onUpdate()
    } catch {}
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Категории
          </CardTitle>
          <CardDescription>Категории каналов</CardDescription>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Нет категорий</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded border border-[hsl(var(--border))] px-3 py-2 text-sm">
                <span>{c.name}</span>
                <Button size="sm" variant="ghost" className="text-[hsl(var(--destructive))]" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить категорию</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название категории" />
            </div>
            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd} disabled={submitting || !name.trim()}>{submitting ? "Добавление…" : "Добавить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SectionChannels({
  templateId,
  channels,
  categories,
  onUpdate,
  addOpen,
  setAddOpen,
  formError,
  setFormError,
  submitting,
  setSubmitting,
}: {
  templateId: string
  channels: TemplateChannel[]
  categories: TemplateCategory[]
  onUpdate: () => void
  addOpen: boolean
  setAddOpen: (v: boolean) => void
  formError: string | null
  setFormError: (v: string | null) => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [name, setName] = useState("")
  const [categoryName, setCategoryName] = useState("")
  const [type, setType] = useState<number>(0)

  async function handleAdd() {
    const n = name.trim()
    if (!n) return
    setFormError(null)
    setSubmitting(true)
    try {
      await createTemplateChannel(templateId, {
        name: n,
        categoryName: categoryName.trim() || undefined,
        type: type ?? 0,
      })
      setName("")
      setCategoryName("")
      setType(0)
      setAddOpen(false)
      onUpdate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(channelId: string) {
    if (!confirm("Удалить канал из шаблона?")) return
    try {
      await deleteTemplateChannel(templateId, channelId)
      onUpdate()
    } catch {}
  }

  const typeLabel = (t: number) => (t === 0 ? "Текст" : t === 2 ? "Голос" : t === 5 ? "Анонсы" : String(t))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Каналы
          </CardTitle>
          <CardDescription>Текстовые (0), голосовые (2), анонсы (5)</CardDescription>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </CardHeader>
      <CardContent>
        {channels.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Нет каналов</p>
        ) : (
          <ul className="space-y-2">
            {channels.map((ch) => (
              <li key={ch.id} className="flex items-center justify-between rounded border border-[hsl(var(--border))] px-3 py-2 text-sm">
                <span># {ch.name} {ch.categoryName && <span className="text-[hsl(var(--muted-foreground))]">({ch.categoryName})</span>} — {typeLabel(ch.type ?? 0)}</span>
                <Button size="sm" variant="ghost" className="text-[hsl(var(--destructive))]" onClick={() => handleDelete(ch.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить канал</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="general" />
            </div>
            <div className="grid gap-2">
              <Label>Категория (имя)</Label>
              <Select
                value={categoryName || "__none__"}
                onValueChange={(v) => setCategoryName(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Без категории" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Без категории</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Тип</Label>
              <Select value={String(type)} onValueChange={(v) => setType(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Текст (0)</SelectItem>
                  <SelectItem value="2">Голос (2)</SelectItem>
                  <SelectItem value="5">Анонсы (5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd} disabled={submitting || !name.trim()}>{submitting ? "Добавление…" : "Добавить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SectionMessages({
  templateId,
  messages,
  channels,
  liveChannels,
  onUpdate,
  addOpen,
  setAddOpen,
  formError,
  setFormError,
  submitting,
  setSubmitting,
}: {
  templateId: string
  messages: TemplateMessage[]
  channels: TemplateChannel[]
  liveChannels: Channel[]
  onUpdate: () => void
  addOpen: boolean
  setAddOpen: (v: boolean) => void
  formError: string | null
  setFormError: (v: string | null) => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [channelName, setChannelName] = useState("")
  const [content, setContent] = useState("")

  async function handleAdd() {
    const ch = channelName.trim()
    if (!ch) return
    setFormError(null)
    setSubmitting(true)
    try {
      await createTemplateMessage(templateId, {
        channelName: ch,
        content: content.trim() || undefined,
      })
      setChannelName("")
      setContent("")
      setAddOpen(false)
      onUpdate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(messageId: string) {
    if (!confirm("Удалить сообщение из шаблона?")) return
    try {
      await deleteTemplateMessage(templateId, messageId)
      onUpdate()
    } catch {}
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Сообщения
          </CardTitle>
          <CardDescription>
            Сообщения по имени канала. В кнопках: rr/{"{{"}RoleName{"}}"}. Выберите сервер в блоке «Подсказки с живого сервера» — подставятся имена каналов из Discord.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Нет сообщений</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded border border-[hsl(var(--border))] px-3 py-2 text-sm">
                <span>{m.channelName} {m.content && <span className="text-[hsl(var(--muted-foreground))] truncate">— {m.content.slice(0, 40)}…</span>}</span>
                <Button size="sm" variant="ghost" className="text-[hsl(var(--destructive))]" onClick={() => handleDelete(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить сообщение</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={`msg-ch-${templateId}`}>Канал (имя) *</Label>
              <ChannelNameField
                id={`msg-ch-${templateId}`}
                value={channelName}
                onChange={setChannelName}
                channels={channels}
                liveChannels={liveChannels}
              />
            </div>
            <div className="grid gap-2">
              <Label>Текст (content)</Label>
              <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Текст сообщения" />
            </div>
            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd} disabled={submitting || !channelName.trim()}>{submitting ? "Добавление…" : "Добавить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SectionReactionRoles({
  templateId,
  reactionRoles,
  channels,
  roles,
  liveChannels,
  liveRoles,
  onUpdate,
  addOpen,
  setAddOpen,
  formError,
  setFormError,
  submitting,
  setSubmitting,
}: {
  templateId: string
  reactionRoles: TemplateReactionRole[]
  channels: TemplateChannel[]
  roles: TemplateRole[]
  liveChannels: Channel[]
  liveRoles: GuildRole[]
  onUpdate: () => void
  addOpen: boolean
  setAddOpen: (v: boolean) => void
  formError: string | null
  setFormError: (v: string | null) => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [channelName, setChannelName] = useState("")
  const [emojiKey, setEmojiKey] = useState("")
  const [roleName, setRoleName] = useState("")

  async function handleAdd() {
    const ch = channelName.trim()
    const em = emojiKey.trim()
    const r = roleName.trim()
    if (!ch || !em || !r) return
    setFormError(null)
    setSubmitting(true)
    try {
      await createTemplateReactionRole(templateId, { channelName: ch, emojiKey: em, roleName: r })
      setChannelName("")
      setEmojiKey("")
      setRoleName("")
      setAddOpen(false)
      onUpdate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(rrId: string) {
    if (!confirm("Удалить привязку?")) return
    try {
      await deleteTemplateReactionRole(templateId, rrId)
      onUpdate()
    } catch {}
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Smile className="h-5 w-5" />
            Автороли
          </CardTitle>
          <CardDescription>
            Реакция → роль. Имена канала и роли можно взять из блока «Подсказки с живого сервера» или ввести вручную.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </CardHeader>
      <CardContent>
        {reactionRoles.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Нет привязок</p>
        ) : (
          <ul className="space-y-2">
            {reactionRoles.map((rr) => (
              <li key={rr.id} className="flex items-center justify-between rounded border border-[hsl(var(--border))] px-3 py-2 text-sm">
                <span>{rr.channelName} · {rr.emojiKey} → {rr.roleName}</span>
                <Button size="sm" variant="ghost" className="text-[hsl(var(--destructive))]" onClick={() => handleDelete(rr.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить автороль</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={`rr-ch-${templateId}`}>Канал (имя) *</Label>
              <ChannelNameField
                id={`rr-ch-${templateId}`}
                value={channelName}
                onChange={setChannelName}
                channels={channels}
                liveChannels={liveChannels}
              />
            </div>
            <div className="grid gap-2">
              <Label>Эмодзи (emojiKey) *</Label>
              <Input value={emojiKey} onChange={(e) => setEmojiKey(e.target.value)} placeholder="✅ или name:id" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`rr-role-${templateId}`}>Роль (имя) *</Label>
              <RoleNameField
                id={`rr-role-${templateId}`}
                value={roleName}
                onChange={setRoleName}
                roles={roles}
                liveRoles={liveRoles}
              />
            </div>
            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd} disabled={submitting || !channelName.trim() || !emojiKey.trim() || !roleName.trim()}>{submitting ? "Добавление…" : "Добавить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SectionLogChannels({
  templateId,
  logChannels,
  channels,
  liveChannels,
  onUpdate,
  addOpen,
  setAddOpen,
  formError,
  setFormError,
  submitting,
  setSubmitting,
}: {
  templateId: string
  logChannels: TemplateLogChannel[]
  channels: TemplateChannel[]
  liveChannels: Channel[]
  onUpdate: () => void
  addOpen: boolean
  setAddOpen: (v: boolean) => void
  formError: string | null
  setFormError: (v: string | null) => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [logType, setLogType] = useState<TemplateLogType>("joinLeave")
  const [channelName, setChannelName] = useState("")

  async function handleAdd() {
    const ch = channelName.trim()
    if (!ch) return
    setFormError(null)
    setSubmitting(true)
    try {
      await createTemplateLogChannel(templateId, { logType, channelName: ch })
      setChannelName("")
      setAddOpen(false)
      onUpdate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(lcId: string) {
    if (!confirm("Удалить лог-канал?")) return
    try {
      await deleteTemplateLogChannel(templateId, lcId)
      onUpdate()
    } catch {}
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Лог-каналы
          </CardTitle>
          <CardDescription>
            Тип лога и имя канала. Имя можно взять из «Подсказки с живого сервера» или ввести вручную.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </CardHeader>
      <CardContent>
        {logChannels.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Нет лог-каналов</p>
        ) : (
          <ul className="space-y-2">
            {logChannels.map((lc) => (
              <li key={lc.id} className="flex items-center justify-between rounded border border-[hsl(var(--border))] px-3 py-2 text-sm">
                <span>{LOG_TYPE_LABELS[lc.logType as TemplateLogType] ?? lc.logType} → {lc.channelName}</span>
                <Button size="sm" variant="ghost" className="text-[hsl(var(--destructive))]" onClick={() => handleDelete(lc.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить лог-канал</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Тип лога *</Label>
              <Select value={logType} onValueChange={(v) => setLogType(v as TemplateLogType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOG_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{LOG_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`log-ch-${templateId}`}>Канал (имя) *</Label>
              <ChannelNameField
                id={`log-ch-${templateId}`}
                value={channelName}
                onChange={setChannelName}
                channels={channels}
                liveChannels={liveChannels}
              />
            </div>
            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd} disabled={submitting || !channelName.trim()}>{submitting ? "Добавление…" : "Добавить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
