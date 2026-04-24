import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AdminHeader } from "@/components/admin-header"
import {
  emptyEmbedForm,
  serializeFormToEmbedJson,
  type EmbedFormState,
  TemplateEmbedBuilder,
} from "@/components/template-embed-builder"
import {
  parseSelfRoleComponents,
  serializeSelfRoleComponents,
  type SelfRoleButtonDraft,
  TemplateSelfRoleButtonsEditor,
} from "@/components/template-self-role-buttons"
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
  createTemplateReactionRole,
  updateTemplateMessage,
  previewTemplateMessage,
  deleteTemplateReactionRole,
  createTemplateLogChannel,
  deleteTemplateLogChannel,
  createTemplateEmoji,
  deleteTemplateEmoji,
  createTemplateSticker,
  deleteTemplateSticker,
  createTemplateRole,
  deleteTemplateRole,
  uploadFile,
  type ServerTemplateDetail,
  type TemplateEmoji,
  type TemplateSticker,
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
import { TemplateMessageSelfRoleCard } from "@/components/template-message-self-role-card"
import { MessageSquare, ScrollText, Plus, Pencil, Trash2, Smile, Sticker, Upload } from "lucide-react"

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
  const [metaIconUrl, setMetaIconUrl] = useState<string | null>(null)
  const [metaEnableServerStats, setMetaEnableServerStats] = useState(false)
  const [statsCategoryName, setStatsCategoryName] = useState("")
  const [statsTotalName, setStatsTotalName] = useState("")
  const [statsHumansName, setStatsHumansName] = useState("")
  const [statsBotsName, setStatsBotsName] = useState("")
  const [statsOnlineName, setStatsOnlineName] = useState("")
  const [savingStats, setSavingStats] = useState(false)
  const [statsSavedMsg, setStatsSavedMsg] = useState<string | null>(null)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [addMessageOpen, setAddMessageOpen] = useState(false)
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
      setMetaIconUrl(data.iconUrl ?? null)
      setMetaEnableServerStats(Boolean(data.enableServerStats))
      setStatsCategoryName(data.statsCategoryName ?? "")
      setStatsTotalName(data.statsTotalName ?? "")
      setStatsHumansName(data.statsHumansName ?? "")
      setStatsBotsName(data.statsBotsName ?? "")
      setStatsOnlineName(data.statsOnlineName ?? "")
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
      .then((g) => {
        setGuilds(g)
        if (g.length > 0) setSourceGuildId((prev) => prev || g[0].id)
      })
      .catch(() => { /* список гильдий опционален */ })
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
      setMetaIconUrl(template.iconUrl ?? null)
      setMetaEnableServerStats(Boolean(template.enableServerStats))
      setStatsCategoryName(template.statsCategoryName ?? "")
      setStatsTotalName(template.statsTotalName ?? "")
      setStatsHumansName(template.statsHumansName ?? "")
      setStatsBotsName(template.statsBotsName ?? "")
      setStatsOnlineName(template.statsOnlineName ?? "")
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

  async function handleUploadIcon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFormError(null)
    setUploadingIcon(true)
    try {
      const { url } = await uploadFile(file)
      const updated = await updateServerTemplate(id!, { iconUrl: url })
      setMetaIconUrl(url)
      setTemplate((prev) => (prev ? { ...prev, ...updated } : null))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Ошибка загрузки иконки")
    } finally {
      setUploadingIcon(false)
      e.target.value = ""
    }
  }

  async function handleSaveStatsNames() {
    setStatsSavedMsg(null)
    setSavingStats(true)
    try {
      const updated = await updateServerTemplate(id!, {
        statsCategoryName: statsCategoryName.trim() || null,
        statsTotalName: statsTotalName.trim() || null,
        statsHumansName: statsHumansName.trim() || null,
        statsBotsName: statsBotsName.trim() || null,
        statsOnlineName: statsOnlineName.trim() || null,
      })
      setTemplate((prev) => (prev ? { ...prev, ...updated } : null))
      setStatsSavedMsg("Сохранено")
      setTimeout(() => setStatsSavedMsg(null), 2000)
    } catch (err) {
      setStatsSavedMsg(err instanceof Error ? err.message : "Ошибка сохранения")
    } finally {
      setSavingStats(false)
    }
  }

  async function handleToggleServerStats(next: boolean) {
    setFormError(null)
    setMetaEnableServerStats(next)
    try {
      const updated = await updateServerTemplate(id!, { enableServerStats: next })
      setTemplate((prev) => (prev ? { ...prev, ...updated } : null))
    } catch (err) {
      // откатываем на бэкапное значение
      setMetaEnableServerStats(!next)
      setFormError(err instanceof Error ? err.message : "Ошибка сохранения")
    }
  }

  async function handleRemoveIcon() {
    setFormError(null)
    try {
      const updated = await updateServerTemplate(id!, { iconUrl: null })
      setMetaIconUrl(null)
      setTemplate((prev) => (prev ? { ...prev, ...updated } : null))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Ошибка удаления иконки")
    }
  }

  async function handleSaveMeta() {
    setFormError(null)
    setSavingMeta(true)
    try {
      const updated = await updateServerTemplate(id!, {
        name: metaName.trim(),
        description: metaDescription.trim() || null,
        discordTemplateUrl: metaDiscordUrl.trim() || null,
        iconUrl: metaIconUrl,
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

        {/* Блок иконки сервера — бот установит её при развёртывании */}
        <Card>
          <CardHeader>
            <CardTitle>Иконка сервера</CardTitle>
            <CardDescription>
              Бот автоматически установит эту иконку при развёртывании шаблона на Discord-сервер.
              PNG/JPG/GIF, рекомендуется 512×512 px, до 256 КБ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[hsl(var(--muted))] border flex items-center justify-center shrink-0">
                {metaIconUrl ? (
                  <img src={metaIconUrl} alt="Иконка" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">нет</span>
                )}
              </div>
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <Button size="sm" variant="outline" asChild disabled={uploadingIcon}>
                    <span>{uploadingIcon ? "Загрузка…" : metaIconUrl ? "Заменить" : "Загрузить"}</span>
                  </Button>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={handleUploadIcon}
                    disabled={uploadingIcon}
                  />
                </label>
                {metaIconUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRemoveIcon}
                    className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Статистика сервера (клон ServerStats) */}
        <Card>
          <CardHeader>
            <CardTitle>Статистика сервера</CardTitle>
            <CardDescription>
              При установке шаблона бот создаст в самом верху категорию с 4 голосовыми каналами-счётчиками.
              Числа обновляются раз в 10 минут (лимит Discord на переименование каналов).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={metaEnableServerStats}
                onChange={(e) => handleToggleServerStats(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
              />
              <div className="space-y-0.5">
                <span className="text-sm font-medium">
                  Включить каналы статистики при установке шаблона
                </span>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Пользователь сможет отключить их позже командой <code>/serverstats-disable</code>.
                </p>
              </div>
            </label>

            {metaEnableServerStats && (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <p className="text-sm font-medium mb-1">Названия</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
                    Используйте <code>{"{count}"}</code> для подстановки числа. Пусто = дефолтное значение.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1 md:col-span-2">
                    <Label className="text-xs">Название категории</Label>
                    <Input
                      value={statsCategoryName}
                      onChange={(e) => setStatsCategoryName(e.target.value)}
                      placeholder="📊 Статистика сервера"
                      maxLength={100}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Канал «Всего»</Label>
                    <Input
                      value={statsTotalName}
                      onChange={(e) => setStatsTotalName(e.target.value)}
                      placeholder="👥 Всего: {count}"
                      maxLength={100}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Канал «Люди»</Label>
                    <Input
                      value={statsHumansName}
                      onChange={(e) => setStatsHumansName(e.target.value)}
                      placeholder="👤 Люди: {count}"
                      maxLength={100}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Канал «Боты»</Label>
                    <Input
                      value={statsBotsName}
                      onChange={(e) => setStatsBotsName(e.target.value)}
                      placeholder="🤖 Боты: {count}"
                      maxLength={100}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Канал «В сети»</Label>
                    <Input
                      value={statsOnlineName}
                      onChange={(e) => setStatsOnlineName(e.target.value)}
                      placeholder="🟢 В сети: {count}"
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={handleSaveStatsNames} disabled={savingStats}>
                    {savingStats ? "Сохранение…" : "Сохранить названия"}
                  </Button>
                  {statsSavedMsg && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{statsSavedMsg}</span>
                  )}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Пример: «Adventurers: {"{count}"}» станет «Adventurers: 5» после установки.
                </p>
              </div>
            )}
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

        <SectionRoles
          templateId={id}
          roles={template.roles}
          onUpdate={load}
        />

        <SectionMessages
          templateId={id}
          channels={template.channels}
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
        <SectionAutoRoles
          templateId={id}
          messages={template.messages}
          roles={template.roles}
          reactionRoles={template.reactionRoles}
          liveRoles={liveRoles}
          onUpdate={load}
        />
        <SectionEmojisStickers
          templateId={id}
          emojis={template.emojis ?? []}
          stickers={template.stickers ?? []}
          onUpdate={load}
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

function messageOrderNorm(m: TemplateMessage): number {
  return m.messageOrder ?? 0
}

function orphanReactionRoles(messages: TemplateMessage[], all: TemplateReactionRole[]): TemplateReactionRole[] {
  return all.filter(
    (rr) =>
      !messages.some(
        (m) => rr.channelName === m.channelName && (rr.messageOrder ?? 0) === messageOrderNorm(m)
      )
  )
}

function SectionMessages({
  templateId,
  channels,
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
  channels: TemplateChannel[]
  messages: TemplateMessage[]
  liveChannels: Channel[]
  guilds: Guild[]
  previewDefaultGuildId: string
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
  const [messageOrder, setMessageOrder] = useState("")
  const [embedForm, setEmbedForm] = useState<EmbedFormState>(() => emptyEmbedForm())
  const [msgUiTab, setMsgUiTab] = useState<"message" | "embed">("message")
  const [previewGuildId, setPreviewGuildId] = useState("")
  const [previewChannelId, setPreviewChannelId] = useState("")
  const [previewChannelsList, setPreviewChannelsList] = useState<Channel[]>([])
  const [loadingPreviewChannels, setLoadingPreviewChannels] = useState(false)
  const [previewPanelError, setPreviewPanelError] = useState<string | null>(null)
  const [previewSending, setPreviewSending] = useState(false)

  const sortedMessages = [...messages].sort((a, b) => {
    const ca = a.channelName.localeCompare(b.channelName, "ru")
    if (ca !== 0) return ca
    return messageOrderNorm(a) - messageOrderNorm(b)
  })

  function resetFormForCreate() {
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
    if (!hasContent && !embedJsonStr) {
      setPreviewPanelError("Нужен текст или эмбед. Одного цвета полосы недостаточно — API вернёт 400.")
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
        embedJson: embedJsonStr ?? undefined,
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

  async function handleSubmitCreate() {
    const ch = channelName.trim()
    if (!ch) { setFormError("Выберите канал"); return }
    const embedJsonStr = serializeFormToEmbedJson(embedForm)
    const hasContent = Boolean(content.trim())
    const hasEmbed = embedJsonStr != null
    if (!hasContent && !hasEmbed) {
      setFormError("Укажите текст или эмбед")
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
      await createTemplateMessage(templateId, {
        channelName: ch,
        messageOrder: order,
        content: hasContent ? content.trim() : undefined,
        embedJson: hasEmbed ? embedJsonStr : undefined,
      })
      handleDialogOpenChange(false)
      onUpdate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Шаблоны сообщений
          </CardTitle>
          <CardDescription>
            Сообщения, которые бот отправит в каналы после установки шаблона. Каждая карточка — одно сообщение: канал, порядок, текст/эмбед и кнопки авторолей.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Добавить сообщение
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {sortedMessages.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Нет сообщений. Нажмите «Добавить сообщение» — затем настройте контент, кнопки или реакции в карточке.
          </p>
        ) : (
          <div className="space-y-6">
            {sortedMessages.map((m) => (
              <TemplateMessageSelfRoleCard
                key={m.id}
                templateId={templateId}
                message={m}
                templateChannels={channels}
                liveChannels={liveChannels}
                guilds={guilds}
                previewDefaultGuildId={previewDefaultGuildId}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        )}
      </CardContent>
      <Dialog open={addOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Добавить сообщение</DialogTitle>
            <DialogDescription>
              Текст, эмбед и кнопки авторолей — одно сообщение шаблона. Эмбед: <code className="text-xs">{"{ \"embeds\": [ … ] }"}</code>
              . Кнопки: <code className="text-xs">components</code> Discord (Action Row + кнопки с{" "}
              <code className="text-xs">rr/give/{"{{"}роль{"}}"})</code> и т.д.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label>Канал *</Label>
                {liveChannels.length > 0 ? (
                  <Select
                    value={channelName || "__none__"}
                    onValueChange={(v) => setChannelName(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите канал" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Выберите канал</SelectItem>
                      {liveChannels
                        .filter((c) => c.type === 0 || c.type === 5)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.name}>#{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <ChannelNameField
                    id={`msg-ch-${templateId}`}
                    value={channelName}
                    onChange={setChannelName}
                    channels={channels}
                    liveChannels={[]}
                  />
                )}
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

            <div className="flex flex-wrap rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-1 gap-1">
              <button
                type="button"
                onClick={() => setMsgUiTab("message")}
                className={cn(
                  "flex-1 min-w-[100px] rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
                  "flex-1 min-w-[100px] rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
              </div>
            ) : (
              <TemplateEmbedBuilder form={embedForm} onChange={setEmbedForm} />
            )}

            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Превью в Discord</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Отправляет текущий черновик в канал (без сохранения шаблона). Нужны права бота на запись в канал. В эмбеде должно быть видимое содержимое (не только цвет полосы) — иначе API вернёт 400.
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
            <Button onClick={() => void handleSubmitCreate()} disabled={submitting || !channelName.trim()}>
              {submitting ? "Добавление…" : "Добавить"}
            </Button>
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
    } catch {
      /* ignore */
    }
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

function buildMsgOptions(messages: TemplateMessage[]) {
  return messages.map((m) => {
    const order = m.messageOrder ?? 0
    const key = `${m.channelName}:${order}`
    let title = ""
    if (m.embedJson) {
      try {
        const p = JSON.parse(m.embedJson) as { embeds?: { title?: string }[] }
        const t = p.embeds?.[0]?.title
        if (typeof t === "string" && t.trim()) title = t.trim()
      } catch { /* ignore */ }
    }
    if (!title && m.content?.trim()) {
      const c = m.content.trim()
      title = c.length > 30 ? `${c.slice(0, 30)}…` : c
    }
    const label = title
      ? `#${m.channelName} · ${order} · ${title}`
      : `#${m.channelName} · порядок ${order}`
    return { key, label, message: m }
  })
}

function SectionAutoRoles({
  templateId,
  messages,
  roles,
  reactionRoles,
  liveRoles,
  onUpdate,
}: {
  templateId: string
  messages: TemplateMessage[]
  roles: TemplateRole[]
  reactionRoles: TemplateReactionRole[]
  liveRoles: GuildRole[]
  onUpdate: () => void
}) {
  const [activeTab, setActiveTab] = useState<"reactions" | "buttons">("reactions")

  // --- Реакции ---
  const [msgKey, setMsgKey] = useState("")
  const [emojiKey, setEmojiKey] = useState("")
  const [roleName, setRoleName] = useState("")
  const [adding, setAdding] = useState(false)
  const [rrError, setRrError] = useState<string | null>(null)

  // --- Кнопки --- (теперь per-message: для каждого сообщения свой редактор)
  // Локальное состояние кнопок по messageId — позволяет редактировать и сохранять
  // каждое сообщение независимо, без потери изменений при переключении.
  const [buttonsByMsg, setButtonsByMsg] = useState<Record<string, SelfRoleButtonDraft[]>>({})
  const [savingMsgId, setSavingMsgId] = useState<string | null>(null)
  const [btnErrorByMsg, setBtnErrorByMsg] = useState<Record<string, string | null>>({})
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set())

  const msgOptions = buildMsgOptions(messages)

  const roleOptions = [
    ...liveRoles.map((r) => ({ value: r.name, label: r.name })),
    ...roles
      .filter((r) => !liveRoles.some((lr) => lr.name === r.name))
      .map((r) => ({ value: r.name, label: r.name })),
  ]

  const orphans = orphanReactionRoles(messages, reactionRoles)

  // Синхронизируем buttonsByMsg с сообщениями из шаблона — добавляем новые, убираем удалённые.
  // Не перезатираем локальные несохранённые правки существующих сообщений.
  useEffect(() => {
    setButtonsByMsg((prev) => {
      const next: Record<string, SelfRoleButtonDraft[]> = {}
      for (const m of messages) {
        if (prev[m.id]) {
          // сохраняем локальные изменения
          next[m.id] = prev[m.id]
        } else {
          next[m.id] = parseSelfRoleComponents(m.componentsJson)
        }
      }
      return next
    })
  }, [messages])

  async function handleAddReaction() {
    const em = emojiKey.trim()
    const r = roleName.trim()
    if (!msgKey || !em || !r) { setRrError("Заполните все поля"); return }
    const colonIdx = msgKey.indexOf(":")
    const channelName = msgKey.slice(0, colonIdx)
    const messageOrder = Number(msgKey.slice(colonIdx + 1)) || 0
    setAdding(true)
    setRrError(null)
    try {
      await createTemplateReactionRole(templateId, { channelName, messageOrder, emojiKey: em, roleName: r })
      setEmojiKey("")
      setRoleName("")
      onUpdate()
    } catch (e) {
      setRrError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteRR(rrId: string) {
    if (!confirm("Удалить эту привязку?")) return
    try {
      await deleteTemplateReactionRole(templateId, rrId)
      onUpdate()
    } catch { /* ignore */ }
  }

  async function handleSaveButtonsFor(msgId: string) {
    const btns = buttonsByMsg[msgId] ?? []
    setBtnErrorByMsg((prev) => ({ ...prev, [msgId]: null }))
    setSavingMsgId(msgId)
    try {
      const componentsJson = serializeSelfRoleComponents(btns) ?? ""
      await updateTemplateMessage(templateId, msgId, { componentsJson })
      onUpdate()
    } catch (e) {
      setBtnErrorByMsg((prev) => ({
        ...prev,
        [msgId]: e instanceof Error ? e.message : "Ошибка сохранения",
      }))
    } finally {
      setSavingMsgId(null)
    }
  }

  function toggleExpanded(msgId: string) {
    setExpandedMsgs((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  function getMsgLabel(msgId: string): string {
    const opt = msgOptions.find((o) => o.message.id === msgId)
    return opt?.label ?? msgId
  }

  const tabClass = (active: boolean) =>
    cn(
      "flex-1 min-w-[100px] rounded-md px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          Автороли
        </CardTitle>
        <CardDescription>
          Управляй реакциями и кнопками, которые выдают роли после установки шаблона.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Переключатель вкладок */}
        <div className="flex flex-wrap rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-1 gap-1">
          <button type="button" onClick={() => setActiveTab("reactions")} className={tabClass(activeTab === "reactions")}>
            Реакции
          </button>
          <button type="button" onClick={() => setActiveTab("buttons")} className={tabClass(activeTab === "buttons")}>
            Кнопки
          </button>
        </div>

        {activeTab === "reactions" ? (
          <>
            {/* Список реакций */}
            {reactionRoles.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Нет привязок реакций.</p>
            ) : (
              <ul className="space-y-2">
                {reactionRoles.map((rr) => {
                  const isOrphan = orphans.some((o) => o.id === rr.id)
                  return (
                    <li
                      key={rr.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-mono",
                        isOrphan
                          ? "border-amber-500/40 bg-amber-500/10"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]"
                      )}
                    >
                      <span>
                        #{rr.channelName} · {rr.messageOrder ?? 0} · {rr.emojiKey} → {rr.roleName}
                        {isOrphan && <span className="ml-2 font-sans text-xs text-amber-300">нет сообщения</span>}
                      </span>
                      <Button type="button" size="sm" variant="ghost" className="text-[hsl(var(--destructive))] shrink-0" onClick={() => void handleDeleteRR(rr.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Форма добавления реакции */}
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-4 space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" />Добавить реакцию</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Сообщение</Label>
                  {messages.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Сначала добавьте сообщения выше.</p>
                  ) : (
                    <Select value={msgKey || "__none__"} onValueChange={(v) => setMsgKey(v === "__none__" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Выберите сообщение" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Не выбрано</SelectItem>
                        {msgOptions.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Эмодзи</Label>
                  <Input value={emojiKey} onChange={(e) => setEmojiKey(e.target.value)} placeholder="✅ или name:id" />
                </div>
                <div className="grid gap-2">
                  <Label>Роль</Label>
                  <Select value={roleName || "__none__"} onValueChange={(v) => setRoleName(v === "__none__" ? "" : v)} disabled={roleOptions.length === 0}>
                    <SelectTrigger><SelectValue placeholder={roleOptions.length === 0 ? "Нет ролей" : "Выберите роль"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Не выбрано</SelectItem>
                      {roleOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {rrError && <p className="text-sm text-[hsl(var(--destructive))]">{rrError}</p>}
              <Button onClick={() => void handleAddReaction()} disabled={adding || !msgKey || !emojiKey.trim() || !roleName.trim() || messages.length === 0}>
                {adding ? "Добавление…" : "Добавить реакцию"}
              </Button>
            </div>
          </>
        ) : (
          <>
            {messages.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Сначала добавьте сообщения выше.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  К каждому сообщению можно независимо добавить свои кнопки авторолей.
                  Нажмите на сообщение, чтобы развернуть редактор.
                </p>
                {messages.map((m) => {
                  const btns = buttonsByMsg[m.id] ?? []
                  const isExpanded = expandedMsgs.has(m.id)
                  const isSaving = savingMsgId === m.id
                  const err = btnErrorByMsg[m.id]
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(m.id)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[hsl(var(--muted)/0.4)] rounded-lg"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{getMsgLabel(m.id)}</span>
                          {btns.length > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                              {btns.length} {btns.length === 1 ? "кнопка" : "кнопок"}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                          {isExpanded ? "▲ скрыть" : "▼ редактировать"}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="border-t p-3 space-y-3">
                          <TemplateSelfRoleButtonsEditor
                            buttons={btns}
                            onChange={(next) =>
                              setButtonsByMsg((prev) => ({ ...prev, [m.id]: next }))
                            }
                            roleOptions={roleOptions.length > 0 ? roleOptions : undefined}
                          />
                          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
                          <Button
                            size="sm"
                            onClick={() => void handleSaveButtonsFor(m.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? "Сохранение…" : "Сохранить кнопки этого сообщения"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Секция «Эмодзи и стикеры»
// ════════════════════════════════════════════════════════════════════════════

function SectionEmojisStickers({
  templateId,
  emojis,
  stickers,
  onUpdate,
}: {
  templateId: string
  emojis: TemplateEmoji[]
  stickers: TemplateSticker[]
  onUpdate: () => void
}) {
  const [tab, setTab] = useState<"emojis" | "stickers">("emojis")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ——— Emoji upload ———
  async function handleEmojiFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    let name = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32)
    // Discord требует минимум 2 символа в имени эмодзи
    if (name.length < 2) name = `emoji_${name || Date.now().toString(36).slice(-4)}`
    name = name.slice(0, 32)
    setError(null)
    setUploading(true)
    try {
      const { url } = await uploadFile(file)
      await createTemplateEmoji(templateId, { name, imageUrl: url })
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки эмодзи")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  async function handleDeleteEmoji(emojiId: string) {
    try {
      await deleteTemplateEmoji(templateId, emojiId)
      onUpdate()
    } catch {
      // silent
    }
  }

  // ——— Sticker upload ———
  const [stickerName, setStickerName] = useState("")
  const [stickerTags, setStickerTags] = useState("😀")
  const [stickerDesc, setStickerDesc] = useState("")

  async function handleStickerFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const name = stickerName.trim() || file.name.replace(/\.[^.]+$/, "").slice(0, 30)
    const tags = stickerTags.trim() || "😀"
    if (!name) return
    setError(null)
    setUploading(true)
    try {
      const { url } = await uploadFile(file)
      await createTemplateSticker(templateId, {
        name,
        tags,
        imageUrl: url,
        description: stickerDesc.trim() || null,
      })
      onUpdate()
      setStickerName("")
      setStickerDesc("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки стикера")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  async function handleDeleteSticker(stickerId: string) {
    try {
      await deleteTemplateSticker(templateId, stickerId)
      onUpdate()
    } catch {
      // silent
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smile className="h-5 w-5" />
          <CardTitle>Эмодзи и стикеры</CardTitle>
        </div>
        <CardDescription>
          Загрузите изображения — при установке шаблона бот автоматически добавит их на сервер.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={tab === "emojis" ? "default" : "outline"}
            onClick={() => setTab("emojis")}
          >
            <Smile className="h-4 w-4 mr-1" />
            Эмодзи ({emojis.length})
          </Button>
          <Button
            size="sm"
            variant={tab === "stickers" ? "default" : "outline"}
            onClick={() => setTab("stickers")}
          >
            <Sticker className="h-4 w-4 mr-1" />
            Стикеры ({stickers.length})
          </Button>
        </div>

        {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}

        {tab === "emojis" && (
          <div className="space-y-3">
            {emojis.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {emojis.map((em) => (
                  <div
                    key={em.id}
                    className="group relative flex flex-col items-center gap-1 p-2 rounded-lg border bg-[hsl(var(--muted)/0.3)]"
                  >
                    <img
                      src={em.imageUrl}
                      alt={em.name}
                      className="w-10 h-10 object-contain"
                    />
                    <span className="text-xs text-[hsl(var(--muted-foreground))] max-w-[80px] truncate">
                      :{em.name}:
                    </span>
                    <button
                      onClick={() => handleDeleteEmoji(em.id)}
                      className="absolute -top-1 -right-1 hidden group-hover:flex w-5 h-5 items-center justify-center rounded-full bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Button size="sm" variant="outline" asChild disabled={uploading}>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    {uploading ? "Загрузка…" : "Загрузить эмодзи"}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/png,image/gif,image/webp,image/jpeg"
                  className="hidden"
                  onChange={handleEmojiFileSelect}
                  disabled={uploading}
                />
              </label>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                PNG, GIF или WebP. Макс. 256 КБ, рекомендуется 128×128 px. Имя берётся из названия файла.
              </p>
            </div>
          </div>
        )}

        {tab === "stickers" && (
          <div className="space-y-3">
            {stickers.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {stickers.map((st) => (
                  <div
                    key={st.id}
                    className="group relative flex flex-col items-center gap-1 p-2 rounded-lg border bg-[hsl(var(--muted)/0.3)]"
                  >
                    <img
                      src={st.imageUrl}
                      alt={st.name}
                      className="w-16 h-16 object-contain"
                    />
                    <span className="text-xs text-[hsl(var(--muted-foreground))] max-w-[100px] truncate">
                      {st.name}
                    </span>
                    <button
                      onClick={() => handleDeleteSticker(st.id)}
                      className="absolute -top-1 -right-1 hidden group-hover:flex w-5 h-5 items-center justify-center rounded-full bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-2 max-w-sm">
              <div className="grid gap-1">
                <Label className="text-xs">Имя стикера</Label>
                <Input
                  value={stickerName}
                  onChange={(e) => setStickerName(e.target.value)}
                  placeholder="Имя стикера (2-30 символов)"
                  maxLength={30}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Тег-эмодзи</Label>
                <Input
                  value={stickerTags}
                  onChange={(e) => setStickerTags(e.target.value)}
                  placeholder="😀"
                  maxLength={32}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Описание (необязательно)</Label>
                <Input
                  value={stickerDesc}
                  onChange={(e) => setStickerDesc(e.target.value)}
                  placeholder="Описание стикера"
                  maxLength={100}
                />
              </div>
            </div>

            <div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Button size="sm" variant="outline" asChild disabled={uploading || !stickerName.trim()}>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    {uploading ? "Загрузка…" : "Загрузить стикер"}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/png,image/apng"
                  className="hidden"
                  onChange={handleStickerFileSelect}
                  disabled={uploading || !stickerName.trim()}
                />
              </label>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                PNG или APNG. Макс. 512 КБ, 320×320 px. Укажите имя и тег перед загрузкой.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Секция «Роли шаблона» — роли которые бот создаст на сервере при установке.
// Все эти роли автоматически окажутся НИЖЕ роли бота в иерархии → бот сможет
// выдавать их через кнопки авторолей без ошибок.
// ════════════════════════════════════════════════════════════════════════════

const ROLE_COLOR_PRESETS: { hex: string; label: string }[] = [
  { hex: "#99AAB5", label: "Серый (дефолт)" },
  { hex: "#F04747", label: "Красный" },
  { hex: "#E67E22", label: "Оранжевый" },
  { hex: "#F1C40F", label: "Жёлтый" },
  { hex: "#2ECC71", label: "Зелёный" },
  { hex: "#3498DB", label: "Синий" },
  { hex: "#9B59B6", label: "Фиолетовый" },
  { hex: "#E91E63", label: "Розовый" },
]

function hexToInt(hex: string): number {
  return parseInt(hex.replace(/^#/, ""), 16) || 0
}
function intToHex(n: number | null | undefined): string {
  if (!n) return "#99AAB5"
  return "#" + n.toString(16).padStart(6, "0").toUpperCase()
}

function SectionRoles({
  templateId,
  roles,
  onUpdate,
}: {
  templateId: string
  roles: TemplateRole[]
  onUpdate: () => void
}) {
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#99AAB5")
  const [newHoist, setNewHoist] = useState(false)
  const [newMentionable, setNewMentionable] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    setError(null)
    try {
      await createTemplateRole(templateId, {
        name,
        color: hexToInt(newColor),
        hoist: newHoist,
        mentionable: newMentionable,
        position: roles.length,
      })
      setNewName("")
      setNewColor("#99AAB5")
      setNewHoist(false)
      setNewMentionable(false)
      onUpdate()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка добавления роли")
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(roleId: string) {
    if (!confirm("Удалить роль из шаблона?")) return
    setDeletingId(roleId)
    try {
      await deleteTemplateRole(templateId, roleId)
      onUpdate()
    } catch {
      // silent
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Роли шаблона</CardTitle>
        <CardDescription>
          Роли, которые бот создаст при установке шаблона на сервер. Все эти роли окажутся <b>ниже роли бота</b>,
          поэтому кнопки авторолей смогут их выдавать. Именно эти роли появятся в выпадающем списке при
          настройке кнопок в разделе «Автороли» ниже.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {roles.length > 0 && (
          <div className="space-y-2">
            {roles.map((r) => {
              const hex = intToHex(r.color)
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-[hsl(var(--muted)/0.2)]"
                >
                  <span
                    className="inline-block w-4 h-4 rounded-full shrink-0 border"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="text-sm font-medium flex-1 truncate">{r.name}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                    {r.hoist ? "• отдельно" : ""} {r.mentionable ? "• упоминаемая" : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <div className="rounded-lg border border-dashed p-3 space-y-3">
          <p className="text-sm font-medium">Добавить роль</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <Label className="text-xs">Имя роли</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Например: Adventurer"
                maxLength={100}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Цвет</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {ROLE_COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setNewColor(c.hex)}
                    title={c.label}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform",
                      newColor === c.hex
                        ? "border-[hsl(var(--foreground))] scale-110"
                        : "border-transparent hover:border-[hsl(var(--border))]",
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border"
                  title="Свой цвет"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={newHoist}
                onChange={(e) => setNewHoist(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Отображать отдельно в списке
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={newMentionable}
                onChange={(e) => setNewMentionable(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Можно упоминать (@роль)
            </label>
          </div>
          {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
          <Button size="sm" onClick={() => void handleAdd()} disabled={adding || !newName.trim()}>
            {adding ? "Добавление…" : "Добавить роль"}
          </Button>
        </div>

        {roles.length === 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Пока нет ни одной роли. Добавьте роли выше — они появятся в списке ролей для кнопок авторолей.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
