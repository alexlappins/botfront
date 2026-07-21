import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Plus, RefreshCw, Send, Trash2, X } from "lucide-react"
import {
  ALERT_EVENT_KEYS,
  addLiveRoleBinding,
  copyCardToAll,
  createLiveRoleConfig,
  deleteLiveRoleConfig,
  disconnectTwitch,
  getEventAlerts,
  getLiveRoleState,
  getScheduleSync,
  getTwitchConnections,
  getGuildRoles,
  getChannels,
  removeLiveRoleBinding,
  scheduleSyncNow,
  searchGuildMembers,
  testEventAlert,
  twitchConnectUrl,
  updateEventAlert,
  updateLiveRoleConfig,
  updateScheduleSync,
  type Channel,
  type EventAlertRow,
  type GuildRole,
  type GuildMemberHit,
  type LiveRoleBindingRow,
  type LiveRoleConfigRow,
  type ScheduleSyncWire,
  type TwitchConnectionRow,
} from "@/lib/api"
import { ImageUploadField } from "@/components/image-upload-field"
import { usePremium } from "@/contexts/premium-context"
import { PremiumChip, PremiumGate, usePremiumModal } from "@/components/premium"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        {desc && <p className="text-xs text-white/45">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-violet-500" : "bg-white/15",
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

// ── Connect tab (TZ-A §1) ─────────────────────────────────

export function TwitchConnectTab({ guildId }: { guildId: string }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<TwitchConnectionRow[] | null>(null)

  const load = useCallback(() => {
    getTwitchConnections(guildId).then(setRows).catch(() => setRows([]))
  }, [guildId])
  useEffect(load, [load])

  return (
    <Card title={t("twitchFeat.connect.title")} desc={t("twitchFeat.connect.desc")}>
      <a
        href={twitchConnectUrl(guildId)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#9146ff] hover:bg-[#7c2df0] px-4 py-2 text-sm font-medium text-white"
      >
        {t("twitchFeat.connect.cta")}
      </a>
      {!rows ? (
        <Loader2 className="h-4 w-4 animate-spin text-white/40" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-white/45">{t("twitchFeat.connect.empty")}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm">
              <span className="text-white/85 flex-1">
                twitch.tv/<b>{r.twitchLogin}</b>
              </span>
              {r.status === "active" ? (
                <span className="text-xs text-emerald-400">active</span>
              ) : (
                <a
                  href={twitchConnectUrl(guildId)}
                  className="text-xs px-2 py-1 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30"
                >
                  {t("twitchFeat.connect.reconnect")}
                </a>
              )}
              <button
                type="button"
                onClick={() => void disconnectTwitch(guildId, r.id).then(load)}
                className="text-white/40 hover:text-red-400"
                title={t("twitchFeat.connect.disconnect")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Live Role tab (TZ-A §2) ───────────────────────────────

export function LiveRoleTab({ guildId }: { guildId: string }) {
  const { t } = useTranslation()
  const { premium } = usePremium()
  const openPremiumModal = usePremiumModal()
  const [configs, setConfigs] = useState<LiveRoleConfigRow[]>([])
  const [bindings, setBindings] = useState<LiveRoleBindingRow[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [newRoleId, setNewRoleId] = useState("")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    getLiveRoleState(guildId)
      .then((s) => {
        setConfigs(s.configs)
        setBindings(s.bindings)
      })
      .catch(() => null)
    getGuildRoles(guildId).then(setRoles).catch(() => null)
  }, [guildId])
  useEffect(load, [load])

  async function createConfig() {
    if (!newRoleId) return
    setError(null)
    try {
      await createLiveRoleConfig(guildId, newRoleId)
      setNewRoleId("")
      load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error"
      if (msg.includes("Premium")) openPremiumModal()
      else setError(msg)
    }
  }

  return (
    <div className="space-y-4">
      <Card title={t("twitchFeat.liveRole.title")} desc={t("twitchFeat.liveRole.desc")}>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={newRoleId || "none"} onValueChange={(v) => setNewRoleId(v === "none" ? "" : v)}>
            <SelectTrigger className="w-[240px] rounded-lg bg-white/[0.04] border-white/10">
              <SelectValue placeholder={t("twitchFeat.liveRole.pickRole")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("twitchFeat.liveRole.pickRole")}</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            disabled={!newRoleId}
            onClick={() => void createConfig()}
            className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4 inline mr-1" />
            {t("twitchFeat.liveRole.add")}
          </button>
          {!premium && configs.length >= 1 && <PremiumChip />}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </Card>

      {configs.map((cfg) => (
        <LiveRoleConfigCard
          key={cfg.id}
          guildId={guildId}
          cfg={cfg}
          roles={roles}
          bindings={bindings.filter((b) => b.configId === cfg.id)}
          premium={premium}
          onChanged={load}
        />
      ))}
    </div>
  )
}

function LiveRoleConfigCard({
  guildId,
  cfg,
  roles,
  bindings,
  premium,
  onChanged,
}: {
  guildId: string
  cfg: LiveRoleConfigRow
  roles: GuildRole[]
  bindings: LiveRoleBindingRow[]
  premium: boolean
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [twitchLogin, setTwitchLogin] = useState("")
  const [memberQuery, setMemberQuery] = useState("")
  const [hits, setHits] = useState<GuildMemberHit[]>([])
  const [member, setMember] = useState<GuildMemberHit | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const roleName = roles.find((r) => r.id === cfg.roleId)?.name ?? cfg.roleId

  useEffect(() => {
    if (!memberQuery.trim()) return setHits([])
    const timer = setTimeout(() => {
      searchGuildMembers(guildId, memberQuery.trim()).then(setHits).catch(() => setHits([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [memberQuery, guildId])

  async function addBinding() {
    if (!member || !twitchLogin.trim()) return
    setErr(null)
    try {
      await addLiveRoleBinding(guildId, {
        configId: cfg.id,
        discordUserId: member.id,
        twitchLogin: twitchLogin.trim(),
      })
      setMember(null)
      setTwitchLogin("")
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error")
    }
  }

  return (
    <Card title={`@${roleName}`}>
      <div className="flex items-center gap-3">
        <Toggle
          checked={cfg.enabled}
          onChange={(v) => void updateLiveRoleConfig(guildId, cfg.id, { enabled: v }).then(onChanged)}
        />
        <span className="text-sm text-white/70">{t("twitchFeat.liveRole.enabled")}</span>
        <button
          type="button"
          onClick={() => void deleteLiveRoleConfig(guildId, cfg.id).then(onChanged)}
          className="ml-auto text-white/40 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {cfg.hierarchyWarning && (
        <p className="text-xs text-amber-300">⚠️ {t("twitchFeat.liveRole.hierarchy")}</p>
      )}

      {premium && (
        <div className="grid gap-1.5 max-w-sm">
          <span className="text-xs text-white/50">{t("twitchFeat.liveRole.filter")}</span>
          <input
            defaultValue={cfg.filterText ?? ""}
            onBlur={(e) =>
              void updateLiveRoleConfig(guildId, cfg.id, { filterText: e.target.value.trim() || null }).then(onChanged)
            }
            placeholder="e.g. Valorant"
            className="rounded-md border border-white/10 bg-[#15151f] px-3 py-2 text-sm text-white"
          />
        </div>
      )}

      <div className="space-y-2">
        {bindings.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm">
            <span className={cn("h-2 w-2 rounded-full", b.isLive ? "bg-red-500" : "bg-white/20")} />
            <span className="text-white/85">
              <b>{b.twitchLogin}</b> → <span className="text-white/60">&lt;@{b.discordUserId}&gt;</span>
            </span>
            {b.isLive && <span className="text-xs text-red-400">LIVE</span>}
            <button
              type="button"
              onClick={() => void removeLiveRoleBinding(guildId, b.id).then(onChanged)}
              className="ml-auto text-white/40 hover:text-red-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-2 items-start">
        <div className="relative">
          <input
            value={member ? member.displayName : memberQuery}
            onChange={(e) => {
              setMember(null)
              setMemberQuery(e.target.value)
            }}
            placeholder={t("twitchFeat.liveRole.member")}
            className="w-full rounded-md border border-white/10 bg-[#15151f] px-3 py-2 text-sm text-white"
          />
          {hits.length > 0 && !member && (
            <div className="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-[#15151f] shadow-2xl py-1 max-h-48 overflow-y-auto">
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setMember(h)
                    setHits([])
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                >
                  {h.avatarUrl && <img src={h.avatarUrl} alt="" className="h-5 w-5 rounded-full" />}
                  <span className="text-white/85">{h.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          value={twitchLogin}
          onChange={(e) => setTwitchLogin(e.target.value)}
          placeholder="twitch_login"
          className="rounded-md border border-white/10 bg-[#15151f] px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          disabled={!member || !twitchLogin.trim()}
          onClick={() => void addBinding()}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5 disabled:opacity-50"
        >
          {t("twitchFeat.liveRole.bind")}
        </button>
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
    </Card>
  )
}

// ── Event Alerts tab (TZ-A §3) ────────────────────────────

export function EventAlertsTab({ guildId }: { guildId: string }) {
  const { t } = useTranslation()
  const { premium } = usePremium()
  const [rows, setRows] = useState<EventAlertRow[] | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [testMsg, setTestMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    getEventAlerts(guildId).then(setRows).catch(() => setRows([]))
    getChannels(guildId).then(setChannels).catch(() => null)
  }, [guildId])
  useEffect(load, [load])

  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-white/40" />
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)

  return (
    <div className="space-y-4">
      {testMsg && <p className="text-sm text-emerald-400">{testMsg}</p>}
      {ALERT_EVENT_KEYS.map((type) => {
        const row = rows.find((r) => r.eventType === type)!
        return (
          <Card key={type} title={t(`twitchFeat.alerts.types.${type}`)}>
            <div className="flex items-center gap-3 flex-wrap">
              <Toggle
                checked={row.enabled}
                onChange={(v) => void updateEventAlert(guildId, type, { enabled: v }).then(load)}
              />
              <Select
                value={row.channelId ?? "none"}
                onValueChange={(v) =>
                  void updateEventAlert(guildId, type, { channelId: v === "none" ? null : v }).then(load)
                }
              >
                <SelectTrigger className="w-[220px] rounded-lg bg-white/[0.04] border-white/10">
                  <SelectValue placeholder={t("twitchFeat.alerts.channel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {textChannels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      # {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1.5">
                {(["text", "embed", "card"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      if (f !== "text" && !premium) return
                      void updateEventAlert(guildId, type, { format: f }).then(load)
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border",
                      row.format === f
                        ? "border-violet-500 bg-violet-500/15 text-white"
                        : "border-white/10 text-white/60 hover:bg-white/[0.04]",
                    )}
                  >
                    {t(`twitchFeat.alerts.fmt.${f}`)}
                    {f !== "text" && !premium && " 🔒"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  void testEventAlert(guildId, type).then(() => {
                    setTestMsg(t("twitchFeat.alerts.testSent"))
                    setTimeout(() => setTestMsg(null), 3000)
                  })
                }
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
              >
                <Send className="h-3 w-3" />
                {t("twitchFeat.alerts.test")}
              </button>
            </div>

            <div className="grid gap-1.5">
              <span className="text-xs text-white/50">{t("twitchFeat.alerts.template")}</span>
              <input
                defaultValue={row.template ?? ""}
                onBlur={(e) => void updateEventAlert(guildId, type, { template: e.target.value.trim() || null })}
                placeholder={t("twitchFeat.alerts.templatePh")}
                className="rounded-md border border-white/10 bg-[#15151f] px-3 py-2 text-sm text-white"
              />
              <span className="text-[11px] text-white/35">
                {"{user} {amount} {tier} {message} {streamer} {months} {viewers}"}
              </span>
            </div>

            {row.format === "card" && premium && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                <p className="text-xs font-medium text-white/70">{t("twitchFeat.alerts.card")}</p>
                <ImageUploadField
                  value={row.cardConfig?.backgroundUrl ?? null}
                  onChange={(url) =>
                    void updateEventAlert(guildId, type, {
                      cardConfig: { ...(row.cardConfig ?? {}), backgroundUrl: url ?? undefined },
                    }).then(load)
                  }
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-xs text-white/50 inline-flex items-center gap-2">
                    {t("twitchFeat.alerts.textColor")}
                    <input
                      type="color"
                      defaultValue={row.cardConfig?.textColor ?? "#ffffff"}
                      onBlur={(e) =>
                        void updateEventAlert(guildId, type, {
                          cardConfig: { ...(row.cardConfig ?? {}), textColor: e.target.value },
                        })
                      }
                    />
                  </label>
                  <Select
                    value={row.cardConfig?.font ?? "sans-serif"}
                    onValueChange={(v) =>
                      void updateEventAlert(guildId, type, {
                        cardConfig: { ...(row.cardConfig ?? {}), font: v },
                      }).then(load)
                    }
                  >
                    <SelectTrigger className="w-[150px] rounded-lg bg-white/[0.04] border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["sans-serif", "serif", "monospace"].map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => void copyCardToAll(guildId, type).then(load)}
                    className="text-xs text-violet-300 hover:text-violet-200"
                  >
                    {t("twitchFeat.alerts.copyAll")}
                  </button>
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ── Schedule Sync tab (TZ-B §1, Premium) ──────────────────

export function ScheduleSyncTab({ guildId }: { guildId: string }) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<ScheduleSyncWire | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const load = useCallback(() => {
    getScheduleSync(guildId).then(setSettings).catch(() => null)
  }, [guildId])
  useEffect(load, [load])

  if (!settings) return <Loader2 className="h-5 w-5 animate-spin text-white/40" />

  return (
    <PremiumGate>
      <div className="space-y-4">
        <Card title={t("twitchFeat.schedule.title")} desc={t("twitchFeat.schedule.desc")}>
          {settings.manageEvents === false && (
            <p className="text-xs text-amber-300">⚠️ {t("twitchFeat.schedule.noPerm")}</p>
          )}
          <div className="flex items-center gap-3">
            <Toggle
              checked={settings.enabled}
              onChange={(v) => void updateScheduleSync(guildId, { enabled: v }).then(load)}
            />
            <span className="text-sm text-white/70">{t("twitchFeat.schedule.enable")}</span>
            <button
              type="button"
              disabled={syncing}
              onClick={() => {
                setSyncing(true)
                scheduleSyncNow(guildId)
                  .then((r) => setResult(`+${r.created} / ~${r.updated} / -${r.deleted}`))
                  .catch(() => setResult("error"))
                  .finally(() => setSyncing(false))
              }}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
            >
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {t("twitchFeat.schedule.syncNow")}
            </button>
          </div>
          {result && <p className="text-xs text-white/50">{t("twitchFeat.schedule.result")}: {result}</p>}
          <div className="grid gap-1.5">
            <span className="text-xs text-white/50">{t("twitchFeat.schedule.titleTpl")}</span>
            <input
              defaultValue={settings.titleTemplate ?? ""}
              onBlur={(e) => void updateScheduleSync(guildId, { titleTemplate: e.target.value.trim() || null })}
              placeholder="{streamer} — {title}"
              className="rounded-md border border-white/10 bg-[#15151f] px-3 py-2 text-sm text-white"
            />
            <span className="text-xs text-white/50">{t("twitchFeat.schedule.descTpl")}</span>
            <input
              defaultValue={settings.descriptionTemplate ?? ""}
              onBlur={(e) => void updateScheduleSync(guildId, { descriptionTemplate: e.target.value.trim() || null })}
              placeholder="Watch live on Twitch: https://twitch.tv/{streamer}"
              className="rounded-md border border-white/10 bg-[#15151f] px-3 py-2 text-sm text-white"
            />
            <span className="text-[11px] text-white/35">{"{streamer} {title} {category}"}</span>
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs text-white/50">{t("twitchFeat.schedule.cover")}</span>
            <ImageUploadField
              value={settings.coverUrl}
              onChange={(url) => void updateScheduleSync(guildId, { coverUrl: url }).then(load)}
            />
          </div>
        </Card>
      </div>
    </PremiumGate>
  )
}
