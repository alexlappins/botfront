import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AdminHeader } from "@/components/admin-header"
import {
  emptyEmbedForm,
  parseEmbedJsonToForm,
  serializeFormToEmbedJson,
  type EmbedFormState,
  TemplateEmbedBuilder,
} from "@/components/template-embed-builder"
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
import { cn } from "@/lib/utils"
import {
  ApiError,
  getServerTemplate,
  updateServerTemplate,
  getGuilds,
  getChannels,
  getGuildRoles,
  createTemplateMessage,
  updateTemplateMessage,
  deleteTemplateMessage,
  previewTemplateMessage,
  createTemplateReactionRole,
  deleteTemplateReactionRole,
  createTemplateLogChannel,
  deleteTemplateLogChannel,
  type ServerTemplateDetail,
  type TemplateChannel,
  type TemplateMessage,
  type TemplateRole,
  type TemplateReactionRole,
  type TemplateLogChannel,
  type TemplateLogType,
  type Guild,
  type Channel,
  type GuildRole,
  LOG_TYPES,
} from "@/lib/api"
import { MessageSquare, Smile, ScrollText, Pencil, Trash2, Plus } from "lucide-react"

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
      ? "Имена из выбранного сервера (кэш бота). Можно ввести другое имя вручную — как в Discord после установки шаблона."
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
      ? "Имена ролей с выбранного сервера. Можно ввести вручную — как на сервере после установки Discord-шаблона."
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
      <AdminHeader title={template.name} />

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {template.description ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{template.description}</p>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditMetaOpen(true)} className="shrink-0">
            <Pencil className="h-4 w-4 mr-1" />
            Изменить
          </Button>
        </div>
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

        <SectionMessages
          templateId={id}
          messages={template.messages}
          liveChannels={liveChannels}
          guilds={guilds}
          previewDefaultGuildId={sourceGuildId}
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
          channels={[]}
          roles={[]}
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
          channels={[]}
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

const msgTextareaClass =
  "flex min-h-[120px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm ring-offset-[hsl(var(--background))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"

function templateMessagePreviewLine(m: TemplateMessage): string {
  const ch = m.channelName
  if (m.embedJson?.trim()) {
    try {
      const p = JSON.parse(m.embedJson) as { embeds?: { title?: string }[] } & { title?: string }
      const e = p.embeds?.[0] ?? p
      const t = e && typeof e === "object" && "title" in e ? (e as { title?: string }).title : undefined
      if (typeof t === "string" && t.trim()) return `${ch} · ${t.trim()}`
      return `${ch} · эмбед`
    } catch {
      return `${ch} · эмбед`
    }
  }
  const c = m.content?.trim()
  if (c) return `${ch} · ${c.length > 48 ? `${c.slice(0, 48)}…` : c}`
  return ch
}

function SectionMessages({
  templateId,
  messages,
  liveChannels,
  guilds,
  previewDefaultGuildId,
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
  liveChannels: Channel[]
  guilds: Guild[]
  /** Сервер из блока «Подсказки» — подставляется в превью по умолчанию */
  previewDefaultGuildId: string
  onUpdate: () => void
  addOpen: boolean
  setAddOpen: (v: boolean) => void
  formError: string | null
  setFormError: (v: string | null) => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [channelName, setChannelName] = useState("")
  const [content, setContent] = useState("")
  const [messageOrder, setMessageOrder] = useState("")
  const [embedForm, setEmbedForm] = useState<EmbedFormState>(() => emptyEmbedForm())
  const [msgUiTab, setMsgUiTab] = useState<"message" | "embed">("message")
  const [previewGuildId, setPreviewGuildId] = useState("")
  const [previewChannelId, setPreviewChannelId] = useState("")
  const [previewChannelsList, setPreviewChannelsList] = useState<Channel[]>([])
  const [loadingPreviewChannels, setLoadingPreviewChannels] = useState(false)
  const [previewPanelError, setPreviewPanelError] = useState<string | null>(null)
  const [previewSending, setPreviewSending] = useState(false)

  function resetFormForCreate() {
    setEditingId(null)
    setChannelName("")
    setContent("")
    setMessageOrder("")
    setEmbedForm(emptyEmbedForm())
    setMsgUiTab("message")
    setPreviewGuildId("")
    setPreviewChannelId("")
    setPreviewChannelsList([])
    setLoadingPreviewChannels(false)
    setPreviewPanelError(null)
    setPreviewSending(false)
  }

  function openCreate() {
    resetFormForCreate()
    setFormError(null)
    if (previewDefaultGuildId) setPreviewGuildId(previewDefaultGuildId)
    setAddOpen(true)
  }

  function openEdit(m: TemplateMessage) {
    setEditingId(m.id)
    setChannelName(m.channelName)
    setContent(m.content ?? "")
    setMessageOrder(m.messageOrder != null ? String(m.messageOrder) : "")
    setEmbedForm(parseEmbedJsonToForm(m.embedJson))
    setMsgUiTab(m.embedJson?.trim() ? "embed" : "message")
    setFormError(null)
    setPreviewGuildId(previewDefaultGuildId || "")
    setPreviewChannelId("")
    setPreviewChannelsList([])
    setPreviewPanelError(null)
    setAddOpen(true)
  }

  useEffect(() => {
    if (!addOpen || !previewGuildId.trim()) {
      setPreviewChannelsList([])
      return
    }
    let cancelled = false
    setLoadingPreviewChannels(true)
    setPreviewPanelError(null)
    getChannels(previewGuildId.trim())
      .then((ch) => {
        if (cancelled) return
        setPreviewChannelsList(ch.filter((c) => c.type === 0 || c.type === 5))
      })
      .catch((e) => {
        if (!cancelled) {
          setPreviewChannelsList([])
          setPreviewPanelError(e instanceof Error ? e.message : "Не удалось загрузить каналы")
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPreviewChannels(false)
      })
    return () => {
      cancelled = true
    }
  }, [addOpen, previewGuildId])

  async function handlePreviewInDiscord() {
    const embedJsonStr = serializeFormToEmbedJson(embedForm)
    const hasContent = Boolean(content.trim())
    const hasEmbed = embedJsonStr != null
    if (!hasContent && !hasEmbed) {
      setPreviewPanelError("Нужен текст сообщения или заполненный эмбед")
      return
    }
    if (!previewGuildId.trim() || !previewChannelId.trim()) {
      setPreviewPanelError("Выберите сервер и канал")
      return
    }
    setPreviewPanelError(null)
    setPreviewSending(true)
    try {
      await previewTemplateMessage(previewGuildId.trim(), {
        channelId: previewChannelId.trim(),
        content: hasContent ? content.trim() : undefined,
        embedJson: hasEmbed ? embedJsonStr : undefined,
      })
    } catch (e) {
      setPreviewPanelError(e instanceof ApiError ? e.message : "Не удалось отправить превью")
    } finally {
      setPreviewSending(false)
    }
  }

  function handleDialogOpenChange(open: boolean) {
    setAddOpen(open)
    if (!open) {
      resetFormForCreate()
      setFormError(null)
    }
  }

  async function handleSubmit() {
    const ch = channelName.trim()
    if (!ch) return
    const embedJsonStr = serializeFormToEmbedJson(embedForm)
    const hasContent = Boolean(content.trim())
    const hasEmbed = embedJsonStr != null
    if (!hasContent && !hasEmbed) {
      setFormError("Укажите текст сообщения (content) или заполните эмбед")
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      const orderRaw = messageOrder.trim()
      let order: number | undefined
      if (orderRaw !== "") {
        const n = Number(orderRaw)
        if (Number.isFinite(n)) order = Math.floor(n)
      }

      const embedJsonOut = hasEmbed ? embedJsonStr : editingId ? "" : undefined

      if (editingId) {
        await updateTemplateMessage(templateId, editingId, {
          channelName: ch,
          messageOrder: order,
          content: hasContent ? content.trim() : undefined,
          embedJson: embedJsonOut,
        })
      } else {
        await createTemplateMessage(templateId, {
          channelName: ch,
          messageOrder: order,
          content: hasContent ? content.trim() : undefined,
          embedJson: embedJsonOut,
        })
      }
      handleDialogOpenChange(false)
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
            Канал и порядок — всегда в диалоге; текст сообщения и эмбед разнесены по вкладкам (как в ProBot). Подсказки имён каналов — из «Сервер для подсказок».
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
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
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[hsl(var(--border))] px-3 py-2 text-sm"
              >
                <span className="min-w-0 break-words">{templateMessagePreviewLine(m)}</span>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-[hsl(var(--destructive))]" onClick={() => handleDelete(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={addOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать сообщение" : "Добавить сообщение"}</DialogTitle>
            <DialogDescription>
              Вкладки «Сообщение» и «Эмбед». Эмбед в API — <code className="text-xs">{"{ \"embeds\": [ … ] }"}</code>. Отправитель — бот, блок author в JSON не задаётся.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor={`msg-ch-${templateId}`}>Канал (имя) *</Label>
                <ChannelNameField
                  id={`msg-ch-${templateId}`}
                  value={channelName}
                  onChange={setChannelName}
                  channels={[]}
                  liveChannels={liveChannels}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`msg-order-${templateId}`}>Порядок (messageOrder)</Label>
                <Input
                  id={`msg-order-${templateId}`}
                  type="number"
                  value={messageOrder}
                  onChange={(e) => setMessageOrder(e.target.value)}
                  placeholder="Напр. 0, 1, 2…"
                />
              </div>
            </div>

            <div className="flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-1 gap-1">
              <button
                type="button"
                onClick={() => setMsgUiTab("message")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  msgUiTab === "message"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                )}
              >
                Сообщение
              </button>
              <button
                type="button"
                onClick={() => setMsgUiTab("embed")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  msgUiTab === "embed"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                )}
              >
                Эмбед
              </button>
            </div>

            {msgUiTab === "message" ? (
              <div className="grid gap-2">
                <Label htmlFor={`msg-content-${templateId}`}>Содержимое сообщения</Label>
                <textarea
                  id={`msg-content-${templateId}`}
                  className={msgTextareaClass}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Обычный текст Discord — показывается над карточкой эмбеда, если эмбед задан на вкладке «Эмбед»."
                  rows={6}
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Можно оставить только текст без эмбеда, или только эмбед без текста — или оба сразу.
                </p>
              </div>
            ) : (
              <TemplateEmbedBuilder form={embedForm} onChange={setEmbedForm} />
            )}

            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Превью в Discord</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Отправляет текущий черновик в канал (без сохранения шаблона). Нужны права бота на запись в канал.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor={`preview-guild-${templateId}`}>Сервер</Label>
                  <Select
                    value={previewGuildId || "__none__"}
                    onValueChange={(v) => {
                      const id = v === "__none__" ? "" : v
                      setPreviewGuildId(id)
                      setPreviewChannelId("")
                    }}
                  >
                    <SelectTrigger id={`preview-guild-${templateId}`}>
                      <SelectValue placeholder="Выберите сервер" />
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
                <div className="grid gap-2">
                  <Label htmlFor={`preview-ch-${templateId}`}>Канал</Label>
                  <Select
                    value={previewChannelId || "__none__"}
                    onValueChange={(v) => setPreviewChannelId(v === "__none__" ? "" : v)}
                    disabled={!previewGuildId.trim() || loadingPreviewChannels}
                  >
                    <SelectTrigger id={`preview-ch-${templateId}`}>
                      <SelectValue placeholder={loadingPreviewChannels ? "Загрузка…" : "Канал"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Не выбрано</SelectItem>
                      {previewChannelsList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          #{c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {loadingPreviewChannels && previewGuildId ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Загрузка списка каналов…</p>
              ) : null}
              {previewPanelError ? (
                <p className="text-sm text-[hsl(var(--destructive))]">{previewPanelError}</p>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handlePreviewInDiscord()}
                disabled={previewSending || !previewGuildId.trim() || !previewChannelId.trim()}
              >
                {previewSending ? "Отправка…" : "Отправить тест в канал"}
              </Button>
            </div>

            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !channelName.trim()}>
              {submitting ? "Сохранение…" : editingId ? "Сохранить" : "Добавить"}
            </Button>
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
