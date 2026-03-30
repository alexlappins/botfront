import { useEffect, useState } from "react"
import {
  parseEmbedJsonToForm,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  ApiError,
  createTemplateReactionRole,
  deleteTemplateMessage,
  deleteTemplateReactionRole,
  getChannels,
  previewTemplateMessage,
  updateTemplateMessage,
  type Channel,
  type Guild,
  type GuildRole,
  type TemplateChannel,
  type TemplateMessage,
  type TemplateReactionRole,
  type TemplateRole,
} from "@/lib/api"
import { Loader2, Save, Trash2 } from "lucide-react"

const msgTextareaClass =
  "flex min-h-[100px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm ring-offset-[hsl(var(--background))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"

function ChannelNameField({
  id,
  value,
  onChange,
  channels,
  liveChannels = [],
  placeholder = "например verification",
}: {
  id: string
  value: string
  onChange: (v: string) => void
  channels: TemplateChannel[]
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
    </div>
  )
}

function messageCardTitle(m: TemplateMessage): string {
  if (m.embedJson?.trim()) {
    try {
      const p = JSON.parse(m.embedJson) as { embeds?: { title?: string }[] } & { title?: string }
      const e = p.embeds?.[0] ?? p
      const t = e && typeof e === "object" && "title" in e ? (e as { title?: string }).title : undefined
      if (typeof t === "string" && t.trim()) return t.trim()
    } catch {
      /* ignore */
    }
  }
  const c = m.content?.trim()
  if (c) return c.length > 40 ? `${c.slice(0, 40)}…` : c
  return `Сообщение · ${m.channelName}`
}

function embedTitleHint(embedJson: string | null | undefined): string | null {
  if (!embedJson?.trim()) return null
  try {
    const p = JSON.parse(embedJson) as { embeds?: { title?: string }[] }
    const t = p.embeds?.[0]?.title
    if (typeof t === "string" && t.trim()) return t.trim()
  } catch {
    return "эмбед"
  }
  return "эмбед"
}

type PanelTab = "content" | "buttons" | "reactions"
type ContentSubTab = "message" | "embed"

export function TemplateMessageSelfRoleCard({
  templateId,
  message,
  templateChannels,
  templateRoles,
  liveChannels,
  liveRoles,
  guilds,
  previewDefaultGuildId,
  reactionRoles,
  onUpdate,
}: {
  templateId: string
  message: TemplateMessage
  templateChannels: TemplateChannel[]
  templateRoles: TemplateRole[]
  liveChannels: Channel[]
  liveRoles: GuildRole[]
  guilds: Guild[]
  previewDefaultGuildId: string
  /** Реакции только для этого сообщения (канал + messageOrder) */
  reactionRoles: TemplateReactionRole[]
  onUpdate: () => void
}) {
  const [channelName, setChannelName] = useState(message.channelName)
  const [messageOrder, setMessageOrder] = useState(message.messageOrder != null ? String(message.messageOrder) : "")
  const [content, setContent] = useState(message.content ?? "")
  const [embedForm, setEmbedForm] = useState<EmbedFormState>(() => parseEmbedJsonToForm(message.embedJson))
  const [selfRoleButtons, setSelfRoleButtons] = useState<SelfRoleButtonDraft[]>(() =>
    parseSelfRoleComponents(message.componentsJson)
  )
  const [panelTab, setPanelTab] = useState<PanelTab>("content")
  const [contentSubTab, setContentSubTab] = useState<ContentSubTab>("message")

  const [emojiKey, setEmojiKey] = useState("")
  const [reactionRoleName, setReactionRoleName] = useState("")
  const [addingReaction, setAddingReaction] = useState(false)

  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const [previewGuildId, setPreviewGuildId] = useState(previewDefaultGuildId || "")
  const [previewChannelId, setPreviewChannelId] = useState("")
  const [previewChannelsList, setPreviewChannelsList] = useState<Channel[]>([])
  const [loadingPreviewChannels, setLoadingPreviewChannels] = useState(false)
  const [previewPanelError, setPreviewPanelError] = useState<string | null>(null)
  const [previewSending, setPreviewSending] = useState(false)

  useEffect(() => {
    setChannelName(message.channelName)
    setMessageOrder(message.messageOrder != null ? String(message.messageOrder) : "")
    setContent(message.content ?? "")
    setEmbedForm(parseEmbedJsonToForm(message.embedJson))
    setSelfRoleButtons(parseSelfRoleComponents(message.componentsJson))
    setLocalError(null)
  }, [
    message.id,
    message.channelName,
    message.messageOrder,
    message.content,
    message.embedJson,
    message.componentsJson,
  ])

  useEffect(() => {
    if (!previewGuildId.trim()) {
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
  }, [previewGuildId])

  const embedJsonStr = serializeFormToEmbedJson(embedForm)
  const componentsJsonStr = serializeSelfRoleComponents(selfRoleButtons)
  const hasContent = Boolean(content.trim())
  const hasEmbed = embedJsonStr != null
  const hasComponents = componentsJsonStr != null

  async function handleSave() {
    const ch = channelName.trim()
    if (!ch) {
      setLocalError("Укажите имя канала")
      return
    }
    if (!hasContent && !hasEmbed && !hasComponents) {
      setLocalError("Нужны текст, эмбед или кнопки авторолей")
      return
    }
    setLocalError(null)
    setSaving(true)
    try {
      const orderRaw = messageOrder.trim()
      let order: number | undefined
      if (orderRaw !== "") {
        const n = Number(orderRaw)
        if (Number.isFinite(n)) order = Math.floor(n)
      }
      const embedJsonOut = hasEmbed ? embedJsonStr : ""
      const componentsJsonOut = hasComponents ? componentsJsonStr : ""
      await updateTemplateMessage(templateId, message.id, {
        channelName: ch,
        messageOrder: order,
        content: hasContent ? content.trim() : undefined,
        embedJson: embedJsonOut,
        componentsJson: componentsJsonOut,
      })
      onUpdate()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Удалить это сообщение из шаблона? Привязки реакций к нему останутся в списке «без сообщения», пока не удалите их вручную.")) return
    try {
      await deleteTemplateMessage(templateId, message.id)
      onUpdate()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Ошибка удаления")
    }
  }

  async function handlePreviewInDiscord() {
    if (!hasContent && !hasEmbed && !hasComponents) {
      setPreviewPanelError("Нужен текст, эмбед или кнопки")
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
        componentsJson: componentsJsonStr ?? undefined,
      })
    } catch (e) {
      setPreviewPanelError(e instanceof ApiError ? e.message : "Не удалось отправить превью")
    } finally {
      setPreviewSending(false)
    }
  }

  async function handleAddReaction() {
    const em = emojiKey.trim()
    const r = reactionRoleName.trim()
    const ch = channelName.trim()
    if (!ch || !em || !r) return
    const orderRaw = messageOrder.trim()
    let messageOrderNum = 0
    if (orderRaw !== "") {
      const n = Number(orderRaw)
      if (Number.isFinite(n)) messageOrderNum = Math.floor(n)
    }
    setAddingReaction(true)
    setLocalError(null)
    try {
      await createTemplateReactionRole(templateId, {
        channelName: ch,
        messageOrder: messageOrderNum,
        emojiKey: em,
        roleName: r,
      })
      setEmojiKey("")
      setReactionRoleName("")
      onUpdate()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setAddingReaction(false)
    }
  }

  async function handleDeleteReaction(rrId: string) {
    if (!confirm("Удалить эту привязку?")) return
    try {
      await deleteTemplateReactionRole(templateId, rrId)
      onUpdate()
    } catch {
      /* ignore */
    }
  }

  const orderDisplay = messageOrder.trim() === "" ? "0" : messageOrder.trim()
  const embedHint = embedTitleHint(serializeFormToEmbedJson(embedForm) ?? message.embedJson)

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] px-4 py-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-base leading-tight truncate">{messageCardTitle(message)}</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            <span className="font-mono">#{channelName.trim() || "…"}</span>
            <span className="mx-1">·</span>
            порядок <span className="font-mono">{orderDisplay}</span>
            {embedHint ? (
              <>
                <span className="mx-1">·</span>
                эмбед: {embedHint}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-1.5 hidden sm:inline">Сохранить</span>
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => void handleDelete()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Канал (имя в шаблоне)</Label>
            <ChannelNameField
              id={`card-ch-${message.id}`}
              value={channelName}
              onChange={setChannelName}
              channels={templateChannels}
              liveChannels={liveChannels}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Как в Discord после установки шаблона, без <code className="text-[10px]">#</code>
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`card-order-${message.id}`} className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Порядок сообщения (messageOrder)
            </Label>
            <Input
              id={`card-order-${message.id}`}
              type="number"
              value={messageOrder}
              onChange={(e) => setMessageOrder(e.target.value)}
              placeholder="0, 1, 2…"
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Какое по счёту сообщение в этом канале получит бот при развёртывании
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">Тип взаимодействия</p>
          <div className="flex flex-wrap rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-1 gap-1">
            <button
              type="button"
              onClick={() => setPanelTab("content")}
              className={cn(
                "flex-1 min-w-[88px] rounded-md px-3 py-2 text-sm font-medium transition-colors",
                panelTab === "content"
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              )}
            >
              Контент
            </button>
            <button
              type="button"
              onClick={() => setPanelTab("buttons")}
              className={cn(
                "flex-1 min-w-[88px] rounded-md px-3 py-2 text-sm font-medium transition-colors",
                panelTab === "buttons"
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              )}
            >
              Кнопки
            </button>
            <button
              type="button"
              onClick={() => setPanelTab("reactions")}
              className={cn(
                "flex-1 min-w-[88px] rounded-md px-3 py-2 text-sm font-medium transition-colors",
                panelTab === "reactions"
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              )}
            >
              Реакции
            </button>
            <button
              type="button"
              disabled
              title="Скоро"
              className="flex-1 min-w-[88px] rounded-md px-3 py-2 text-sm font-medium opacity-45 cursor-not-allowed text-[hsl(var(--muted-foreground))]"
            >
              Меню
            </button>
          </div>
        </div>

        {panelTab === "content" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.15)] p-1 gap-1">
              <button
                type="button"
                onClick={() => setContentSubTab("message")}
                className={cn(
                  "flex-1 min-w-[100px] rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  contentSubTab === "message"
                    ? "bg-[hsl(var(--background))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))]"
                )}
              >
                Текст
              </button>
              <button
                type="button"
                onClick={() => setContentSubTab("embed")}
                className={cn(
                  "flex-1 min-w-[100px] rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  contentSubTab === "embed"
                    ? "bg-[hsl(var(--background))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))]"
                )}
              >
                Эмбед
              </button>
            </div>
            {contentSubTab === "message" ? (
              <div className="grid gap-2">
                <Label htmlFor={`card-txt-${message.id}`}>Текст сообщения</Label>
                <textarea
                  id={`card-txt-${message.id}`}
                  className={msgTextareaClass}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Текст над эмбедом или без эмбеда"
                  rows={5}
                />
              </div>
            ) : (
              <TemplateEmbedBuilder form={embedForm} onChange={setEmbedForm} />
            )}
          </div>
        ) : panelTab === "buttons" ? (
          <TemplateSelfRoleButtonsEditor buttons={selfRoleButtons} onChange={setSelfRoleButtons} />
        ) : (
          <div className="space-y-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.15)] p-4">
            <div>
              <p className="text-sm font-medium">Реакции → роли</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Привязаны к этому же каналу и порядку сообщения. После установки бот навесит реакции на сообщение.
              </p>
            </div>
            {reactionRoles.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Пока нет привязок</p>
            ) : (
              <ul className="space-y-2">
                {reactionRoles.map((rr) => (
                  <li
                    key={rr.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="text-lg leading-none mr-2">{rr.emojiKey}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">→</span>{" "}
                      <span className="font-medium">{rr.roleName}</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-[hsl(var(--destructive))]"
                      onClick={() => void handleDeleteReaction(rr.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-2 border-t border-[hsl(var(--border))] pt-4">
              <div className="grid gap-2">
                <Label>Эмодзи (emojiKey)</Label>
                <Input value={emojiKey} onChange={(e) => setEmojiKey(e.target.value)} placeholder="✅ или name:id" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`card-rr-role-${message.id}`}>Роль (имя)</Label>
                <RoleNameField
                  id={`card-rr-role-${message.id}`}
                  value={reactionRoleName}
                  onChange={setReactionRoleName}
                  roles={templateRoles}
                  liveRoles={liveRoles}
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleAddReaction()}
              disabled={addingReaction || !emojiKey.trim() || !reactionRoleName.trim() || !channelName.trim()}
            >
              {addingReaction ? "Добавление…" : "+ Добавить привязку"}
            </Button>
          </div>
        )}

        <details className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.1)] px-3 py-2 group">
          <summary className="text-sm font-medium cursor-pointer list-none flex items-center justify-between">
            Превью в Discord
            <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">тестовая отправка</span>
          </summary>
          <div className="mt-3 space-y-3 pt-1 border-t border-[hsl(var(--border))]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-xs">Сервер</Label>
                <Select
                  value={previewGuildId || "__none__"}
                  onValueChange={(v) => {
                    const id = v === "__none__" ? "" : v
                    setPreviewGuildId(id)
                    setPreviewChannelId("")
                  }}
                >
                  <SelectTrigger>
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
                <Label className="text-xs">Канал</Label>
                <Select
                  value={previewChannelId || "__none__"}
                  onValueChange={(v) => setPreviewChannelId(v === "__none__" ? "" : v)}
                  disabled={!previewGuildId.trim() || loadingPreviewChannels}
                >
                  <SelectTrigger>
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
            {previewPanelError ? <p className="text-sm text-[hsl(var(--destructive))]">{previewPanelError}</p> : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handlePreviewInDiscord()}
              disabled={previewSending || !previewGuildId.trim() || !previewChannelId.trim()}
            >
              {previewSending ? "Отправка…" : "Отправить тест в канал"}
            </Button>
          </div>
        </details>

        {localError ? <p className="text-sm text-[hsl(var(--destructive))]">{localError}</p> : null}
      </div>
    </div>
  )
}
