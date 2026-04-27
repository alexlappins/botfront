import { useEffect, useState } from "react"
import {
  parseEmbedJsonToForm,
  serializeFormToEmbedJson,
  type EmbedFormState,
  TemplateEmbedBuilder,
} from "@/components/template-embed-builder"
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
  deleteTemplateMessage,
  getChannels,
  previewTemplateMessage,
  updateTemplateMessage,
  type Channel,
  type Guild,
  type TemplateChannel,
  type TemplateMessage,
} from "@/lib/api"
import { Loader2, Save, Trash2 } from "lucide-react"

const msgTextareaClass =
  "flex min-h-[100px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm ring-offset-[hsl(var(--background))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"

/**
 * Нормализует embedJson — бэк может отдавать либо строку (JSON), либо уже распарсенный объект
 * (после последних правок сервер хранит в JSONB как объект). Возвращаем всегда объект или null.
 */
function toEmbedObject(val: unknown): Record<string, unknown> | null {
  if (val == null) return null
  if (typeof val === "object" && !Array.isArray(val)) return val as Record<string, unknown>
  if (typeof val === "string") {
    const s = val.trim()
    if (!s) return null
    try {
      const parsed = JSON.parse(s) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

export function messageCardTitle(m: TemplateMessage): string {
  const p = toEmbedObject(m.embedJson as unknown) as
    | ({ embeds?: { title?: string }[] } & { title?: string })
    | null
  if (p) {
    const e = p.embeds?.[0] ?? p
    const t = e && typeof e === "object" && "title" in e ? (e as { title?: string }).title : undefined
    if (typeof t === "string" && t.trim()) return t.trim()
  }
  const c = m.content?.trim()
  if (c) return c.length > 40 ? `${c.slice(0, 40)}…` : c
  return `Message · ${m.channelName}`
}

function embedTitleHint(embedJson: unknown): string | null {
  const p = toEmbedObject(embedJson) as ({ embeds?: { title?: string }[] } & { title?: string }) | null
  if (!p) return null
  const t = p.embeds?.[0]?.title ?? p.title
  if (typeof t === "string" && t.trim()) return t.trim()
  return "embed"
}

type ContentTab = "message" | "embed"

export function TemplateMessageSelfRoleCard({
  templateId,
  message,
  templateChannels,
  liveChannels,
  guilds,
  previewDefaultGuildId,
  onUpdate,
}: {
  templateId: string
  message: TemplateMessage
  templateChannels: TemplateChannel[]
  liveChannels: Channel[]
  guilds: Guild[]
  previewDefaultGuildId: string
  onUpdate: () => void
}) {
  const [channelName, setChannelName] = useState(message.channelName)
  const [messageOrder, setMessageOrder] = useState(
    message.messageOrder != null ? String(message.messageOrder) : ""
  )
  const [content, setContent] = useState(message.content ?? "")
  const [embedForm, setEmbedForm] = useState<EmbedFormState>(() =>
    parseEmbedJsonToForm(message.embedJson)
  )
  const [contentTab, setContentTab] = useState<ContentTab>("message")

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
    setLocalError(null)
  }, [message.id, message.channelName, message.messageOrder, message.content, message.embedJson])

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
        if (!cancelled) setPreviewChannelsList(ch.filter((c) => c.type === 0 || c.type === 5))
      })
      .catch((e) => {
        if (!cancelled) {
          setPreviewChannelsList([])
          setPreviewPanelError(e instanceof Error ? e.message : "Failed to load channels")
        }
      })
      .finally(() => { if (!cancelled) setLoadingPreviewChannels(false) })
    return () => { cancelled = true }
  }, [previewGuildId])

  const embedJsonStr = serializeFormToEmbedJson(embedForm)
  const hasContent = Boolean(content.trim())
  const hasEmbed = embedJsonStr != null

  async function handleSave() {
    const ch = channelName.trim()
    if (!ch) {
      setLocalError("Pick a channel")
      return
    }
    if (!hasContent && !hasEmbed) {
      setLocalError("Text or embed is required")
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
      await updateTemplateMessage(templateId, message.id, {
        channelName: ch,
        messageOrder: order,
        content: hasContent ? content.trim() : undefined,
        embedJson: hasEmbed ? embedJsonStr : "",
      })
      onUpdate()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this message from the template?")) return
    try {
      await deleteTemplateMessage(templateId, message.id)
      onUpdate()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to delete")
    }
  }

  async function handlePreviewInDiscord() {
    // componentsJson хранится в message и управляется разделом «Автороли»
    const componentsJson = message.componentsJson ?? undefined
    const hasComponents = Boolean(componentsJson)

    if (!hasContent && !hasEmbed && !hasComponents) {
      setPreviewPanelError("Text, embed or auto-role buttons are required")
      return
    }
    if (!previewGuildId.trim() || !previewChannelId.trim()) {
      setPreviewPanelError("Pick a server and a channel")
      return
    }
    setPreviewPanelError(null)
    setPreviewSending(true)
    try {
      await previewTemplateMessage(previewGuildId.trim(), {
        channelId: previewChannelId.trim(),
        content: hasContent ? content.trim() : undefined,
        embedJson: embedJsonStr ?? undefined,
        componentsJson,
      })
    } catch (e) {
      setPreviewPanelError(e instanceof ApiError ? e.message : "Failed to send preview")
    } finally {
      setPreviewSending(false)
    }
  }

  const orderDisplay = messageOrder.trim() === "" ? "0" : messageOrder.trim()
  const embedHint = embedTitleHint(embedJsonStr ?? message.embedJson)

  // Дедупликация каналов: сначала живые, потом шаблонные
  const liveChannelNames = new Set(liveChannels.map((c) => c.name))
  const channelOptions: { name: string }[] = [
    ...liveChannels.map((c) => ({ name: c.name })),
    ...templateChannels
      .filter((c) => !liveChannelNames.has(c.name))
      .map((c) => ({ name: c.name })),
  ]

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] px-4 py-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-base leading-tight truncate">{messageCardTitle(message)}</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            <span className="font-mono">#{channelName.trim() || "…"}</span>
            <span className="mx-1">·</span>
            order <span className="font-mono">{orderDisplay}</span>
            {embedHint ? (
              <>
                <span className="mx-1">·</span>
                embed: {embedHint}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-1.5 hidden sm:inline">Save</span>
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => void handleDelete()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Канал */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Channel
            </Label>
            {channelOptions.length > 0 ? (
              <Select
                value={channelName || "__none__"}
                onValueChange={(v) => setChannelName(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Pick a channel</SelectItem>
                  {channelOptions.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      #{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. verification"
              />
            )}
          </div>
          <div className="grid gap-2">
            <Label
              htmlFor={`card-order-${message.id}`}
              className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]"
            >
              Order (messageOrder)
            </Label>
            <Input
              id={`card-order-${message.id}`}
              type="number"
              value={messageOrder}
              onChange={(e) => setMessageOrder(e.target.value)}
              placeholder="0, 1, 2…"
            />
          </div>
        </div>

        {/* Контент: Текст | Эмбед */}
        <div className="space-y-3">
          <div className="flex flex-wrap rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.15)] p-1 gap-1">
            <button
              type="button"
              onClick={() => setContentTab("message")}
              className={cn(
                "flex-1 min-w-[100px] rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                contentTab === "message"
                  ? "bg-[hsl(var(--background))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))]"
              )}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setContentTab("embed")}
              className={cn(
                "flex-1 min-w-[100px] rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                contentTab === "embed"
                  ? "bg-[hsl(var(--background))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))]"
              )}
            >
              Embed
            </button>
          </div>
          {contentTab === "message" ? (
            <div className="grid gap-2">
              <Label htmlFor={`card-txt-${message.id}`}>Message content</Label>
              <textarea
                id={`card-txt-${message.id}`}
                className={msgTextareaClass}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Text above the embed, or without an embed"
                rows={5}
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Placeholders: <code>{"{{#channel-name}}"}</code> — clickable channel link,
                {" "}<code>{"{{RoleName}}"}</code> — role ID (for a mention write{" "}
                <code>{"<@&{{RoleName}}>"}</code>). They are substituted when the template is installed.
              </p>
            </div>
          ) : (
            <TemplateEmbedBuilder form={embedForm} onChange={setEmbedForm} />
          )}
        </div>

        {/* Превью */}
        <details className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.1)] px-3 py-2">
          <summary className="text-sm font-medium cursor-pointer list-none flex items-center justify-between">
            Preview in Discord
            <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">test send</span>
          </summary>
          <div className="mt-3 space-y-3 pt-1 border-t border-[hsl(var(--border))]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-xs">Server</Label>
                <Select
                  value={previewGuildId || "__none__"}
                  onValueChange={(v) => {
                    setPreviewGuildId(v === "__none__" ? "" : v)
                    setPreviewChannelId("")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a server" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not selected</SelectItem>
                    {guilds.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Channel</Label>
                <Select
                  value={previewChannelId || "__none__"}
                  onValueChange={(v) => setPreviewChannelId(v === "__none__" ? "" : v)}
                  disabled={!previewGuildId || loadingPreviewChannels}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingPreviewChannels ? "Loading…" : "Channel"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not selected</SelectItem>
                    {previewChannelsList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {previewPanelError && (
              <p className="text-sm text-[hsl(var(--destructive))]">{previewPanelError}</p>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handlePreviewInDiscord()}
              disabled={previewSending || !previewGuildId || !previewChannelId}
            >
              {previewSending ? "Sending…" : "Send test to channel"}
            </Button>
          </div>
        </details>

        {localError && <p className="text-sm text-[hsl(var(--destructive))]">{localError}</p>}
      </div>
    </div>
  )
}
