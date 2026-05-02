import { useEffect, useState, type ChangeEvent } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, Save, Trash2, MessageSquare } from "lucide-react"
import {
  parseEmbedJsonToForm,
  serializeFormToEmbedJson,
  TemplateEmbedBuilder,
  type EmbedFormState,
} from "@/components/template-embed-builder"
import {
  TemplateSelfRoleButtonsEditor,
  parseGuildSelfRoleComponents,
  serializeGuildSelfRoleComponents,
  type SelfRoleButtonDraft,
} from "@/components/template-self-role-buttons"
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
  const { guildId } = useParams<{ guildId: string }>()
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
          Server Messages
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Messages added by the template are listed here. Edit text / embed / buttons and the bot
          will update them in Discord. Channel mentions are shown as <code>#name</code> and roles
          as <code>@Name</code> for readability — both forms are converted automatically on save.
        </p>
      </div>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[hsl(var(--muted-foreground))]">
            <p>No messages yet. They appear here automatically after a template is installed.</p>
          </CardContent>
        </Card>
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

type Tab = "text" | "embed" | "buttons"

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
  const [buttons, setButtons] = useState<SelfRoleButtonDraft[]>(() =>
    parseGuildSelfRoleComponents(message.componentsJson),
  )

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }))

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

      // Components / buttons
      const componentsArr = serializeGuildSelfRoleComponents(buttons) ?? null

      await updateGuildMessage(guildId, message.id, {
        content: rawContent.trim() || null,
        embedJson: embedRaw,
        componentsJson: componentsArr,
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-base truncate">#{message.channelName}</CardTitle>
          <CardDescription className="text-xs">
            Discord message ID: <code className="text-[10px]">{message.discordMessageId}</code>
          </CardDescription>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
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
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab("text")} className={tabClass(tab === "text")}>
            Text
          </button>
          <button type="button" onClick={() => setTab("embed")} className={tabClass(tab === "embed")}>
            Embed
          </button>
          <button type="button" onClick={() => setTab("buttons")} className={tabClass(tab === "buttons")}>
            Buttons {buttons.length > 0 && (
              <span className="ml-1 text-[10px] px-1 rounded bg-[hsl(var(--primary)/0.2)]">
                {buttons.length}
              </span>
            )}
          </button>
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
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              You can type <code>#channel-name</code> for a channel link and <code>@RoleName</code>{" "}
              for a role mention — they will be converted to clickable Discord mentions on save.
            </p>
          </div>
        )}

        {tab === "embed" && <TemplateEmbedBuilder form={embedForm} onChange={setEmbedForm} />}

        {tab === "buttons" && (
          <TemplateSelfRoleButtonsEditor
            buttons={buttons}
            onChange={setButtons}
            roleOptions={roleOptions.length > 0 ? roleOptions : undefined}
          />
        )}

        {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
        {savedMsg && <p className="text-xs text-[hsl(var(--primary))]">{savedMsg}</p>}
      </CardContent>
    </Card>
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
