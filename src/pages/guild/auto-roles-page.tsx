import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Smile, Trash2 } from "lucide-react"
import {
  TemplateSelfRoleButtonsEditor,
  parseGuildSelfRoleComponents,
  serializeGuildSelfRoleComponents,
  type SelfRoleButtonDraft,
} from "@/components/template-self-role-buttons"
import {
  getGuildMessages,
  getGuildReactionRoles,
  addGuildReactionRole,
  deleteGuildReactionRole,
  getGuildRoles,
  updateGuildMessage,
  type GuildMessage,
  type GuildReactionRole,
  type GuildRole,
} from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * User Admin Panel: full-featured "Roles by reaction" page — same structure as
 * the admin template editor's "Auto-roles" section: two tabs (Reactions / Buttons).
 *
 * Reactions tab — emoji-reaction → role bindings on per-guild messages.
 * Buttons tab — list of all per-guild messages, each with its own collapsible
 *               buttons editor mirroring real Discord component edits.
 */
export function GuildAutoRolesPage() {
  const { t } = useTranslation()
  const guildId = useCurrentGuildId()
  // Buttons is the most-used sub-section, so it's the default tab.
  const [tab, setTab] = useState<"reactions" | "buttons">("buttons")
  const [messages, setMessages] = useState<GuildMessage[]>([])
  const [bindings, setBindings] = useState<GuildReactionRole[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!guildId) return
    setLoading(true)
    setError(null)
    try {
      const [m, b, r] = await Promise.all([
        getGuildMessages(guildId),
        getGuildReactionRoles(guildId),
        getGuildRoles(guildId),
      ])
      setMessages(m)
      setBindings(b)
      setRoles(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("reactionRoles.loadError"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId])

  if (!guildId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <p className="text-white/60">{t("reactionRoles.selectServer")}</p>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    )
  }
  if (error) return <p className="text-sm text-red-400">{error}</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Smile className="h-7 w-7 text-violet-400" />
          {t("reactionRoles.title")}
        </h1>
        <p className="text-sm text-white/50 mt-1">{t("reactionRoles.sub")}</p>
      </div>

      <div className="flex gap-2 border-b border-white/5">
        <TabBtn active={tab === "buttons"} onClick={() => setTab("buttons")}>
          {t("reactionRoles.tabs.buttons")}
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
            {messages.length}
          </span>
        </TabBtn>
        <TabBtn active={tab === "reactions"} onClick={() => setTab("reactions")}>
          {t("reactionRoles.tabs.reactions")}
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
            {bindings.length}
          </span>
        </TabBtn>
      </div>

      {tab === "reactions" && (
        <ReactionsTab
          guildId={guildId}
          messages={messages}
          bindings={bindings}
          roles={roles}
          onChanged={() => void load()}
        />
      )}

      {tab === "buttons" && (
        <ButtonsTab
          guildId={guildId}
          messages={messages}
          roles={roles}
          onChanged={() => void load()}
        />
      )}
    </div>
  )
}

function TabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative px-5 py-3 text-sm font-medium transition-colors",
        active ? "text-white" : "text-white/50 hover:text-white/80",
      )}
    >
      <span className="inline-flex items-center">{children}</span>
      {active && (
        <span className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
      )}
    </button>
  )
}

// ─── Reactions tab ──────────────────────────────────────────────────────────

function ReactionsTab({
  guildId,
  messages,
  bindings,
  roles,
  onChanged,
}: {
  guildId: string
  messages: GuildMessage[]
  bindings: GuildReactionRole[]
  roles: GuildRole[]
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [msgId, setMsgId] = useState("")
  const [emoji, setEmoji] = useState("")
  const [roleId, setRoleId] = useState("")
  const [adding, setAdding] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)

  function roleLabel(id: string): string {
    return roles.find((r) => r.id === id)?.name ?? id
  }

  function msgLabel(b: GuildReactionRole): string {
    const m = messages.find(
      (x) => x.discordMessageId === b.discordMessageId && x.discordChannelId === b.discordChannelId,
    )
    return m ? `#${m.channelName}` : t("reactionRoles.reactions.channelFallback", { id: b.discordChannelId })
  }

  async function handleAdd() {
    if (!msgId || !emoji.trim() || !roleId) {
      setAddErr(t("reactionRoles.reactions.missingFields"))
      return
    }
    const msg = messages.find((m) => m.id === msgId)
    if (!msg) return
    setAdding(true)
    setAddErr(null)
    try {
      await addGuildReactionRole(guildId, {
        discordChannelId: msg.discordChannelId,
        discordMessageId: msg.discordMessageId,
        emojiKey: emoji.trim(),
        discordRoleId: roleId,
      })
      setEmoji("")
      setRoleId("")
      onChanged()
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : t("reactionRoles.reactions.addFailed"))
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(rrId: string) {
    if (!confirm(t("reactionRoles.reactions.confirmRemove"))) return
    try {
      await deleteGuildReactionRole(guildId, rrId)
      onChanged()
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("reactionRoles.reactions.activeTitle")}</CardTitle>
          <CardDescription>{t("reactionRoles.reactions.activeDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {bindings.length === 0 ? (
            <p className="text-sm text-white/50">{t("reactionRoles.reactions.empty")}</p>
          ) : (
            <div className="space-y-2">
              {bindings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03]"
                >
                  <span className="text-base">{b.emojiKey}</span>
                  <span className="text-sm text-white/40">→</span>
                  <span className="text-sm font-medium">{roleLabel(b.discordRoleId)}</span>
                  <span className="text-xs text-white/40 ml-auto">{msgLabel(b)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleRemove(b.id)}
                    className="text-red-400 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t("reactionRoles.reactions.addTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <Label className="text-xs">{t("reactionRoles.reactions.message")}</Label>
              {messages.length === 0 ? (
                <p className="text-xs text-white/50">{t("reactionRoles.reactions.noMessages")}</p>
              ) : (
                <Select
                  value={msgId || "__none__"}
                  onValueChange={(v) => setMsgId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("reactionRoles.reactions.pickMessage")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("reactionRoles.reactions.notSelected")}</SelectItem>
                    {messages.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        #{m.channelName} · {m.content?.slice(0, 30) || "(embed)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">{t("reactionRoles.reactions.emoji")}</Label>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder={t("reactionRoles.reactions.emojiPlaceholder")}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">{t("reactionRoles.reactions.role")}</Label>
              <Select
                value={roleId || "__none__"}
                onValueChange={(v) => setRoleId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("reactionRoles.reactions.pickRole")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("reactionRoles.reactions.notSelected")}</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {addErr && <p className="text-sm text-red-400">{addErr}</p>}

          <Button
            size="sm"
            onClick={() => void handleAdd()}
            disabled={adding || !msgId || !emoji.trim() || !roleId}
          >
            {adding ? t("reactionRoles.reactions.adding") : t("reactionRoles.reactions.add")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Buttons tab ────────────────────────────────────────────────────────────

function ButtonsTab({
  guildId,
  messages,
  roles,
  onChanged,
}: {
  guildId: string
  messages: GuildMessage[]
  roles: GuildRole[]
  onChanged: () => void
}) {
  const { t } = useTranslation()
  // Local per-message buttons state — like in admin template editor
  const [buttonsByMsg, setButtonsByMsg] = useState<Record<string, SelfRoleButtonDraft[]>>(() => {
    const initial: Record<string, SelfRoleButtonDraft[]> = {}
    for (const m of messages) {
      initial[m.id] = parseGuildSelfRoleComponents(m.componentsJson)
    }
    return initial
  })
  const [savingMsgId, setSavingMsgId] = useState<string | null>(null)
  const [errByMsg, setErrByMsg] = useState<Record<string, string | null>>({})
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set())

  // Re-sync when messages change (after onChanged() reloads)
  useEffect(() => {
    setButtonsByMsg((prev) => {
      const next: Record<string, SelfRoleButtonDraft[]> = {}
      for (const m of messages) {
        next[m.id] = prev[m.id] ?? parseGuildSelfRoleComponents(m.componentsJson)
      }
      return next
    })
  }, [messages])

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.name })),
    [roles],
  )

  function toggleExpanded(msgId: string) {
    setExpandedMsgs((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  async function handleSave(msgId: string) {
    const btns = buttonsByMsg[msgId] ?? []
    setErrByMsg((p) => ({ ...p, [msgId]: null }))
    setSavingMsgId(msgId)
    try {
      const componentsArr = serializeGuildSelfRoleComponents(btns) ?? null
      await updateGuildMessage(guildId, msgId, { componentsJson: componentsArr })
      onChanged()
    } catch (e) {
      setErrByMsg((p) => ({
        ...p,
        [msgId]: e instanceof Error ? e.message : t("reactionRoles.buttons.saveFailed"),
      }))
    } finally {
      setSavingMsgId(null)
    }
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-white/50">
          {t("reactionRoles.buttons.empty")}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">{t("reactionRoles.buttons.intro")}</p>
      {messages.map((m) => {
        const btns = buttonsByMsg[m.id] ?? []
        const isOpen = expandedMsgs.has(m.id)
        const isSaving = savingMsgId === m.id
        const err = errByMsg[m.id]
        return (
          <div
            key={m.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleExpanded(m.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Lead with the embed title (or content preview if no embed)
                    — same reasoning as on the Server Messages page: every
                    message looked identical when only the channel name showed. */}
                <span className="text-sm font-medium text-white truncate">
                  {pickAutoRoleHeader(m)}
                </span>
                <span className="text-xs text-white/40 truncate">
                  #{m.channelName}
                </span>
                {btns.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 ml-2">
                    {btns.length === 1
                      ? t("reactionRoles.buttons.countOne", { count: btns.length })
                      : t("reactionRoles.buttons.countMany", { count: btns.length })}
                  </span>
                )}
              </div>
              <span className="text-xs text-white/40 shrink-0">
                {isOpen ? t("reactionRoles.buttons.hide") : t("reactionRoles.buttons.edit")}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-white/5 p-4 space-y-3">
                <TemplateSelfRoleButtonsEditor
                  buttons={btns}
                  onChange={(next) => setButtonsByMsg((prev) => ({ ...prev, [m.id]: next }))}
                  roleOptions={roleOptions.length > 0 ? roleOptions : undefined}
                />
                {err && <p className="text-sm text-red-400">{err}</p>}
                <Button size="sm" onClick={() => void handleSave(m.id)} disabled={isSaving}>
                  {isSaving ? t("reactionRoles.buttons.saving") : t("reactionRoles.buttons.save")}
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Pick the most informative single-line label for the collapsed row.
 * Order: embed.title → content preview → channel name (last resort).
 * The embed JSON is stored as plain object; we read .title without typing
 * the whole Discord embed shape here.
 */
function pickAutoRoleHeader(m: GuildMessage): string {
  const embed = m.embedJson as { title?: unknown } | null
  const title = typeof embed?.title === "string" ? embed.title.trim() : ""
  if (title) return title
  const content = m.content?.trim()
  if (content) return content.slice(0, 60)
  return `#${m.channelName}`
}
