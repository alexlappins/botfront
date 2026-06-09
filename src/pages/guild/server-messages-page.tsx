import { useEffect, useState, type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Save, Trash2, MessageSquare, X } from "lucide-react"
import {
  emptyEmbedForm,
  parseEmbedJsonToForm,
  serializeFormToEmbedJson,
  TemplateEmbedBuilder,
  type EmbedFormState,
} from "@/components/template-embed-builder"
import {
  createGuildMessage,
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
  const { t } = useTranslation()
  const guildId = useCurrentGuildId()
  const [messages, setMessages] = useState<GuildMessage[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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
      setError(e instanceof Error ? e.message : t("serverMessages.loadError"))
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          {t("serverMessages.title")}
        </h1>
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("serverMessages.create")}
        </Button>
      </div>

      {messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-12 text-center text-white/55">
          <p>{t("serverMessages.empty")}</p>
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

      {creating && (
        <CreateMessageModal
          guildId={guildId}
          channels={channels}
          roles={roles}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            void load()
          }}
        />
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
  const { t } = useTranslation()
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
      setSavedMsg(t("serverMessages.saved"))
      setTimeout(() => setSavedMsg(null), 2000)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("serverMessages.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(t("serverMessages.deleteConfirm"))) return
    setDeleting(true)
    try {
      await deleteGuildMessage(guildId, message.id)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("serverMessages.deleteFailed"))
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

  // Collapsed header: lead with the embed title (what the user authored), so
  // a list of 10 messages is scannable. Channel name was useless — most users
  // post everything in one channel and saw the same "#announcements" ten times.
  const previewText = (content || message.content || "").trim().slice(0, 60)
  const collapsedLabel =
    embedForm.title?.trim() ||
    previewText ||
    `#${message.channelName}`

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.05]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-white truncate">{collapsedLabel}</span>
          <span className="text-xs text-white/40 truncate">#{message.channelName}</span>
        </div>
        <span className="text-xs text-white/40 shrink-0">
          {open ? t("serverMessages.hide") : t("serverMessages.edit")}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2">
              <button type="button" onClick={() => setTab("text")} className={tabClass(tab === "text")}>
                {t("serverMessages.tabs.text")}
              </button>
              <button type="button" onClick={() => setTab("embed")} className={tabClass(tab === "embed")}>
                {t("serverMessages.tabs.embed")}
              </button>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                {t("serverMessages.save")}
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
              <Label className="text-xs">{t("serverMessages.contentLabel")}</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                value={content}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                placeholder={t("serverMessages.contentPlaceholder")}
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

function CreateMessageModal({
  guildId,
  channels,
  roles,
  onClose,
  onCreated,
}: {
  guildId: string
  channels: Channel[]
  roles: GuildRole[]
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>("text")
  const [channelId, setChannelId] = useState<string>("")
  const [content, setContent] = useState("")
  const [embedForm, setEmbedForm] = useState<EmbedFormState>(() => emptyEmbedForm())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)

  async function handleCreate() {
    setErr(null)
    if (!channelId) {
      setErr(t("serverMessages.errors.pickChannel"))
      return
    }
    const rawContent = friendlyToMentions(content, channels, roles)
    const embedStr = serializeFormToEmbedJson(embedForm)
    let embedObj: Record<string, unknown> | null = null
    if (embedStr) {
      try {
        const parsed = JSON.parse(embedStr) as { embeds?: Record<string, unknown>[] }
        embedObj = parsed.embeds?.[0] ?? null
      } catch {
        setErr(t("serverMessages.errors.badEmbed"))
        return
      }
    }
    const embedRaw = embedObj
      ? (mentionsInObject(embedObj, channels, roles, "toRaw") as Record<string, unknown>)
      : null

    if (!rawContent.trim() && !embedRaw) {
      setErr(t("serverMessages.errors.needContent"))
      return
    }
    setSaving(true)
    try {
      await createGuildMessage(guildId, {
        discordChannelId: channelId,
        content: rawContent.trim() || null,
        embedJson: embedRaw,
      })
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("serverMessages.errors.createFailed"))
    } finally {
      setSaving(false)
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
    )

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0e0e18] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <h2 className="text-base font-semibold text-white">{t("serverMessages.modalTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white"
            aria-label={t("serverMessages.modalClose")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid gap-2">
            <Label className="text-xs">{t("serverMessages.modalChannel")}</Label>
            {/* Radix Select, not a native <select>: the open list is rendered
                in a portal we fully style (dark), so it never flashes the
                OS-default white background. */}
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger>
                <SelectValue placeholder={t("serverMessages.modalPickChannel")} />
              </SelectTrigger>
              <SelectContent>
                {textChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    #{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setTab("text")} className={tabClass(tab === "text")}>
              {t("serverMessages.modalText")}
            </button>
            <button type="button" onClick={() => setTab("embed")} className={tabClass(tab === "embed")}>
              {t("serverMessages.modalEmbed")}
            </button>
          </div>

          {tab === "text" && (
            <div className="grid gap-2">
              <Label className="text-xs">{t("serverMessages.modalContentLabel")}</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                value={content}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                placeholder={t("serverMessages.modalContentPlaceholder")}
                rows={6}
              />
            </div>
          )}

          {tab === "embed" && <TemplateEmbedBuilder form={embedForm} onChange={setEmbedForm} />}

          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              {t("serverMessages.modalCancel")}
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              {t("serverMessages.modalSubmit")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NoServerHint() {
  const { t } = useTranslation()
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
      <p className="text-white/60">{t("serverMessages.selectServer")}</p>
      <p className="text-xs text-white/40 mt-1">{t("serverMessages.selectServerHint")}</p>
    </div>
  )
}
