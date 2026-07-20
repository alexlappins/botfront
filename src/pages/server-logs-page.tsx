import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ApiError,
  getAlertSettings,
  getChannels,
  getLogPresetSettings,
  searchGuildMembers,
  updateAlertSettings,
  updateLogPresetSettings,
  LOG_PRESET_KEYS,
  type AlertSettingsWire,
  type Channel,
  type DetectorKey,
  type GuildMemberHit,
  type LogPresetSettings,
} from "@/lib/api"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { PremiumGate } from "@/components/premium"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, BellRing, Loader2, ScrollText, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

const DETECTORS: DetectorKey[] = ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9"]

/**
 * Server Logs 2.0 (Misha's TZ): 7 preset cards with per-preset channel,
 * single-channel mode, Audit Log warning — plus the premium "Alerts" tab
 * (watchdog recipients + 9 detector toggles).
 */
export function ServerLogsPage() {
  const { t } = useTranslation()
  const guildId = useCurrentGuildId()
  const [tab, setTab] = useState<"logs" | "alerts">("logs")
  const [channels, setChannels] = useState<Channel[]>([])
  const [settings, setSettings] = useState<LogPresetSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!guildId) return
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([
      getChannels(guildId).catch(() => [] as Channel[]),
      getLogPresetSettings(guildId),
    ])
      .then(([c, s]) => {
        if (!alive) return
        setChannels(c)
        setSettings(s)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setError(t("common.noAccess"))
        else setError(e instanceof Error ? e.message : "Loading error")
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [guildId, t])

  if (!guildId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <p className="text-white/60">{t("common.selectServer")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ScrollText className="h-7 w-7 text-violet-400" />
          {t("serverLogs.title")}
        </h1>
        <p className="text-sm text-white/50 mt-1">{t("serverLogs.sub")}</p>
      </div>

      <div className="flex items-center gap-2 border-b border-white/5">
        {(["logs", "alerts"] as const).map((tk) => (
          <button
            key={tk}
            type="button"
            onClick={() => setTab(tk)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-2",
              tab === tk ? "border-violet-500 text-white" : "border-transparent text-white/50 hover:text-white/80",
            )}
          >
            {tk === "alerts" && <BellRing className="h-4 w-4" />}
            {t(`serverLogs.tabs.${tk}`)}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      )}
      {error && !loading && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {!loading && !error && settings && tab === "logs" && (
        <PresetsTab guildId={guildId} channels={channels} settings={settings} onChange={setSettings} />
      )}
      {!loading && !error && tab === "alerts" && (
        <PremiumGate>
          <AlertsTab guildId={guildId} />
        </PremiumGate>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Logs tab: 7 preset cards + single-channel mode
// ─────────────────────────────────────────────────────────

function PresetsTab({
  guildId,
  channels,
  settings,
  onChange,
}: {
  guildId: string
  channels: Channel[]
  settings: LogPresetSettings
  onChange: (s: LogPresetSettings) => void
}) {
  const { t } = useTranslation()
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)

  async function save(patch: Parameters<typeof updateLogPresetSettings>[1], key: string) {
    setSavingKey(key)
    try {
      const next = await updateLogPresetSettings(guildId, patch)
      onChange({ ...next, auditLogAccess: settings.auditLogAccess })
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="space-y-4">
      {settings.auditLogAccess === false && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{t("serverLogs.auditWarnTitle")}</p>
            <p className="text-amber-200/70 text-xs mt-0.5">{t("serverLogs.auditWarnBody")}</p>
          </div>
        </div>
      )}

      {/* Single channel mode (TZ §2) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-wrap items-center gap-4">
        <Toggle
          checked={settings.singleChannelMode}
          busy={savingKey === "single"}
          onChange={(v) => void save({ singleChannelMode: v }, "single")}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{t("serverLogs.singleTitle")}</p>
          <p className="text-xs text-white/45">{t("serverLogs.singleDesc")}</p>
        </div>
        {settings.singleChannelMode && (
          <ChannelSelect
            channels={textChannels}
            value={settings.singleChannelId}
            onChange={(id) => void save({ singleChannelId: id }, "single-ch")}
          />
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {LOG_PRESET_KEYS.map((preset) => {
          const p = settings.presets[preset]
          return (
            <div key={preset} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Toggle
                  checked={p.enabled}
                  busy={savingKey === preset}
                  onChange={(v) => void save({ presets: { [preset]: { enabled: v } } }, preset)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{t(`serverLogs.presets.${preset}.name`)}</p>
                  <p className="text-xs text-white/45">{t(`serverLogs.presets.${preset}.desc`)}</p>
                </div>
              </div>
              {!settings.singleChannelMode && p.enabled && (
                <ChannelSelect
                  channels={textChannels}
                  value={p.channelId}
                  onChange={(id) => void save({ presets: { [preset]: { channelId: id } } }, `${preset}-ch`)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChannelSelect({
  channels,
  value,
  onChange,
}: {
  channels: Channel[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  const { t } = useTranslation()
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
      <SelectTrigger className="w-full sm:w-[240px] rounded-lg bg-white/[0.04] border-white/10">
        <SelectValue placeholder={t("serverLogs.pickChannel")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{t("serverLogs.disable")}</SelectItem>
        {channels.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            # {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Toggle({
  checked,
  onChange,
  busy,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  busy?: boolean
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex w-10 h-5.5 shrink-0 rounded-full transition-colors h-6 w-11",
        checked ? "bg-violet-500" : "bg-white/15",
        busy && "opacity-60",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  )
}

// ─────────────────────────────────────────────────────────
// Alerts tab (premium)
// ─────────────────────────────────────────────────────────

function AlertsTab({ guildId }: { guildId: string }) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AlertSettingsWire | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<GuildMemberHit[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    getAlertSettings(guildId)
      .then((s) => alive && setSettings(s))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Loading error"))
    return () => {
      alive = false
    }
  }, [guildId])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!query.trim()) {
      setHits([])
      return
    }
    searchTimer.current = setTimeout(() => {
      setSearching(true)
      searchGuildMembers(guildId, query.trim())
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setSearching(false))
    }, 300)
  }, [query, guildId])

  async function save(patch: Parameters<typeof updateAlertSettings>[1], key: string) {
    setSavingKey(key)
    setError(null)
    try {
      setSettings(await updateAlertSettings(guildId, patch))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save error")
    } finally {
      setSavingKey(null)
    }
  }

  if (error && !settings) {
    return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
  }
  if (!settings) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    )
  }

  const recipientIds = settings.recipients.map((r) => r.id)

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4">
        <Toggle
          checked={settings.enabled}
          busy={savingKey === "enabled"}
          onChange={(v) => void save({ enabled: v }, "enabled")}
        />
        <div>
          <p className="text-sm font-medium text-white">{t("serverLogs.alerts.enable")}</p>
          <p className="text-xs text-white/45">{t("serverLogs.alerts.enableDesc")}</p>
        </div>
      </div>

      {/* Recipients (owner pinned + up to 3) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <p className="text-sm font-semibold text-white">{t("serverLogs.alerts.recipients")}</p>
        <div className="flex flex-wrap gap-2">
          {settings.owner && (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300">
              👑 {settings.owner.tag ?? settings.owner.id}
              <span className="text-amber-300/50">{t("serverLogs.alerts.ownerAlways")}</span>
            </span>
          )}
          {settings.recipients.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs text-white/85"
            >
              {r.avatarUrl && <img src={r.avatarUrl} alt="" className="h-4 w-4 rounded-full" />}
              {r.tag ?? r.id}
              <button
                type="button"
                onClick={() =>
                  void save({ recipients: recipientIds.filter((id) => id !== r.id) }, "recipients")
                }
                className="text-white/40 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        {settings.recipients.length < 3 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("serverLogs.alerts.searchPlaceholder")}
              className="w-full rounded-lg border border-white/10 bg-[#0e0e18] pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-violet-500/60"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-white/30" />
            )}
            {hits.length > 0 && (
              <div className="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-[#15151f] shadow-2xl py-1 max-h-56 overflow-y-auto">
                {hits
                  .filter((h) => !recipientIds.includes(h.id) && h.id !== settings.owner?.id)
                  .map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        setQuery("")
                        setHits([])
                        void save({ recipients: [...recipientIds, h.id] }, "recipients")
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                    >
                      {h.avatarUrl && <img src={h.avatarUrl} alt="" className="h-5 w-5 rounded-full" />}
                      <span className="text-white/85">{h.displayName}</span>
                      <span className="text-white/35 text-xs">{h.tag}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detectors */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-1">
        <p className="text-sm font-semibold text-white mb-2">{t("serverLogs.alerts.detectors")}</p>
        {DETECTORS.map((d) => (
          <div key={d} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
            <Toggle
              checked={settings.detectors[d]}
              busy={savingKey === d}
              onChange={(v) => void save({ detectors: { [d]: v } }, d)}
            />
            <div className="min-w-0">
              <p className="text-sm text-white/90">
                {t(`serverLogs.alerts.${d}.name`)}{" "}
                <span className="text-xs">{["d1", "d2"].includes(d) ? "🚨" : "⚠️"}</span>
              </p>
              <p className="text-xs text-white/40">{t(`serverLogs.alerts.${d}.desc`)}</p>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
