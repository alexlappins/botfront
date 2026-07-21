import { useEffect, useMemo, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Paintbrush,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Twitch,
} from "lucide-react"
import {
  ApiError,
  addTwitchSubscription,
  getChannels,
  getTwitchSubscriptions,
  removeTwitchSubscription,
  toggleTwitchModule,
  updateTwitchSubscription,
  type Channel,
  type TwitchListResponse,
  type TwitchSubscription,
} from "@/lib/api"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import {
  EventAlertsTab,
  LiveRoleTab,
  ScheduleSyncTab,
  TwitchConnectTab,
} from "@/pages/guild/twitch-features-tabs"
import { usePremium } from "@/contexts/premium-context"
import { PremiumChip, usePremiumModal } from "@/components/premium"
import { cn } from "@/lib/utils"

/** Sample variable values used in the inline preview. Same keys the backend
 *  substitutes for real notifications. */
const PREVIEW_VARS: Record<string, string> = {
  streamer: "SampleStreamer",
  title: "Just chatting & some Valorant",
  game: "VALORANT",
  url: "https://twitch.tv/samplestreamer",
  viewers: "1234",
  started_at: new Date().toISOString(),
}

/** Variable placeholders are bot-runtime constants; only the description
 *  (looked up via i18n key) is translatable. */
const VARIABLE_HINTS: { key: string; i18nKey: string }[] = [
  { key: "{streamer}", i18nKey: "streamer" },
  { key: "{title}", i18nKey: "title" },
  { key: "{game}", i18nKey: "game" },
  { key: "{url}", i18nKey: "url" },
  { key: "{viewers}", i18nKey: "viewers" },
  { key: "{started_at}", i18nKey: "started_at" },
]

const DEFAULT_TITLE_TPL = "{streamer} is live on Twitch!"
const DEFAULT_DESC_TPL = "**{title}**"
const DEFAULT_BUTTON_LABEL = "Watch on Twitch"
const TWITCH_PURPLE = "#9146FF"

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  if (!tpl) return ""
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`))
}

/** Discord text-channel types we can send messages into. */
function isTextChannel(c: Channel): boolean {
  return c.type === 0 || c.type === 5
}

export function TwitchPage() {
  const [featureTab, setFeatureTab] = useState<"channels" | "connect" | "liveRole" | "alerts" | "schedule">("channels")
  const guildId = useCurrentGuildId()
  const { t } = useTranslation()
  const [state, setState] = useState<TwitchListResponse | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!guildId) return
    setLoading(true)
    setError(null)
    try {
      const [resp, ch] = await Promise.all([getTwitchSubscriptions(guildId), getChannels(guildId)])
      setState(resp)
      setChannels(ch)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setError(t("common.noAccess"))
      } else {
        setError(e instanceof Error ? e.message : t("twitch.loadError"))
      }
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
        <p className="text-white/60">{t("common.selectServer")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Twitch className="h-7 w-7 text-violet-400" />
          {t("twitch.title")}
        </h1>
        <p className="text-sm text-white/50 mt-1">
          <Trans i18nKey="twitch.sub" components={{ code: <code className="text-white/70" /> }} />
        </p>
      </div>

      {/* Twitch Suite tabs (TZ-A/TZ-B) */}
      <div className="flex items-center gap-1 border-b border-white/5 overflow-x-auto">
        {(["channels", "connect", "liveRole", "alerts", "schedule"] as const).map((tk) => (
          <button
            key={tk}
            type="button"
            onClick={() => setFeatureTab(tk)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              featureTab === tk
                ? "border-violet-500 text-white"
                : "border-transparent text-white/50 hover:text-white/80",
            )}
          >
            {t(`twitchFeat.tabs.${tk}`)}
          </button>
        ))}
      </div>

      {featureTab === "connect" && <TwitchConnectTab guildId={guildId} />}
      {featureTab === "liveRole" && <LiveRoleTab guildId={guildId} />}
      {featureTab === "alerts" && <EventAlertsTab guildId={guildId} />}
      {featureTab === "schedule" && <ScheduleSyncTab guildId={guildId} />}

      {featureTab === "channels" && (
      <>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {!loading && !error && state && (
        <>
          {!state.configured && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>
                <Trans i18nKey="twitch.notConfigured" components={{ code: <code /> }} />
              </span>
            </div>
          )}

          <ModuleToggle
            guildId={guildId}
            enabled={state.moduleEnabled}
            hasAny={state.subscriptions.length > 0}
            onChanged={load}
          />

          <AddForm
            guildId={guildId}
            channels={channels}
            limit={state.limit}
            used={state.subscriptions.length}
            disabled={!state.configured}
            onAdded={load}
          />

          <SubscriptionList
            guildId={guildId}
            subscriptions={state.subscriptions}
            channels={channels}
            onChanged={load}
          />
        </>
      )}
      </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────

function ModuleToggle({
  guildId,
  enabled,
  hasAny,
  onChanged,
}: {
  guildId: string
  enabled: boolean
  hasAny: boolean
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  async function toggle() {
    setBusy(true)
    try {
      await toggleTwitchModule(guildId, !enabled)
      onChanged()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-white">{t("twitch.module.title")}</p>
        <p className="text-xs text-white/50 mt-0.5">
          {enabled
            ? t("twitch.module.onSub")
            : hasAny
              ? t("twitch.module.offSub")
              : t("twitch.module.emptySub")}
        </p>
      </div>
      <button
        type="button"
        disabled={busy || !hasAny}
        onClick={toggle}
        title={!hasAny ? t("twitch.module.addFirstTip") : ""}
        className={cn(
          "shrink-0 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium",
          enabled
            ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
            : "border-white/10 bg-white/[0.03] text-white/60",
          (busy || !hasAny) && "opacity-50 cursor-not-allowed",
        )}
      >
        <span className={cn("relative inline-flex w-7 h-4 rounded-full transition-colors", enabled ? "bg-violet-500" : "bg-white/20")}>
          <span className={cn("absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform", enabled && "translate-x-3")} />
        </span>
        {busy ? "…" : enabled ? t("twitch.module.on") : t("twitch.module.off")}
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────

function AddForm({
  guildId,
  channels,
  limit,
  used,
  disabled,
  onAdded,
}: {
  guildId: string
  channels: Channel[]
  limit: number
  used: number
  disabled: boolean
  onAdded: () => void
}) {
  const { t } = useTranslation()
  const [username, setUsername] = useState("")
  const [channelId, setChannelId] = useState<string>("")
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const textChannels = useMemo(() => channels.filter(isTextChannel), [channels])
  const { premium } = usePremium()
  const openPremiumModal = usePremiumModal()
  // Free plan tracks 1 channel (TZ v2.1 §7); premium uses the server limit.
  const effectiveLimit = premium ? limit : Math.min(limit, 1)
  const limitReached = used >= effectiveLimit
  const premiumLocked = !premium && used >= 1

  async function submit() {
    setErr(null)
    if (!username.trim()) {
      setErr(t("twitch.add.errors.username"))
      return
    }
    if (!channelId) {
      setErr(t("twitch.add.errors.channel"))
      return
    }
    setAdding(true)
    try {
      await addTwitchSubscription(guildId, {
        username: username.trim(),
        discordChannelId: channelId,
      })
      setUsername("")
      setChannelId("")
      onAdded()
    } catch (e) {
      // The backend returns user-friendly messages already; we fall back to a
      // generic localised string only if the error isn't a typed ApiError.
      setErr(e instanceof Error ? e.message : t("twitch.add.errors.generic"))
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          {t("twitch.add.title")}
          {premiumLocked && <PremiumChip />}
        </h2>
        <span className={cn("text-[11px]", limitReached ? "text-amber-400" : "text-white/40")}>
          {t("twitch.add.slots", { used, limit: effectiveLimit })}
        </span>
      </div>
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
        <div>
          <label className="text-[11px] text-white/60 block mb-1">{t("twitch.add.username")}</label>
          <input
            type="text"
            value={username}
            placeholder={t("twitch.add.usernamePlaceholder")}
            disabled={disabled || limitReached || adding}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit()
            }}
            className="w-full rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-[11px] text-white/60 block mb-1">{t("twitch.add.channel")}</label>
          <select
            value={channelId}
            disabled={disabled || limitReached || adding}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60 disabled:opacity-50"
          >
            <option value="">{t("twitch.add.channelPlaceholder")}</option>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => (premiumLocked ? openPremiumModal() : void submit())}
            disabled={disabled || adding || (limitReached && !premiumLocked)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 h-[38px]"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("twitch.add.submit")}
          </button>
        </div>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      {limitReached && !err && !premiumLocked && (
        <p className="text-xs text-amber-400">{t("twitch.add.errors.limitReached")}</p>
      )}
    </section>
  )
}

// ────────────────────────────────────────────────────────────

function SubscriptionList({
  guildId,
  subscriptions,
  channels,
  onChanged,
}: {
  guildId: string
  subscriptions: TwitchSubscription[]
  channels: Channel[]
  onChanged: () => void
}) {
  const { t } = useTranslation()
  if (subscriptions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-white/50">{t("twitch.list.empty")}</p>
      </div>
    )
  }
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{t("twitch.list.title")}</h2>
        <button
          type="button"
          onClick={onChanged}
          className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white"
          title={t("twitch.list.refreshTip")}
        >
          <RefreshCw className="h-3 w-3" /> {t("twitch.list.refresh")}
        </button>
      </div>
      <div className="space-y-2">
        {subscriptions.map((s) => (
          <SubscriptionRow
            key={s.id}
            guildId={guildId}
            sub={s}
            channels={channels}
            onChanged={onChanged}
          />
        ))}
      </div>
    </section>
  )
}

function SubscriptionRow({
  guildId,
  sub,
  channels,
  onChanged,
}: {
  guildId: string
  sub: TwitchSubscription
  channels: Channel[]
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<"enable" | "channel" | "remove" | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const textChannels = useMemo(() => channels.filter(isTextChannel), [channels])

  async function changeChannel(next: string) {
    if (!next || next === sub.discordChannelId) return
    setBusy("channel")
    try {
      await updateTwitchSubscription(guildId, sub.id, { discordChannelId: next })
      onChanged()
    } finally {
      setBusy(null)
    }
  }
  async function toggleEnabled() {
    setBusy("enable")
    try {
      await updateTwitchSubscription(guildId, sub.id, { enabled: !sub.enabled })
      onChanged()
    } finally {
      setBusy(null)
    }
  }
  async function remove() {
    if (!confirm(t("twitch.list.confirmRemove", { name: sub.platformUsername }))) return
    setBusy("remove")
    try {
      await removeTwitchSubscription(guildId, sub.id)
      onChanged()
    } finally {
      setBusy(null)
    }
  }

  const live = sub.isLive && sub.enabled
  return (
    <div className="rounded-lg border border-white/10 bg-[#0e0e18] overflow-hidden">
      <div className="p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 min-w-[140px]">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
              live ? "bg-red-500/20 text-red-300" : "bg-white/5 text-white/50",
            )}
            title={live ? t("twitch.list.liveTip") : t("twitch.list.offlineTip")}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", live ? "bg-red-400 animate-pulse" : "bg-white/30")} />
            {live ? t("twitch.list.live") : t("twitch.list.offline")}
          </span>
          <a
            href={`https://twitch.tv/${sub.platformUsername.toLowerCase()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-white hover:text-violet-300 truncate"
          >
            {sub.platformUsername}
          </a>
        </div>

        <div className="flex-1 min-w-[180px]">
          <select
            value={sub.discordChannelId}
            disabled={busy !== null}
            onChange={(e) => changeChannel(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-[#15151f] px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-500/60"
          >
            {!textChannels.some((c) => c.id === sub.discordChannelId) && (
              <option value={sub.discordChannelId}>{t("twitch.list.channelMissing", { id: sub.discordChannelId })}</option>
            )}
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setEditorOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] px-2.5 py-1 text-[11px] text-white/70"
          title={t("twitch.list.appearanceTip")}
        >
          <Paintbrush className="h-3 w-3" />
          {t("twitch.list.appearance")}
          <ChevronDown className={cn("h-3 w-3 transition-transform", editorOpen && "rotate-180")} />
        </button>

        <button
          type="button"
          onClick={toggleEnabled}
          disabled={busy !== null}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px]",
            sub.enabled
              ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
              : "border-white/10 bg-white/[0.03] text-white/60",
          )}
          title={sub.enabled ? t("twitch.list.disableTip") : t("twitch.list.enableTip")}
        >
          <span className={cn("relative inline-flex w-6 h-3.5 rounded-full transition-colors", sub.enabled ? "bg-violet-500" : "bg-white/20")}>
            <span className={cn("absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform", sub.enabled && "translate-x-2.5")} />
          </span>
          {busy === "enable" ? "…" : sub.enabled ? t("twitch.list.perRowOn") : t("twitch.list.perRowOff")}
        </button>

        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 text-white/40 hover:text-red-400 disabled:opacity-50"
          title={t("twitch.list.removeTip")}
        >
          {busy === "remove" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>

      {editorOpen && (
        <EmbedEditor guildId={guildId} sub={sub} onSaved={onChanged} />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Embed editor + live preview
// ────────────────────────────────────────────────────────────

interface EditorState {
  color: string
  titleTemplate: string
  descriptionTemplate: string
  buttonLabel: string
  contentTemplate: string
  showGame: boolean
  showThumbnail: boolean
  showStreamerAvatar: boolean
}

function configToState(sub: TwitchSubscription): EditorState {
  const cfg = sub.embedConfig ?? {}
  return {
    color: cfg.color ?? "",
    titleTemplate: cfg.titleTemplate ?? "",
    descriptionTemplate: cfg.descriptionTemplate ?? "",
    buttonLabel: cfg.buttonLabel ?? "",
    contentTemplate: sub.contentTemplate ?? cfg.contentTemplate ?? "",
    showGame: cfg.showGame !== false,
    showThumbnail: cfg.showThumbnail !== false,
    showStreamerAvatar: cfg.showStreamerAvatar !== false,
  }
}

function EmbedEditor({
  guildId,
  sub,
  onSaved,
}: {
  guildId: string
  sub: TwitchSubscription
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const initial = useMemo(() => configToState(sub), [sub])
  const [s, setS] = useState<EditorState>(initial)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const dirty =
    s.color !== initial.color ||
    s.titleTemplate !== initial.titleTemplate ||
    s.descriptionTemplate !== initial.descriptionTemplate ||
    s.buttonLabel !== initial.buttonLabel ||
    s.contentTemplate !== initial.contentTemplate ||
    s.showGame !== initial.showGame ||
    s.showThumbnail !== initial.showThumbnail ||
    s.showStreamerAvatar !== initial.showStreamerAvatar

  function setFlashAuto(kind: "ok" | "err", text: string) {
    setFlash({ kind, text })
    setTimeout(() => setFlash(null), 2500)
  }

  async function save() {
    setSaving(true)
    try {
      await updateTwitchSubscription(guildId, sub.id, {
        contentTemplate: s.contentTemplate.trim() || null,
        embedConfig: {
          color: s.color.trim() || undefined,
          titleTemplate: s.titleTemplate.trim() || undefined,
          descriptionTemplate: s.descriptionTemplate.trim() || undefined,
          buttonLabel: s.buttonLabel.trim() || undefined,
          showGame: s.showGame,
          showThumbnail: s.showThumbnail,
          showStreamerAvatar: s.showStreamerAvatar,
        },
      })
      setFlashAuto("ok", t("twitch.editor.saved"))
      onSaved()
    } catch (e) {
      setFlashAuto("err", e instanceof Error ? e.message : t("twitch.editor.saveError"))
    } finally {
      setSaving(false)
    }
  }

  function resetToDefaults() {
    setS({
      color: "",
      titleTemplate: "",
      descriptionTemplate: "",
      buttonLabel: "",
      contentTemplate: "",
      showGame: true,
      showThumbnail: true,
      showStreamerAvatar: true,
    })
  }

  return (
    <div className="border-t border-white/5 bg-[#0a0a12] p-4 grid lg:grid-cols-2 gap-4">
      {/* Form */}
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-medium text-white/65 mb-1">{t("twitch.editor.variables")}</p>
          <div className="flex flex-wrap gap-1">
            {VARIABLE_HINTS.map((v) => (
              <span
                key={v.key}
                title={t(`twitch.variables.${v.i18nKey}`)}
                className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-mono text-white/65"
              >
                {v.key}
              </span>
            ))}
          </div>
        </div>

        <Field label={t("twitch.editor.color")}>
          <div className="flex gap-2">
            <input
              type="color"
              value={s.color && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : TWITCH_PURPLE}
              onChange={(e) => setS({ ...s, color: e.target.value })}
              className="h-9 w-12 rounded-md border border-white/10 bg-transparent cursor-pointer"
            />
            <input
              type="text"
              value={s.color}
              placeholder={TWITCH_PURPLE}
              onChange={(e) => setS({ ...s, color: e.target.value })}
              className="flex-1 rounded-md border border-white/10 bg-[#0e0e18] px-2.5 py-1.5 text-xs font-mono text-white outline-none focus:border-violet-500/60"
            />
          </div>
        </Field>

        <Field label={t("twitch.editor.titleField")} hint={t("twitch.editor.titleHint", { tpl: DEFAULT_TITLE_TPL })}>
          <input
            type="text"
            value={s.titleTemplate}
            placeholder={DEFAULT_TITLE_TPL}
            maxLength={256}
            onChange={(e) => setS({ ...s, titleTemplate: e.target.value })}
            className="w-full rounded-md border border-white/10 bg-[#0e0e18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-500/60"
          />
        </Field>

        <Field label={t("twitch.editor.description")} hint={t("twitch.editor.descriptionHint", { tpl: DEFAULT_DESC_TPL })}>
          <textarea
            value={s.descriptionTemplate}
            rows={3}
            placeholder={DEFAULT_DESC_TPL}
            maxLength={4096}
            onChange={(e) => setS({ ...s, descriptionTemplate: e.target.value })}
            className="w-full rounded-md border border-white/10 bg-[#0e0e18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-500/60 resize-y"
          />
        </Field>

        <Field label={t("twitch.editor.buttonLabel")}>
          <input
            type="text"
            value={s.buttonLabel}
            placeholder={DEFAULT_BUTTON_LABEL}
            maxLength={80}
            onChange={(e) => setS({ ...s, buttonLabel: e.target.value })}
            className="w-full rounded-md border border-white/10 bg-[#0e0e18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-500/60"
          />
        </Field>

        <Field
          label={t("twitch.editor.contentField")}
          hint={t("twitch.editor.contentHint")}
        >
          <textarea
            value={s.contentTemplate}
            rows={2}
            placeholder={t("twitch.editor.contentPlaceholder")}
            maxLength={2000}
            onChange={(e) => setS({ ...s, contentTemplate: e.target.value })}
            className="w-full rounded-md border border-white/10 bg-[#0e0e18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-500/60 resize-y"
          />
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <SmallToggle label={t("twitch.editor.showGame")} checked={s.showGame} onChange={(v) => setS({ ...s, showGame: v })} />
          <SmallToggle label={t("twitch.editor.showThumbnail")} checked={s.showThumbnail} onChange={(v) => setS({ ...s, showThumbnail: v })} />
          <SmallToggle label={t("twitch.editor.showAvatar")} checked={s.showStreamerAvatar} onChange={(v) => setS({ ...s, showStreamerAvatar: v })} />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={resetToDefaults}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/[0.06]"
          >
            <RotateCcw className="h-3 w-3" /> {t("twitch.editor.reset")}
          </button>
          <div className="flex-1" />
          {flash && (
            <span className={cn("text-[11px]", flash.kind === "ok" ? "text-emerald-400" : "text-red-400")}>
              {flash.text}
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              dirty && !saving
                ? "bg-violet-600 hover:bg-violet-500 text-white"
                : "bg-white/5 text-white/40 cursor-not-allowed",
            )}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {t("twitch.editor.save")}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div>
        <p className="text-[11px] text-white/45 mb-2">{t("twitch.editor.previewLabel")}</p>
        <EmbedPreview state={s} />
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-white/65">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-white/40">{hint}</span>}
    </label>
  )
}

function SmallToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors",
        checked ? "border-violet-500/40 bg-violet-500/10 text-violet-200" : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]",
      )}
    >
      <span className={cn("relative inline-flex w-7 h-3.5 rounded-full shrink-0", checked ? "bg-violet-500" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform", checked && "translate-x-3.5")} />
      </span>
      {label}
    </button>
  )
}

/**
 * Static CSS approximation of the Discord embed the bot will send.
 * Doesn't render the live Twitch thumbnail (no real stream id at edit time);
 * shows a placeholder gradient so the admin can verify layout + colour choice.
 */
function EmbedPreview({ state }: { state: EditorState }) {
  const color =
    state.color && /^#[0-9a-f]{6}$/i.test(state.color) ? state.color : TWITCH_PURPLE
  const title = renderTemplate(state.titleTemplate || DEFAULT_TITLE_TPL, PREVIEW_VARS)
  const desc = renderTemplate(state.descriptionTemplate || DEFAULT_DESC_TPL, PREVIEW_VARS)
  const content = renderTemplate(state.contentTemplate, PREVIEW_VARS)
  const buttonLabel = state.buttonLabel.trim() || DEFAULT_BUTTON_LABEL

  return (
    <div className="rounded-lg bg-[#313338] p-3 text-sm font-sans">
      {/* Bot author line */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
        <span className="text-white text-[13px] font-semibold">Bot</span>
        <span className="text-white/40 text-[10px]">Today at 12:34</span>
      </div>

      {content && (
        <p className="text-white/85 text-[13px] mb-1.5 whitespace-pre-wrap break-words">{content}</p>
      )}

      <div className="relative rounded bg-[#2b2d31] border-l-[4px] pl-3 pr-2 py-2 max-w-[440px]" style={{ borderLeftColor: color }}>
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            {state.showStreamerAvatar && (
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
                <span className="text-white/85 text-[12px] font-semibold">{PREVIEW_VARS.streamer}</span>
              </div>
            )}
            <p className="text-white font-semibold text-[14px] leading-tight">{title}</p>
            {desc && (
              <p
                className="text-white/85 text-[13px] mt-1 leading-snug whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(desc) }}
              />
            )}
            <div className="flex flex-wrap gap-3 mt-2">
              {state.showGame && PREVIEW_VARS.game && (
                <div>
                  <p className="text-white text-[11px] font-semibold leading-tight">Playing</p>
                  <p className="text-white/70 text-[11px]">{PREVIEW_VARS.game}</p>
                </div>
              )}
              {PREVIEW_VARS.viewers && Number(PREVIEW_VARS.viewers) > 0 && (
                <div>
                  <p className="text-white text-[11px] font-semibold leading-tight">Viewers</p>
                  <p className="text-white/70 text-[11px]">{PREVIEW_VARS.viewers}</p>
                </div>
              )}
            </div>
            {state.showThumbnail && (
              <div className="mt-2 h-24 rounded bg-gradient-to-br from-violet-700 via-fuchsia-700 to-pink-600 flex items-center justify-center text-[10px] text-white/50">
                stream thumbnail placeholder
              </div>
            )}
            <p className="text-white/40 text-[10px] mt-1.5">Twitch</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="mt-1 inline-flex items-center gap-1 rounded bg-[#4e5058] hover:bg-[#5d5f66] px-3 py-1 text-[12px] text-white"
        disabled
      >
        {buttonLabel}
      </button>
    </div>
  )
}

/** Very small subset of Discord markdown for the preview: **bold**, *italic*,
 *  `code`. Not security-hardened — `dangerouslySetInnerHTML` is fed only this
 *  function's output, never user HTML, but we still HTML-escape first. */
function simpleMarkdownToHtml(s: string): string {
  const esc = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  return esc
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code style='background:rgba(255,255,255,0.08);padding:0 4px;border-radius:3px'>$1</code>")
}

