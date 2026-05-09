import { useEffect, useState, type ChangeEvent } from "react"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Save, Trash2, MessageSquare } from "lucide-react"
import {
  parseEmbedJsonToForm,
  serializeFormToEmbedJson,
  TemplateEmbedBuilder,
  type EmbedFormState,
} from "@/components/template-embed-builder"
import {
  getGuildMessages,
  updateGuildMessage,
  deleteGuildMessage,
  getChannels,
  getGuildRoles,
  type GuildMessage,
  type Channel,
  type GuildRole,
} from "@/lib/api"
import { friendlyToMentions, mentionsToFriendly } from "@/lib/discord-mentions"
import { cn } from "@/lib/utils"

/**
 * User Admin Panel: editor for messages snapshotted from a template at install.
 * Edits are mirrored to the actual Discord message via PATCH (the bot calls message.edit).
 */
export function GuildServerMessagesPage() {
  const guildId = useCurrentGuildId()
  const [messages, setMessages] = useState<GuildMessage[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!guildId) return
    setLoading(true)
    setError(null)
    try {
      const [m, c, r] = await Promise.all([
        getGuildMessages(guildId),
        getChannels(guildId).catch(() => [] as Channel[]),
        getGuildRoles(guildId).catch(() => [] as GuildRole[]),
      ])
      setMessages(m)
      setChannels(c)
      setRoles(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Loading error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId])

  if (!guildId) return <NoServerHint />
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }
  if (error) return <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Шаблоны сообщений
        </h1>
      </div>

      {messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-12 text-center text-white/55">
          <p>No messages yet. They appear here automatically after a template is installed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <ServerMessageCard
              key={m.id}
              guildId={guildId!}
              message={m}
              channels={channels}
              roles={roles}
              onChanged={() => void load()}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type Tab = "text" | "embed"

function ServerMessageCard({
  guildId,
  message,
  channels,
  roles,
  onChanged,
}: {
  guildId: string
  message: GuildMessage
  channels: Channel[]
  roles: GuildRole[]
  onChanged: () => void
}) {
  const [tab, setTab] = useState<Tab>("text")

  // Display: convert <#id>/<@&id> → #name/@Name; on save reverse
  const [content, setContent] = useState(
    mentionsToFriendly(message.content ?? "", channels, roles),
  )
  const [embedForm, setEmbedForm] = useState<EmbedFormState>(() => {
    // Convert mentions inside embed JSON before parsing
    const raw = message.embedJson
      ? mentionsInObject(message.embedJson, channels, roles, "toFriendly")
      : null
    return parseEmbedJsonToForm(raw ?? null)
  })

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setErr(null)
    setSavedMsg(null)
    setSaving(true)
    try {
      // Convert friendly mentions back to raw before sending
      const rawContent = friendlyToMentions(content, channels, roles)

      // Embed
      const embedStr = serializeFormToEmbedJson(embedForm)
      let embedObj: Record<string, unknown> | null = null
      if (embedStr) {
        const parsed = JSON.parse(embedStr) as { embeds?: Record<string, unknown>[] }
        embedObj = parsed.embeds?.[0] ?? null
      }
      const embedRaw = embedObj
        ? (mentionsInObject(embedObj, channels, roles, "toRaw") as Record<string, unknown>)
        : null

      // Buttons / componentsJson are managed in the "Roles by reaction" page,
      // so we DO NOT touch componentsJson here — pass undefined to leave them as-is.
      await updateGuildMessage(guildId, message.id, {
        content: rawContent.trim() || null,
        embedJson: embedRaw,
      })
      setSavedMsg("Saved")
      setTimeout(() => setSavedMsg(null), 2000)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this message? It will be deleted in Discord too.")) return
    setDeleting(true)
    try {
      await deleteGuildMessage(guildId, message.id)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
    )

  // Collapsed by default — compact list, expand a single card for editing.
  const [open, setOpen] = useState(false)

  const previewText = (content || message.content || "").trim().slice(0, 60)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.05]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-white truncate">#{message.channelName}</span>
          <span className="text-xs text-white/40 truncate">{previewText || "(embed)"}</span>
        </div>
        <span className="text-xs text-white/40 shrink-0">
          {open ? "▲ скрыть" : "▼ редактировать"}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2">
              <button type="button" onClick={() => setTab("text")} className={tabClass(tab === "text")}>
                Text
              </button>
              <button type="button" onClick={() => setTab("embed")} className={tabClass(tab === "embed")}>
                Embed
              </button>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {tab === "text" && (
            <div className="grid gap-2">
              <Label className="text-xs">Message content</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                value={content}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                placeholder="Plain text shown above the embed (or alone)"
                rows={5}
              />
            </div>
          )}

          {tab === "embed" && <TemplateEmbedBuilder form={embedForm} onChange={setEmbedForm} />}

          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
          {savedMsg && <p className="text-xs text-[hsl(var(--primary))]">{savedMsg}</p>}
        </div>
      )}
    </div>
  )
}

/**
 * Walk an object and convert string fields between mention forms.
 * direction: 'toFriendly' = `<#id>` → `#name`; 'toRaw' = reverse.
 */
function mentionsInObject(
  obj: Record<string, unknown>,
  channels: Channel[],
  roles: GuildRole[],
  direction: "toFriendly" | "toRaw",
): Record<string, unknown> {
  const fn = direction === "toFriendly" ? mentionsToFriendly : friendlyToMentions
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      out[k] = fn(v, channels, roles)
    } else if (Array.isArray(v)) {
      out[k] = v.map((x) =>
        typeof x === "string"
          ? fn(x, channels, roles)
          : x && typeof x === "object"
            ? mentionsInObject(x as Record<string, unknown>, channels, roles, direction)
            : x,
      )
    } else if (v && typeof v === "object") {
      out[k] = mentionsInObject(v as Record<string, unknown>, channels, roles, direction)
    } else {
      out[k] = v
    }
  }
  return out
}

function NoServerHint() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
      <p className="text-white/60">Выберите сервер в селекторе слева вверху.</p>
      <p className="text-xs text-white/40 mt-1">
        После установки шаблона сообщения отсюда можно редактировать.
      </p>
    </div>
  )
}
