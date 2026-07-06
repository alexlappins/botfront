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
import { Loader2, Pencil, Plus, Save, Send, Trash2, MessageSquare, X } from "lucide-react"
import {
  emptyEmbedForm,
  parseEmbedJsonToForm,
  serializeFormToEmbedJson,
  TemplateEmbedBuilder,
  type EmbedFormState,
} from "@/components/template-embed-builder"
import {
  createGuildMessage,
  createScheduledPost,
  deleteGuildMessage,
  deleteScheduledPost,
  getChannels,
  getGuildMessages,
  getGuildRoles,
  listScheduledPosts,
  resendGuildMessage,
  updateGuildMessage,
  updateScheduledPost,
  type Channel,
  type GuildMessage,
  type GuildRole,
  type ScheduledPost,
  type ScheduleKind,
} from "@/lib/api"
import { usePremium } from "@/contexts/premium-context"
import { PremiumChip, usePremiumModal } from "@/components/premium"
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
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function load() {
    if (!guildId) return
    setLoading(true)
    setError(null)
    try {
      const [m, c, r, sp] = await Promise.all([
        getGuildMessages(guildId),
        getChannels(guildId).catch(() => [] as Channel[]),
        getGuildRoles(guildId).catch(() => [] as GuildRole[]),
        listScheduledPosts(guildId).catch(() => [] as ScheduledPost[]),
      ])
      setMessages(m)
      setChannels(c)
      setRoles(r)
      setScheduled(sp)
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

      {scheduled.length > 0 && (
        <ScheduledPostsList
          guildId={guildId}
          posts={scheduled}
          channels={channels}
          onChanged={() => void load()}
        />
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

/** Scheduled/recurring posts management list (TZ v2.1 §2.4). */
function ScheduledPostsList({
  guildId,
  posts,
  channels,
  onChanged,
}: {
  guildId: string
  posts: ScheduledPost[]
  channels: Channel[]
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ScheduledPost | null>(null)

  function channelName(id: string): string {
    return channels.find((c) => c.id === id)?.name ?? id
  }

  async function toggle(post: ScheduledPost) {
    setBusyId(post.id)
    try {
      await updateScheduledPost(guildId, post.id, {
        status: post.status === "paused" ? "active" : "paused",
      })
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  async function remove(post: ScheduledPost) {
    if (!confirm(t("serverMessages.schedule.deleteConfirm"))) return
    setBusyId(post.id)
    try {
      await deleteScheduledPost(guildId, post.id)
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
      <p className="text-sm font-semibold text-white">{t("serverMessages.schedule.listTitle")}</p>
      {posts.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.02] text-sm"
        >
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 shrink-0">
            {p.kind === "once"
              ? t("serverMessages.schedule.scheduledBadge")
              : t("serverMessages.schedule.recurringBadge")}
          </span>
          <span className="text-white/80 truncate flex-1 min-w-0">
            #{channelName(p.channelId)}
            {p.content ? ` · ${p.content.slice(0, 40)}` : ""}
          </span>
          <span className="text-xs text-white/40 shrink-0">
            {p.status === "done"
              ? t("serverMessages.schedule.done")
              : p.status === "paused"
                ? t("serverMessages.schedule.paused")
                : p.nextRunAt
                  ? `${t("serverMessages.schedule.next")}: ${new Date(p.nextRunAt).toLocaleString()}`
                  : "—"}
            {" · "}
            {p.runCount} {t("serverMessages.schedule.runs")}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === p.id}
            onClick={() => setEditing(p)}
            title={t("serverMessages.schedule.edit")}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {p.status !== "done" && (
            <Button size="sm" variant="ghost" disabled={busyId === p.id} onClick={() => void toggle(p)}>
              {p.status === "paused"
                ? t("serverMessages.schedule.resume")
                : t("serverMessages.schedule.pause")}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === p.id}
            onClick={() => void remove(p)}
            className="text-red-400 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {editing && (
        <EditScheduledPostModal
          guildId={guildId}
          post={editing}
          channels={channels}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

/**
 * Edit an existing scheduled post before it fires (TZ §2): message content
 * (text + embed incl. images), target channel, run time, and recurrence.
 * PUT /scheduled-posts/:id recomputes next_run_at server-side.
 */
function EditScheduledPostModal({
  guildId,
  post,
  channels,
  onClose,
  onSaved,
}: {
  guildId: string
  post: ScheduledPost
  channels: Channel[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>("text")
  const [channelId, setChannelId] = useState(post.channelId)
  const [content, setContent] = useState(post.content ?? "")
  const [embedForm, setEmbedForm] = useState<EmbedFormState>(() =>
    parseEmbedJsonToForm(post.embedJson ?? null),
  )
  const [kind, setKind] = useState<ScheduleKind>(post.kind)
  // datetime-local wants "YYYY-MM-DDTHH:MM" in the admin's local tz.
  const [runAtLocal, setRunAtLocal] = useState(() =>
    post.nextRunAt ? toDatetimeLocal(new Date(post.nextRunAt)) : "",
  )
  const [timeLocal, setTimeLocal] = useState(() =>
    post.timeOfDay ? utcTimeToLocal(post.timeOfDay) : "12:00",
  )
  const [weekDays, setWeekDays] = useState<number[]>(post.daysOfWeek ?? [])
  const [monthDay, setMonthDay] = useState(post.dayOfMonth ?? 1)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)

  async function handleSave() {
    setErr(null)
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
    if (!content.trim() && !embedObj) {
      setErr(t("serverMessages.errors.needContent"))
      return
    }
    setSaving(true)
    try {
      await updateScheduledPost(guildId, post.id, {
        channelId,
        content: content.trim() || null,
        embedJson: embedObj,
        kind,
        ...(kind === "once" ? { runAt: new Date(runAtLocal).toISOString() } : {}),
        ...(kind !== "once" ? { timeOfDay: localHHMMToUtc(timeLocal) } : {}),
        ...(kind === "weekly" ? { daysOfWeek: weekDays } : {}),
        ...(kind === "monthly" ? { dayOfMonth: monthDay } : {}),
        // Editing a fired one-off re-arms it (TZ §3).
        ...(post.status === "done" ? { status: "active" as const } : {}),
      })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("serverMessages.saveFailed"))
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
          <h2 className="text-base font-semibold text-white">
            {t("serverMessages.schedule.editTitle")}
          </h2>
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
                rows={6}
              />
            </div>
          )}

          {tab === "embed" && <TemplateEmbedBuilder form={embedForm} onChange={setEmbedForm} />}

          {/* Timing */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <p className="text-sm font-semibold text-white">{t("serverMessages.schedule.title")}</p>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { v: "once" as const, label: t("serverMessages.schedule.later") },
                  { v: "daily" as const, label: t("serverMessages.schedule.daily") },
                  { v: "weekly" as const, label: t("serverMessages.schedule.weekly") },
                  { v: "monthly" as const, label: t("serverMessages.schedule.monthly") },
                ]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setKind(opt.v)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    kind === opt.v
                      ? "border-violet-500 bg-violet-500/15 text-white"
                      : "border-white/10 text-white/60 hover:bg-white/[0.04]",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {kind === "once" && (
              <div className="grid gap-1.5 max-w-[280px]">
                <Label className="text-xs">{t("serverMessages.schedule.runAt")}</Label>
                <input
                  type="datetime-local"
                  value={runAtLocal}
                  onChange={(e) => setRunAtLocal(e.target.value)}
                  className="rounded-md border border-white/10 bg-[#15151f] text-white px-3 py-2 text-sm [color-scheme:dark]"
                />
              </div>
            )}

            {kind !== "once" && (
              <div className="grid gap-1.5 max-w-[180px]">
                <Label className="text-xs">{t("serverMessages.schedule.timeOfDay")}</Label>
                <input
                  type="time"
                  value={timeLocal}
                  onChange={(e) => setTimeLocal(e.target.value)}
                  className="rounded-md border border-white/10 bg-[#15151f] text-white px-3 py-2 text-sm [color-scheme:dark]"
                />
              </div>
            )}

            {kind === "weekly" && (
              <div className="grid gap-1.5">
                <Label className="text-xs">{t("serverMessages.schedule.daysOfWeek")}</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {(t("serverMessages.schedule.days", { returnObjects: true }) as string[]).map(
                    (day, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setWeekDays((prev) =>
                            prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx],
                          )
                        }
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs border",
                          weekDays.includes(idx)
                            ? "border-violet-500 bg-violet-500/15 text-white"
                            : "border-white/10 text-white/60 hover:bg-white/[0.04]",
                        )}
                      >
                        {day}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {kind === "monthly" && (
              <div className="grid gap-1.5 max-w-[120px]">
                <Label className="text-xs">{t("serverMessages.schedule.dayOfMonth")}</Label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={monthDay}
                  onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  className="rounded-md border border-white/10 bg-[#15151f] text-white px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              {t("serverMessages.modalCancel")}
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              {t("serverMessages.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Date → "YYYY-MM-DDTHH:MM" in the local timezone (datetime-local format). */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 'HH:MM' UTC → local 'HH:MM' (inverse of localHHMMToUtc). */
function utcTimeToLocal(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const d = new Date()
  d.setUTCHours(h, m, 0, 0)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** Local 'HH:MM' → UTC 'HH:MM' (backend stores UTC). */
function localHHMMToUtc(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
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
  const [reposting, setReposting] = useState(false)

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
              <Button size="sm" variant="outline" onClick={() => setReposting(true)}>
                <Send className="h-3 w-3 mr-1" />
                {t("serverMessages.repost.cta")}
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

      {reposting && (
        <RepostMessageModal
          guildId={guildId}
          message={message}
          channels={channels}
          onClose={() => setReposting(false)}
          onDone={() => {
            setReposting(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

/**
 * Re-post a published template (TZ §2, ProBot-style): pick any channel and
 * either send immediately, schedule a one-off, or set up a recurring autopost.
 * Content is taken from the saved snapshot — save edits first, then repost.
 */
function RepostMessageModal({
  guildId,
  message,
  channels,
  onClose,
  onDone,
}: {
  guildId: string
  message: GuildMessage
  channels: Channel[]
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { premium } = usePremium()
  const openPremiumModal = usePremiumModal()
  const [channelId, setChannelId] = useState(message.discordChannelId)
  const [mode, setMode] = useState<"now" | "later" | "recurring">("now")
  const [runAtLocal, setRunAtLocal] = useState("")
  const [recKind, setRecKind] = useState<"daily" | "weekly" | "monthly">("daily")
  const [timeLocal, setTimeLocal] = useState("12:00")
  const [weekDays, setWeekDays] = useState<number[]>([])
  const [monthDay, setMonthDay] = useState(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)

  function pickMode(next: "now" | "later" | "recurring") {
    if (next !== "now" && !premium) {
      openPremiumModal()
      return
    }
    setMode(next)
  }

  async function submit() {
    setErr(null)
    if (!channelId) {
      setErr(t("serverMessages.errors.pickChannel"))
      return
    }
    setBusy(true)
    try {
      if (mode === "now") {
        await resendGuildMessage(guildId, message.id, channelId)
      } else if (mode === "later") {
        await createScheduledPost(guildId, {
          channelId,
          content: message.content ?? null,
          embedJson: message.embedJson ?? null,
          kind: "once",
          runAt: new Date(runAtLocal).toISOString(),
        })
      } else {
        await createScheduledPost(guildId, {
          channelId,
          content: message.content ?? null,
          embedJson: message.embedJson ?? null,
          kind: recKind,
          timeOfDay: localHHMMToUtc(timeLocal),
          ...(recKind === "weekly" ? { daysOfWeek: weekDays } : {}),
          ...(recKind === "monthly" ? { dayOfMonth: monthDay } : {}),
        })
      }
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("serverMessages.errors.createFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0e0e18] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <h2 className="text-base font-semibold text-white">{t("serverMessages.repost.title")}</h2>
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

          <div className="flex gap-2 flex-wrap">
            {(
              [
                { v: "now" as const, label: t("serverMessages.schedule.publishNow") },
                { v: "later" as const, label: t("serverMessages.schedule.later") },
                { v: "recurring" as const, label: t("serverMessages.schedule.recurring") },
              ]
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => pickMode(opt.v)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5",
                  mode === opt.v
                    ? "border-violet-500 bg-violet-500/15 text-white"
                    : "border-white/10 text-white/60 hover:bg-white/[0.04]",
                )}
              >
                {opt.label}
                {opt.v !== "now" && !premium && <PremiumChip />}
              </button>
            ))}
          </div>

          {mode === "later" && (
            <div className="grid gap-1.5 max-w-[280px]">
              <Label className="text-xs">{t("serverMessages.schedule.runAt")}</Label>
              <input
                type="datetime-local"
                value={runAtLocal}
                onChange={(e) => setRunAtLocal(e.target.value)}
                className="rounded-md border border-white/10 bg-[#15151f] text-white px-3 py-2 text-sm [color-scheme:dark]"
              />
            </div>
          )}

          {mode === "recurring" && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { v: "daily" as const, label: t("serverMessages.schedule.daily") },
                    { v: "weekly" as const, label: t("serverMessages.schedule.weekly") },
                    { v: "monthly" as const, label: t("serverMessages.schedule.monthly") },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setRecKind(opt.v)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      recKind === opt.v
                        ? "border-violet-500 bg-violet-500/15 text-white"
                        : "border-white/10 text-white/60 hover:bg-white/[0.04]",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-1.5 max-w-[180px]">
                <Label className="text-xs">{t("serverMessages.schedule.timeOfDay")}</Label>
                <input
                  type="time"
                  value={timeLocal}
                  onChange={(e) => setTimeLocal(e.target.value)}
                  className="rounded-md border border-white/10 bg-[#15151f] text-white px-3 py-2 text-sm [color-scheme:dark]"
                />
              </div>
              {recKind === "weekly" && (
                <div className="flex gap-1.5 flex-wrap">
                  {(t("serverMessages.schedule.days", { returnObjects: true }) as string[]).map(
                    (day, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setWeekDays((prev) =>
                            prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx],
                          )
                        }
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs border",
                          weekDays.includes(idx)
                            ? "border-violet-500 bg-violet-500/15 text-white"
                            : "border-white/10 text-white/60 hover:bg-white/[0.04]",
                        )}
                      >
                        {day}
                      </button>
                    ),
                  )}
                </div>
              )}
              {recKind === "monthly" && (
                <div className="grid gap-1.5 max-w-[120px]">
                  <Label className="text-xs">{t("serverMessages.schedule.dayOfMonth")}</Label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={monthDay}
                    onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                    className="rounded-md border border-white/10 bg-[#15151f] text-white px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("serverMessages.modalCancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              {mode === "now"
                ? t("serverMessages.repost.sendNow")
                : t("serverMessages.repost.schedule")}
            </Button>
          </div>
        </div>
      </div>
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
  const { premium } = usePremium()
  const openPremiumModal = usePremiumModal()
  const [tab, setTab] = useState<Tab>("text")
  const [channelId, setChannelId] = useState<string>("")
  const [content, setContent] = useState("")
  const [embedForm, setEmbedForm] = useState<EmbedFormState>(() => emptyEmbedForm())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Schedule block (TZ v2.1 §2): "now" is free; later/recurring are Premium.
  const [scheduleMode, setScheduleMode] = useState<"now" | "later" | "recurring">("now")
  const [runAtLocal, setRunAtLocal] = useState("")
  const [recKind, setRecKind] = useState<"daily" | "weekly" | "monthly">("daily")
  const [timeLocal, setTimeLocal] = useState("12:00")
  const [weekDays, setWeekDays] = useState<number[]>([])
  const [monthDay, setMonthDay] = useState(1)

  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)

  function pickScheduleMode(mode: "now" | "later" | "recurring") {
    if (mode !== "now" && !premium) {
      openPremiumModal()
      return
    }
    setScheduleMode(mode)
  }

  /** Convert a local 'HH:MM' to UTC 'HH:MM' (backend stores UTC). */
  function localTimeToUtc(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
  }

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
      if (scheduleMode === "now") {
        await createGuildMessage(guildId, {
          discordChannelId: channelId,
          content: rawContent.trim() || null,
          embedJson: embedRaw,
        })
      } else if (scheduleMode === "later") {
        // datetime-local is in the admin's local tz; Date() converts to UTC ISO.
        await createScheduledPost(guildId, {
          channelId,
          content: rawContent.trim() || null,
          embedJson: embedRaw,
          kind: "once",
          runAt: new Date(runAtLocal).toISOString(),
        })
      } else {
        await createScheduledPost(guildId, {
          channelId,
          content: rawContent.trim() || null,
          embedJson: embedRaw,
          kind: recKind,
          timeOfDay: localTimeToUtc(timeLocal),
          ...(recKind === "weekly" ? { daysOfWeek: weekDays } : {}),
          ...(recKind === "monthly" ? { dayOfMonth: monthDay } : {}),
        })
      }
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

          {/* Schedule block (TZ v2.1 §2). Visible to everyone; later/recurring
              options are Premium — clicking them on free opens the modal. */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white">{t("serverMessages.schedule.title")}</p>
              {!premium && <PremiumChip />}
            </div>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { v: "now" as const, label: t("serverMessages.schedule.publishNow") },
                  { v: "later" as const, label: t("serverMessages.schedule.later") },
                  { v: "recurring" as const, label: t("serverMessages.schedule.recurring") },
                ]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => pickScheduleMode(opt.v)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    scheduleMode === opt.v
                      ? "border-violet-500 bg-violet-500/15 text-white"
                      : "border-white/10 text-white/60 hover:bg-white/[0.04]",
                    opt.v !== "now" && !premium && "opacity-60",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {scheduleMode === "later" && (
              <div className="grid gap-1.5">
                <Label className="text-xs">{t("serverMessages.schedule.runAt")}</Label>
                <input
                  type="datetime-local"
                  value={runAtLocal}
                  onChange={(e) => setRunAtLocal(e.target.value)}
                  className="rounded-md border border-white/10 bg-[#15151f] text-white px-3 py-2 text-sm [color-scheme:dark]"
                />
              </div>
            )}

            {scheduleMode === "recurring" && (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      { v: "daily" as const, label: t("serverMessages.schedule.daily") },
                      { v: "weekly" as const, label: t("serverMessages.schedule.weekly") },
                      { v: "monthly" as const, label: t("serverMessages.schedule.monthly") },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setRecKind(opt.v)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        recKind === opt.v
                          ? "border-violet-500 bg-violet-500/15 text-white"
                          : "border-white/10 text-white/60 hover:bg-white/[0.04]",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-1.5 max-w-[180px]">
                  <Label className="text-xs">{t("serverMessages.schedule.timeOfDay")}</Label>
                  <input
                    type="time"
                    value={timeLocal}
                    onChange={(e) => setTimeLocal(e.target.value)}
                    className="rounded-md border border-white/10 bg-[#15151f] text-white px-3 py-2 text-sm [color-scheme:dark]"
                  />
                </div>
                {recKind === "weekly" && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t("serverMessages.schedule.daysOfWeek")}</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {(t("serverMessages.schedule.days", { returnObjects: true }) as string[]).map(
                        (day, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setWeekDays((prev) =>
                                prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx],
                              )
                            }
                            className={cn(
                              "px-2.5 py-1 rounded-md text-xs border",
                              weekDays.includes(idx)
                                ? "border-violet-500 bg-violet-500/15 text-white"
                                : "border-white/10 text-white/60 hover:bg-white/[0.04]",
                            )}
                          >
                            {day}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}
                {recKind === "monthly" && (
                  <div className="grid gap-1.5 max-w-[120px]">
                    <Label className="text-xs">{t("serverMessages.schedule.dayOfMonth")}</Label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={monthDay}
                      onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                      className="rounded-md border border-white/10 bg-[#15151f] text-white px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

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
