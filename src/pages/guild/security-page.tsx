import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ApiError,
  addSecurityWhitelist,
  applySecurityPreset,
  getChannels,
  getGuildRoles,
  getSecurityOverview,
  getSecurityWhitelist,
  listNukeIncidents,
  listQuarantine,
  refreshSecurityPanel,
  removeSecurityWhitelist,
  resolveQuarantine,
  restoreNukeIncident,
  searchGuildMembers,
  setPanicMode,
  setupQuarantine,
  updateSecuritySettings,
  listSnapshots,
  takeSnapshot,
  previewSnapshot,
  restoreSnapshot,
  getRestoreProgress,
  type Channel,
  type GuildRole,
  type GuildMemberHit,
  type NukeIncidentRow,
  type QuarantineRow,
  type SecurityOverview,
  type SecuritySettingsWire,
  type SnapshotRow,
  type SnapshotPreview,
  type RestoreProgressWire,
  type WhitelistEntry,
} from "@/lib/api"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { PremiumGate, PremiumChip } from "@/components/premium"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, RotateCcw, Search, Shield, X } from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "overview" | "antiraid" | "antinuke" | "quarantine" | "whitelist" | "shield" | "snapshots"
const TABS: Tab[] = ["overview", "antiraid", "antinuke", "quarantine", "whitelist", "shield", "snapshots"]

/** Security Suite dashboard (Security TZ §0). */
export function SecurityPage() {
  const { t } = useTranslation()
  const guildId = useCurrentGuildId()
  const [tab, setTab] = useState<Tab>("overview")
  const [overview, setOverview] = useState<SecurityOverview | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    if (!guildId) return
    Promise.all([
      getSecurityOverview(guildId),
      getChannels(guildId).catch(() => [] as Channel[]),
      getGuildRoles(guildId).catch(() => [] as GuildRole[]),
    ])
      .then(([o, c, r]) => {
        setOverview(o)
        setChannels(c)
        setRoles(r)
      })
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setError(t("common.noAccess"))
        else setError(e instanceof Error ? e.message : "Loading error")
      })
      .finally(() => setLoading(false))
  }, [guildId, t])

  useEffect(() => {
    setLoading(true)
    reload()
  }, [reload])

  if (!guildId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <p className="text-white/60">{t("common.selectServer")}</p>
      </div>
    )
  }

  async function save(patch: Partial<SecuritySettingsWire>) {
    if (!overview) return
    const saved = await updateSecuritySettings(guildId!, patch)
    setOverview({ ...overview, settings: saved })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="h-7 w-7 text-violet-400" />
          {t("security.title")}
        </h1>
        <p className="text-sm text-white/50 mt-1">{t("security.sub")}</p>
      </div>

      <div className="flex items-center gap-1 border-b border-white/5 overflow-x-auto">
        {TABS.map((tk) => (
          <button
            key={tk}
            type="button"
            onClick={() => setTab(tk)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === tk ? "border-violet-500 text-white" : "border-transparent text-white/50 hover:text-white/80",
            )}
          >
            {t(`security.tabs.${tk}`)}
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

      {!loading && !error && overview && (
        <>
          {tab === "overview" && (
            <OverviewTab guildId={guildId} overview={overview} channels={channels} onSave={save} onReload={reload} onSwitchTab={setTab} />
          )}
          {tab === "antiraid" && (
            <PremiumGate>
              <AntiRaidTab overview={overview} onSave={save} />
            </PremiumGate>
          )}
          {tab === "antinuke" && (
            <PremiumGate>
              <AntiNukeTab guildId={guildId} overview={overview} onSave={save} />
            </PremiumGate>
          )}
          {tab === "quarantine" && (
            <PremiumGate>
              <QuarantineTab guildId={guildId} overview={overview} onReload={reload} />
            </PremiumGate>
          )}
          {tab === "whitelist" && <WhitelistTab guildId={guildId} roles={roles} />}
          {tab === "shield" && (
            <PremiumGate>
              <ShieldTab overview={overview} channels={channels} onSave={save} />
            </PremiumGate>
          )}
          {tab === "snapshots" && (
            <PremiumGate>
              <SnapshotsTab guildId={guildId} />
            </PremiumGate>
          )}
        </>
      )}
    </div>
  )
}

// ── Shared bits ───────────────────────────────────────────

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

function Toggle({ checked, onChange, busy }: { checked: boolean; onChange: (v: boolean) => void; busy?: boolean }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
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

function RadioRow<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  labels: Record<string, string>
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            value === o
              ? "border-violet-500 bg-violet-500/15 text-white"
              : "border-white/10 text-white/60 hover:bg-white/[0.04]",
          )}
        >
          {labels[o] ?? o}
        </button>
      ))}
    </div>
  )
}

// ── Overview (§0, §2, §3, §9) ────────────────────────────

function OverviewTab({
  guildId,
  overview,
  channels,
  onSave,
  onReload,
  onSwitchTab,
}: {
  guildId: string
  overview: SecurityOverview
  channels: Channel[]
  onSave: (p: Partial<SecuritySettingsWire>) => Promise<void>
  onReload: () => void
  onSwitchTab: (tab: Tab) => void
}) {
  const { t } = useTranslation()
  const s = overview.settings
  const [busy, setBusy] = useState<string | null>(null)
  const [panicNotes, setPanicNotes] = useState<string[]>([])
  const [presetChanges, setPresetChanges] = useState<string[]>([])
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  /** §1.1 — human-readable diff after a preset switch. */
  function diffSettings(before: SecuritySettingsWire, after: SecuritySettingsWire): string[] {
    const out: string[] = []
    const label = (v: string) => t(`security.age.act${v[0].toUpperCase()}${v.slice(1)}` as never, v)
    if (before.ageFilterEnabled !== after.ageFilterEnabled) {
      out.push(`${t("security.age.title")}: ${before.ageFilterEnabled ? "on" : "off"} → ${after.ageFilterEnabled ? "on" : "off"}`)
    }
    if (after.ageFilterEnabled && before.ageFilterMinDays !== after.ageFilterMinDays) {
      out.push(`Age filter: ${before.ageFilterMinDays} days → ${after.ageFilterMinDays} days`)
    }
    if (before.ageFilterAction !== after.ageFilterAction) {
      out.push(`Age filter action: ${label(before.ageFilterAction)} → ${label(after.ageFilterAction)}`)
    }
    if (before.antiRaidAction !== after.antiRaidAction) {
      out.push(`Anti-Raid action: ${before.antiRaidAction} → ${after.antiRaidAction}`)
    }
    if (before.antiNukeAction !== after.antiNukeAction) {
      out.push(`Anti-Nuke action: ${before.antiNukeAction.replace("_", " + ")} → ${after.antiNukeAction.replace("_", " + ")}`)
    }
    if (before.antiRaidAutoPanic !== after.antiRaidAutoPanic) {
      out.push(`Auto-panic on raid: ${before.antiRaidAutoPanic ? "on" : "off"} → ${after.antiRaidAutoPanic ? "on" : "off"}`)
    }
    if (before.panicSlowmodeEnabled !== after.panicSlowmodeEnabled) {
      out.push(`Panic slowmode: ${before.panicSlowmodeEnabled ? "on" : "off"} → ${after.panicSlowmodeEnabled ? "on" : "off"}`)
    }
    return out.length ? out : [t("security.preset.noChanges")]
  }

  async function applyPreset(preset: "relaxed" | "standard" | "strict") {
    await run(`preset-${preset}`, async () => {
      const before = { ...s }
      const after = await applySecurityPreset(guildId, preset)
      setPresetChanges(diffSettings(before, after))
      setTimeout(() => setPresetChanges([]), 8000)
      onReload()
    })
  }

  // §1.2 — protection level from enabled modules.
  const moduleStates: { key: string; on: boolean; premium: boolean; tab: Tab }[] = [
    { key: "age", on: s.ageFilterEnabled, premium: false, tab: "overview" },
    { key: "antiraid", on: s.antiRaidAction !== "alert", premium: true, tab: "antiraid" },
    { key: "antinuke", on: s.antiNukeAction !== "alert", premium: true, tab: "antinuke" },
    { key: "quarantine", on: Boolean(s.quarantineRoleId), premium: true, tab: "quarantine" },
    { key: "whitelist", on: true, premium: false, tab: "whitelist" },
    { key: "shield", on: s.shieldEnabled, premium: true, tab: "shield" },
    { key: "snapshot", on: overview.premium, premium: true, tab: "snapshots" },
  ]
  const scored = moduleStates.filter((m) => m.key !== "whitelist")
  const level = Math.round((scored.filter((m) => m.on).length / scored.length) * 100)
  const hints = scored
    .filter((m) => !m.on)
    .slice(0, 2)
    .map((m) => t("security.level.hint", { module: t(`security.tabs.${m.tab === "overview" ? "overview" : m.tab}` as never, m.key) }))

  const PRESET_ICONS: Record<string, string> = { relaxed: "🌿", standard: "🛡️", strict: "🔒" }

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes secPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.45);} 50% { box-shadow: 0 0 0 12px rgba(239,68,68,0);} }
        .sec-panic-active { animation: secPulse 1.6s ease-in-out infinite; }
        .sec-preset { transition: transform .2s ease, box-shadow .25s ease, border-color .25s ease, background .25s ease; }
        .sec-preset:hover { transform: translateY(-2px); }
        .sec-preset-active { box-shadow: 0 0 24px rgba(139,92,246,.35); }
        .sec-fade-in { animation: secFade .35s ease; }
        @keyframes secFade { from { opacity: 0; transform: translateY(-4px);} to { opacity: 1; transform: none;} }
      `}</style>

      {/* §1.1 intro (muted marketing lead-in) */}
      <div>
        <p className="text-base font-semibold text-white/85">{t("security.intro.title")}</p>
        <p className="text-sm text-white/45">{t("security.intro.sub")}</p>
      </div>

      {/* §1.1 preset selector — the centrepiece */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(["relaxed", "standard", "strict"] as const).map((p) => {
          const active = s.preset === p
          return (
            <button
              key={p}
              type="button"
              disabled={busy === `preset-${p}`}
              onClick={() => void applyPreset(p)}
              className={cn(
                "sec-preset rounded-2xl border p-5 text-left space-y-2",
                active
                  ? "sec-preset-active border-violet-500 bg-violet-500/15"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{PRESET_ICONS[p]}</span>
                <span className={cn("text-base font-bold", active ? "text-white" : "text-white/80")}>
                  {t(`security.preset.${p}`)}
                </span>
                {active && (
                  <span className="ml-auto rounded-full bg-violet-500/30 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                    {t("security.preset.current")}
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-white/50">{t(`security.preset.${p}Desc`)}</p>
            </button>
          )
        })}
      </div>

      {presetChanges.length > 0 && (
        <div className="sec-fade-in rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3">
          <p className="text-xs font-semibold text-violet-200 mb-1">{t("security.preset.changed")}</p>
          <ul className="text-xs text-white/70 space-y-0.5">
            {presetChanges.map((c, i) => (
              <li key={i}>• {c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* §1.2 protection level */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-[220px] flex-1">
            <span className="text-2xl">🛡️</span>
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-white">{t("security.level.title")}</p>
                <p
                  className={cn(
                    "text-sm font-bold",
                    level >= 70 ? "text-emerald-400" : level >= 40 ? "text-amber-300" : "text-red-400",
                  )}
                >
                  {level}%
                </p>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    level >= 70
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                      : level >= 40
                        ? "bg-gradient-to-r from-amber-500 to-amber-400"
                        : "bg-gradient-to-r from-red-500 to-orange-400",
                  )}
                  style={{ width: `${Math.max(6, level)}%` }}
                />
              </div>
            </div>
          </div>
          {hints.length > 0 && (
            <div className="text-xs text-white/45 space-y-0.5">
              {hints.map((h, i) => (
                <p key={i}>💡 {h}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* §1.3 Panic Mode zone */}
      <div
        className={cn(
          "rounded-2xl border p-5",
          overview.panicActive ? "border-red-500/50 bg-red-500/[0.08]" : "border-white/10 bg-white/[0.03]",
        )}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-white flex items-center gap-2">
              {overview.panicActive ? "🚨" : "🧯"} {t("security.panic.title")}
              {overview.panicActive && (
                <span className="rounded-full bg-red-500/25 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                  {t("security.panic.active")}
                </span>
              )}
            </p>
            {/* §1.5 module explainer under the button zone */}
            <p className="mt-1 text-xs text-white/45">{t("security.mod.panic")}</p>
          </div>
          <button
            type="button"
            disabled={busy === "panic"}
            onClick={() =>
              void run("panic", async () => {
                const res = await setPanicMode(guildId, !overview.panicActive)
                setPanicNotes(res.notes)
                onReload()
              })
            }
            className={cn(
              "rounded-xl px-6 py-3 text-sm font-bold text-white transition-colors",
              overview.panicActive
                ? "sec-panic-active bg-red-600 hover:bg-red-500"
                : "bg-white/10 hover:bg-red-600/80 border border-red-500/30",
            )}
          >
            {busy === "panic" ? "…" : overview.panicActive ? `🔓 ${t("security.panic.turnOff")}` : `🔒 ${t("security.panic.turnOn")}`}
          </button>
        </div>
        {panicNotes.length > 0 && (
          <ul className="sec-fade-in mt-3 text-xs text-white/50 space-y-0.5">
            {panicNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Toggle
              checked={s.panicSlowmodeEnabled}
              busy={busy === "pslow"}
              onChange={(v) => void run("pslow", () => onSave({ panicSlowmodeEnabled: v }))}
            />
            <span className="text-xs text-white/60">{t("security.panic.slowmode")}</span>
            {s.panicSlowmodeEnabled && (
              <input
                type="number"
                min={1}
                max={21600}
                value={s.panicSlowmodeSeconds}
                onChange={(e) => void onSave({ panicSlowmodeSeconds: Number(e.target.value) || 30 })}
                className="w-20 rounded-md border border-white/10 bg-[#15151f] px-2 py-1 text-sm text-white"
              />
            )}
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-white/50">{t("security.panic.panelChannel")}</span>
            <Select
              value={s.panelChannelId ?? "none"}
              onValueChange={(v) =>
                void run("panel", async () => {
                  await onSave({ panelChannelId: v === "none" ? null : v })
                  if (v !== "none") await refreshSecurityPanel(guildId).catch(() => null)
                })
              }
            >
              <SelectTrigger className="rounded-lg bg-white/[0.04] border-white/10">
                <SelectValue placeholder="—" />
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
          </div>
        </div>
      </div>

      {/* §2 Age Filter (kept on Overview, free tier) */}
      <Card title={t("security.age.title")} desc={t("security.mod.age")}>
        <div className="flex items-center gap-3">
          <Toggle
            checked={s.ageFilterEnabled}
            busy={busy === "age"}
            onChange={(v) => void run("age", () => onSave({ ageFilterEnabled: v }))}
          />
          <span className="text-sm text-white/70">{t("security.age.enable")}</span>
        </div>
        {s.ageFilterEnabled && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/50">{t("security.age.minAge")}</span>
              <RadioRow
                options={["3", "7", "14", "30"]}
                value={String(s.ageFilterMinDays) as "3"}
                onChange={(v) => void onSave({ ageFilterMinDays: Number(v) })}
                labels={{ "3": "3d", "7": "7d", "14": "14d", "30": "30d" }}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/50">{t("security.age.action")}</span>
              <RadioRow
                options={["alert", "quarantine", "kick"]}
                value={s.ageFilterAction}
                onChange={(v) => {
                  if (v === "quarantine" && !overview.premium) return
                  void onSave({ ageFilterAction: v })
                }}
                labels={{
                  alert: t("security.age.actAlert"),
                  quarantine: `${t("security.age.actQuarantine")}${overview.premium ? "" : " 🔒"}`,
                  kick: t("security.age.actKick"),
                }}
              />
              {!overview.premium && <PremiumChip />}
            </div>
            {s.ageFilterAction === "kick" && (
              <div className="grid gap-1.5">
                <span className="text-xs text-white/50">{t("security.age.kickMessage")}</span>
                <textarea
                  defaultValue={s.ageFilterKickMessage ?? "This server requires accounts older than {days} days. Please try again later."}
                  onBlur={(e) => void onSave({ ageFilterKickMessage: e.target.value.trim() || null })}
                  rows={2}
                  className="w-full rounded-md border border-white/10 bg-[#15151f] px-3 py-2 text-sm text-white"
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* §1.4 module summary cards → click opens the tab */}
      <div className="grid gap-3 sm:grid-cols-2">
        {moduleStates
          .filter((m) => m.key !== "age")
          .map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => onSwitchTab(m.tab)}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-violet-500/40 hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {t(`security.modName.${m.key}` as never)}
                </span>
                {m.premium && !overview.premium ? (
                  <PremiumChip />
                ) : (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      m.on ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/40",
                    )}
                  >
                    {m.on ? "ON" : "OFF"}
                  </span>
                )}
              </div>
              {/* §1.5 explainer */}
              <p className="mt-1.5 text-xs leading-relaxed text-white/45">{t(`security.mod.${m.key}` as never)}</p>
            </button>
          ))}
      </div>
    </div>
  )
}

// ── Anti-Raid (§4) ────────────────────────────────────────

function AntiRaidTab({
  overview,
  onSave,
}: {
  overview: SecurityOverview
  onSave: (p: Partial<SecuritySettingsWire>) => Promise<void>
}) {
  const { t } = useTranslation()
  const s = overview.settings
  return (
    <div className="space-y-4">
      <Card title={t("security.raid.title")} desc={t("security.mod.antiraid")}>
        <RadioRow
          options={["alert", "quarantine", "kick", "ban"]}
          value={s.antiRaidAction}
          onChange={(v) => void onSave({ antiRaidAction: v })}
          labels={{
            alert: t("security.raid.actAlert"),
            quarantine: t("security.raid.actQuarantine"),
            kick: t("security.raid.actKick"),
            ban: t("security.raid.actBan"),
          }}
        />
        <div className="flex items-center gap-3 pt-2">
          <Toggle checked={s.antiRaidAutoPanic} onChange={(v) => void onSave({ antiRaidAutoPanic: v })} />
          <span className="text-sm text-white/70">{t("security.raid.autoPanic")}</span>
        </div>
      </Card>
    </div>
  )
}

// ── Anti-Nuke (§5) ────────────────────────────────────────

function AntiNukeTab({
  guildId,
  overview,
  onSave,
}: {
  guildId: string
  overview: SecurityOverview
  onSave: (p: Partial<SecuritySettingsWire>) => Promise<void>
}) {
  const { t } = useTranslation()
  const s = overview.settings
  const [incidents, setIncidents] = useState<NukeIncidentRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    listNukeIncidents(guildId).then(setIncidents).catch(() => setIncidents([]))
  }, [guildId])

  return (
    <div className="space-y-4">
      <Card title={t("security.nuke.title")} desc={t("security.mod.antinuke")}>
        <RadioRow
          options={["alert", "strip", "strip_quarantine"]}
          value={s.antiNukeAction}
          onChange={(v) => void onSave({ antiNukeAction: v })}
          labels={{
            alert: t("security.nuke.actAlert"),
            strip: t("security.nuke.actStrip"),
            strip_quarantine: t("security.nuke.actStripQ"),
          }}
        />
      </Card>

      <Card title={t("security.nuke.incidents")}>
        {!incidents ? (
          <Loader2 className="h-4 w-4 animate-spin text-white/40" />
        ) : incidents.length === 0 ? (
          <p className="text-sm text-white/45">{t("security.nuke.noIncidents")}</p>
        ) : (
          <div className="space-y-2">
            {incidents.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-white/85">
                    {i.userTag ?? i.userId} <span className="text-xs text-white/40">({i.detector})</span>
                  </p>
                  <p className="text-xs text-white/40 truncate">
                    {i.roles.join(", ")} · {new Date(i.createdAt).toLocaleString()}
                  </p>
                </div>
                {i.restored ? (
                  <span className="text-xs text-emerald-400">{t("security.nuke.restored")}</span>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === i.id}
                    onClick={() => {
                      setBusyId(i.id)
                      restoreNukeIncident(guildId, i.id)
                        .then(() => listNukeIncidents(guildId).then(setIncidents))
                        .finally(() => setBusyId(null))
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {t("security.nuke.restore")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Quarantine (§6) ───────────────────────────────────────

function QuarantineTab({
  guildId,
  overview,
  onReload,
}: {
  guildId: string
  overview: SecurityOverview
  onReload: () => void
}) {
  const { t } = useTranslation()
  const s = overview.settings
  const [rows, setRows] = useState<QuarantineRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const loadRows = useCallback(() => {
    listQuarantine(guildId).then(setRows).catch(() => setRows([]))
  }, [guildId])

  useEffect(loadRows, [loadRows])

  return (
    <div className="space-y-4">
      <Card title={t("security.q.title")} desc={t("security.mod.quarantine")}>
        {s.quarantineRoleId ? (
          <p className="text-sm text-emerald-400">✅ {t("security.q.ready")}</p>
        ) : (
          <button
            type="button"
            disabled={busy === "setup"}
            onClick={() => {
              setBusy("setup")
              setupQuarantine(guildId)
                .then((r) => {
                  setWarnings(r.warnings)
                  onReload()
                })
                .finally(() => setBusy(null))
            }}
            className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "setup" ? "…" : t("security.q.setup")}
          </button>
        )}
        {warnings.map((w, i) => (
          <p key={i} className="text-xs text-amber-300">
            ⚠️ {w}
          </p>
        ))}
      </Card>

      <Card title={t("security.q.active")}>
        {!rows ? (
          <Loader2 className="h-4 w-4 animate-spin text-white/40" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-white/45">{t("security.q.empty")}</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-white/85">{r.userTag ?? r.userId}</p>
                  <p className="text-xs text-white/40 truncate">
                    {r.reason ?? "—"} · {r.source} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                {(["approve", "kick", "ban"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => {
                      setBusy(r.id)
                      resolveQuarantine(guildId, r.id, a)
                        .then(loadRows)
                        .finally(() => setBusy(null))
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs border",
                      a === "approve" && "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10",
                      a === "kick" && "border-white/15 text-white/70 hover:bg-white/5",
                      a === "ban" && "border-red-500/40 text-red-300 hover:bg-red-500/10",
                    )}
                  >
                    {t(`security.q.${a}`)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Whitelist (§1) ────────────────────────────────────────

function WhitelistTab({ guildId, roles }: { guildId: string; roles: GuildRole[] }) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<WhitelistEntry[] | null>(null)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<GuildMemberHit[]>([])
  const [roleId, setRoleId] = useState("")

  const load = useCallback(() => {
    getSecurityWhitelist(guildId).then(setEntries).catch(() => setEntries([]))
  }, [guildId])
  useEffect(load, [load])

  useEffect(() => {
    if (!query.trim()) return setHits([])
    const timer = setTimeout(() => {
      searchGuildMembers(guildId, query.trim()).then(setHits).catch(() => setHits([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [query, guildId])

  return (
    <div className="space-y-4">
      <Card title={t("security.wl.title")} desc={t("security.mod.whitelist")}>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300">
            👑 {t("security.wl.owner")}
          </span>
          {entries?.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs text-white/85"
            >
              {e.entityType === "role" ? "◈" : "👤"} {e.name ?? e.entityId}
              <button
                type="button"
                onClick={() => removeSecurityWhitelist(guildId, e.id).then(load)}
                className="text-white/40 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("security.wl.addUser")}
              className="w-full rounded-lg border border-white/10 bg-[#0e0e18] pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-violet-500/60"
            />
            {hits.length > 0 && (
              <div className="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-[#15151f] shadow-2xl py-1 max-h-56 overflow-y-auto">
                {hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setQuery("")
                      setHits([])
                      void addSecurityWhitelist(guildId, "user", h.id).then(load)
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
          <div className="flex gap-2">
            <Select value={roleId || "none"} onValueChange={(v) => setRoleId(v === "none" ? "" : v)}>
              <SelectTrigger className="rounded-lg bg-white/[0.04] border-white/10 flex-1">
                <SelectValue placeholder={t("security.wl.addRole")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("security.wl.addRole")}</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              disabled={!roleId}
              onClick={() => {
                void addSecurityWhitelist(guildId, "role", roleId).then(() => {
                  setRoleId("")
                  load()
                })
              }}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Stream Shield (§8) ────────────────────────────────────

function ShieldTab({
  overview,
  channels,
  onSave,
}: {
  overview: SecurityOverview
  channels: Channel[]
  onSave: (p: Partial<SecuritySettingsWire>) => Promise<void>
}) {
  const { t } = useTranslation()
  const s = overview.settings
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)
  return (
    <div className="space-y-4">
      <Card title={t("security.shield.title")} desc={t("security.mod.shield")}>
        <div className="flex items-center gap-3">
          <Toggle checked={s.shieldEnabled} onChange={(v) => void onSave({ shieldEnabled: v })} />
          <span className="text-sm text-white/70">{t("security.shield.enable")}</span>
          {overview.shieldActive && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs">LIVE</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Toggle checked={s.shieldPostAnnouncements} onChange={(v) => void onSave({ shieldPostAnnouncements: v })} />
          <span className="text-sm text-white/70">{t("security.shield.post")}</span>
        </div>
        <div className="grid gap-1.5 max-w-sm">
          <span className="text-xs text-white/50">{t("security.shield.channel")}</span>
          <Select
            value={s.shieldChannelId ?? "none"}
            onValueChange={(v) => void onSave({ shieldChannelId: v === "none" ? null : v })}
          >
            <SelectTrigger className="rounded-lg bg-white/[0.04] border-white/10">
              <SelectValue placeholder="—" />
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
        </div>
      </Card>

      <Card title={t("security.shield.hardening")} desc={t("security.shield.hardeningDesc")}>
        <div className="flex items-center gap-3">
          <Toggle checked={s.shieldSlowmodeEnabled} onChange={(v) => void onSave({ shieldSlowmodeEnabled: v })} />
          <span className="text-sm text-white/70">{t("security.shield.slowmode")}</span>
          {s.shieldSlowmodeEnabled && (
            <input
              type="number"
              min={1}
              max={21600}
              value={s.shieldSlowmodeSeconds}
              onChange={(e) => void onSave({ shieldSlowmodeSeconds: Number(e.target.value) || 10 })}
              className="w-20 rounded-md border border-white/10 bg-[#15151f] px-2 py-1 text-sm text-white"
            />
          )}
        </div>
        {s.shieldSlowmodeEnabled && (
          <div className="flex flex-wrap gap-1.5">
            {textChannels.map((c) => {
              const on = s.shieldSlowmodeChannels.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    void onSave({
                      shieldSlowmodeChannels: on
                        ? s.shieldSlowmodeChannels.filter((id) => id !== c.id)
                        : [...s.shieldSlowmodeChannels, c.id],
                    })
                  }
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs border",
                    on ? "border-violet-500 bg-violet-500/15 text-white" : "border-white/10 text-white/60",
                  )}
                >
                  # {c.name}
                </button>
              )
            })}
          </div>
        )}
        <div className="flex items-center gap-3 pt-1">
          <Toggle checked={s.shieldAgeFilterEnabled} onChange={(v) => void onSave({ shieldAgeFilterEnabled: v })} />
          <span className="text-sm text-white/70">{t("security.shield.age")}</span>
          {s.shieldAgeFilterEnabled && (
            <input
              type="number"
              min={1}
              max={90}
              value={s.shieldAgeFilterDays}
              onChange={(e) => void onSave({ shieldAgeFilterDays: Number(e.target.value) || 14 })}
              className="w-20 rounded-md border border-white/10 bg-[#15151f] px-2 py-1 text-sm text-white"
            />
          )}
        </div>
      </Card>
    </div>
  )
}


// ── Snapshots (§10) ───────────────────────────────────────

function SnapshotsTab({ guildId }: { guildId: string }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<SnapshotRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [preview, setPreview] = useState<SnapshotPreview | null>(null)
  const [progress, setProgress] = useState<RestoreProgressWire | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    listSnapshots(guildId).then(setRows).catch(() => setRows([]))
    getRestoreProgress(guildId).then(setProgress).catch(() => null)
  }, [guildId])
  useEffect(load, [load])

  // Poll while a restore is running (§10.6).
  useEffect(() => {
    if (progress?.status !== "running") return
    const timer = setInterval(() => {
      getRestoreProgress(guildId).then(setProgress).catch(() => null)
    }, 2000)
    return () => clearInterval(timer)
  }, [progress?.status, guildId])

  return (
    <div className="space-y-4">
      <Card title={t("security.snap.title")} desc={t("security.mod.snapshot")}>
        <button
          type="button"
          disabled={busy === "take"}
          onClick={() => {
            setBusy("take")
            setError(null)
            takeSnapshot(guildId)
              .then(load)
              .catch((e) => setError(e instanceof Error ? e.message : "Error"))
              .finally(() => setBusy(null))
          }}
          className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy === "take" ? "…" : t("security.snap.now")}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}

        {progress && progress.status !== "idle" && (
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              progress.status === "running" && "border-violet-500/40 bg-violet-500/10 text-violet-200",
              progress.status === "completed" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
              progress.status === "failed" && "border-red-500/40 bg-red-500/10 text-red-300",
            )}
          >
            {progress.status === "running" && (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("security.snap.restoring")}: {progress.step}
              </span>
            )}
            {progress.status === "completed" && (
              <span>
                ✅ {t("security.snap.restored")}: +{progress.created?.roles ?? 0} {t("security.snap.roles")}, +
                {progress.created?.categories ?? 0} {t("security.snap.categories")}, +{progress.created?.channels ?? 0}{" "}
                {t("security.snap.channels")}, {progress.created?.permissionsFixed ?? 0} {t("security.snap.permsFixed")}
                {progress.rebound?.length ? ` · ${t("security.snap.rebound")}: ${progress.rebound.join(", ")}` : ""}
              </span>
            )}
            {progress.status === "failed" && <span>⚠️ {progress.error}</span>}
          </div>
        )}

        {!rows ? (
          <Loader2 className="h-4 w-4 animate-spin text-white/40" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-white/45">{t("security.snap.empty")}</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm">
                <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/50">{r.type}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-white/85">{new Date(r.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-white/40">
                    {r.counts.roles} {t("security.snap.roles")} · {r.counts.categories} {t("security.snap.categories")} ·{" "}
                    {r.counts.channels} {t("security.snap.channels")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => {
                    setBusy(r.id)
                    previewSnapshot(guildId, r.id)
                      .then(setPreview)
                      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
                      .finally(() => setBusy(null))
                  }}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5"
                >
                  {t("security.snap.preview")}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {preview && (
        <Card title={t("security.snap.previewTitle")}>
          <p className="text-xs text-white/45">
            {new Date(preview.snapshot.createdAt).toLocaleString()} ({preview.snapshot.type})
          </p>
          <div className="text-sm text-white/75 space-y-1">
            <p>
              {t("security.snap.willCreate")}: {preview.missingRoles.length} {t("security.snap.roles")},{" "}
              {preview.missingCategories.length} {t("security.snap.categories")}, {preview.missingChannels.length}{" "}
              {t("security.snap.channels")}
            </p>
            {preview.missingRoles.length > 0 && (
              <p className="text-xs text-white/45">◈ {preview.missingRoles.slice(0, 15).join(", ")}</p>
            )}
            {[...preview.missingCategories, ...preview.missingChannels].length > 0 && (
              <p className="text-xs text-white/45">
                # {[...preview.missingCategories, ...preview.missingChannels].slice(0, 20).join(", ")}
              </p>
            )}
            <p className="text-xs text-amber-300/80">{t("security.snap.noDelete")}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy === "restore" || progress?.status === "running"}
              onClick={() => {
                setBusy("restore")
                setError(null)
                restoreSnapshot(guildId, preview.snapshot.id)
                  .then(() => {
                    setPreview(null)
                    setProgress({ status: "running", step: "roles" })
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : "Error"))
                  .finally(() => setBusy(null))
              }}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              ♻️ {t("security.snap.restore")}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
            >
              {t("security.snap.cancel")}
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
