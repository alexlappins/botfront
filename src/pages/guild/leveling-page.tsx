import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Save, Trash2, RefreshCw, Plus, X, Sparkles, Download, AlertTriangle, ChevronDown, Send } from "lucide-react"
import {
  ApiError,
  fetchRankCardPreview,
  getChannels,
  getGuildRoles,
  getLeveling,
  getLevelingEvents,
  getLevelingPermissions,
  levelingCsvExportUrl,
  recalcLeveling,
  removeIgnoredUser,
  replaceLevelingRoleRewards,
  replaceLevelingTiers,
  replaceNoXpChannels,
  replaceNoXpRoles,
  resetLevelingTiers,
  sendTestRankCard,
  setLevelingPermission,
  updateLevelingSettings,
  wipeLeveling,
  type Channel,
  type GuildRole,
  type LevelingCommandKey,
  type LevelingCommandPermission,
  type LevelingEvent,
  type LevelingPermMode,
  type LevelingPermissionsResponse,
  type LevelingSettings,
  type LevelingState,
  type LevelingTier,
  type RoleReward,
  type XpEventType,
} from "@/lib/api"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { cn } from "@/lib/utils"

const PLACEHOLDER_KEYS = [
  { key: "{user}", descKey: "user" },
  { key: "{user_name}", descKey: "userName" },
  { key: "{level}", descKey: "level" },
  { key: "{old_level}", descKey: "oldLevel" },
  { key: "{tier}", descKey: "tier" },
  { key: "{new_tier}", descKey: "newTier" },
  { key: "{old_tier}", descKey: "oldTier" },
  { key: "{server}", descKey: "server" },
] as const

export function LevelingPage() {
  const { t } = useTranslation()
  const guildId = useCurrentGuildId()
  const [state, setState] = useState<LevelingState | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!guildId) return
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([getLeveling(guildId), getChannels(guildId), getGuildRoles(guildId)])
      .then(([lvl, ch, rl]) => {
        if (!alive) return
        setState(lvl)
        setChannels(ch)
        setRoles(rl)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setError(t("common.noAccess"))
        } else {
          setError(e instanceof Error ? e.message : t("leveling.loadError"))
        }
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
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-violet-400" />
          {t("leveling.title")}
        </h1>
        <p className="text-sm text-white/50 mt-1">{t("leveling.sub")}</p>
      </div>

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
          {state.warnings.roleHierarchy.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                {t("leveling.warning.title")}
              </div>
              {state.warnings.roleHierarchy.map((w, i) => (
                <p key={i} className="text-xs text-amber-200/80">
                  • {w}
                </p>
              ))}
              <p className="text-xs text-amber-200/60 pt-1">{t("leveling.warning.hint")}</p>
            </div>
          )}

          <GeneralBlock guildId={guildId} channels={channels} initial={state.settings} />
          <XpSourcesBlock guildId={guildId} initial={state.settings} />
          <TiersBlock guildId={guildId} initial={state.tiers} />
          <RoleRewardsBlock
            guildId={guildId}
            initial={state.rewards}
            roles={roles}
            limit={state.limits.roleRewards}
            mode={state.settings.roleRewardsMode}
            onModeChange={async (mode) => {
              await updateLevelingSettings(guildId, { roleRewardsMode: mode })
              setState((s) => (s ? { ...s, settings: { ...s.settings, roleRewardsMode: mode } } : s))
            }}
          />
          <NoXpZonesBlock
            guildId={guildId}
            roles={roles}
            channels={channels}
            initialRoles={state.noXpRoles.map((r) => r.roleId)}
            initialTextChannels={state.noXpChannels
              .filter((c) => c.channelType === "text")
              .map((c) => c.channelId)}
            initialVoiceChannels={state.noXpChannels
              .filter((c) => c.channelType === "voice")
              .map((c) => c.channelId)}
            ignored={state.ignoredUsers}
            onUnignore={async (discordId) => {
              await removeIgnoredUser(guildId, discordId)
              setState((s) =>
                s ? { ...s, ignoredUsers: s.ignoredUsers.filter((u) => u.discordId !== discordId) } : s,
              )
            }}
          />
          <RankCardBlock guildId={guildId} initial={state.settings} channels={channels} />
          <PermissionsBlock guildId={guildId} roles={roles} />
          <AdvancedBlock guildId={guildId} />
          <AuditLogBlock guildId={guildId} />
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Reusable primitives
// ────────────────────────────────────────────────────────────

function Block({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-white/50 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
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
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-white/70">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-white/40">{hint}</span>}
    </label>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm transition-colors w-full text-left",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "hover:bg-white/[0.06]",
      )}
    >
      <span
        className={cn(
          "relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0",
          checked ? "bg-violet-500" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
      <span className="text-white/85">{label}</span>
    </button>
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60"
    />
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60"
    />
  )
}

function Textarea({
  value,
  onChange,
  rows,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      rows={rows ?? 3}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60 resize-y"
    />
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <input
        type="color"
        value={normalizeHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-12 rounded-lg border border-white/10 bg-transparent cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm font-mono text-white outline-none focus:border-violet-500/60"
      />
    </div>
  )
}

function SaveButton({
  dirty,
  saving,
  onClick,
  label,
}: {
  dirty: boolean
  saving: boolean
  onClick: () => void
  label?: string
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      disabled={!dirty || saving}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        dirty && !saving
          ? "bg-violet-600 hover:bg-violet-500 text-white"
          : "bg-white/5 text-white/40 cursor-not-allowed",
      )}
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {label ?? t("common.save")}
    </button>
  )
}

// ────────────────────────────────────────────────────────────
// Block 1: General
// ────────────────────────────────────────────────────────────

function GeneralBlock({
  guildId,
  channels,
  initial,
}: {
  guildId: string
  channels: Channel[]
  initial: LevelingSettings
}) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [channelMode, setChannelMode] = useState<"channel" | "dm" | "disabled">(() =>
    initial.levelupChannelId === null
      ? "disabled"
      : initial.levelupChannelId === "dm"
        ? "dm"
        : "channel",
  )
  const [channelId, setChannelId] = useState<string | null>(() =>
    initial.levelupChannelId && initial.levelupChannelId !== "dm" ? initial.levelupChannelId : null,
  )
  const [template, setTemplate] = useState(initial.levelupMessageTemplate)
  const [onlyTier, setOnlyTier] = useState(initial.notifyOnlyNewTier)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const dirty =
    enabled !== initial.enabled ||
    computeChannelValue(channelMode, channelId) !== initial.levelupChannelId ||
    template !== initial.levelupMessageTemplate ||
    onlyTier !== initial.notifyOnlyNewTier

  const textChannels = useMemo(() => channels.filter((c) => c.type === 0 || c.type === 5), [channels])

  async function save() {
    setSaving(true)
    try {
      await updateLevelingSettings(guildId, {
        enabled,
        levelupChannelId: computeChannelValue(channelMode, channelId),
        levelupMessageTemplate: template,
        notifyOnlyNewTier: onlyTier,
      })
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  return (
    <Block title={t("leveling.general.title")} description={t("leveling.general.description")}>
      <Toggle checked={enabled} onChange={setEnabled} label={t("leveling.general.enable")} />

      <Field label={t("leveling.general.channelLabel")}>
        <div className="flex gap-2">
          <select
            value={channelMode}
            onChange={(e) => setChannelMode(e.target.value as "channel" | "dm" | "disabled")}
            className="rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60"
          >
            <option value="channel">{t("leveling.general.modeChannel")}</option>
            <option value="dm">{t("leveling.general.modeDm")}</option>
            <option value="disabled">{t("leveling.general.modeDisabled")}</option>
          </select>
          {channelMode === "channel" && (
            <select
              value={channelId ?? ""}
              onChange={(e) => setChannelId(e.target.value || null)}
              className="flex-1 rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60"
            >
              <option value="">{t("leveling.general.pickChannel")}</option>
              {textChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </Field>

      <Field
        label={t("leveling.general.templateLabel")}
        hint={t("leveling.general.placeholdersHint", { list: PLACEHOLDER_KEYS.map((p) => p.key).join(", ") })}
      >
        <Textarea value={template} onChange={setTemplate} rows={2} />
      </Field>

      <Toggle checked={onlyTier} onChange={setOnlyTier} label={t("leveling.general.onlyTier")} />

      <div className="flex items-center gap-3 pt-2">
        <SaveButton dirty={dirty} saving={saving} onClick={save} />
        {savedAt && !dirty && <span className="text-xs text-emerald-400">{t("common.saved")}</span>}
      </div>
    </Block>
  )
}

function computeChannelValue(mode: "channel" | "dm" | "disabled", id: string | null): string | null {
  if (mode === "dm") return "dm"
  if (mode === "disabled") return null
  return id
}

// ────────────────────────────────────────────────────────────
// Block 2: XP Sources
// ────────────────────────────────────────────────────────────

function XpSourcesBlock({ guildId, initial }: { guildId: string; initial: LevelingSettings }) {
  const { t } = useTranslation()
  const [s, setS] = useState({
    chatXpEnabled: initial.chatXpEnabled,
    chatXpMin: initial.chatXpMin,
    chatXpMax: initial.chatXpMax,
    chatXpCooldown: initial.chatXpCooldown,
    chatXpMinLength: initial.chatXpMinLength,
    voiceXpEnabled: initial.voiceXpEnabled,
    voiceXpPerMinute: initial.voiceXpPerMinute,
    voiceXpMinUsers: initial.voiceXpMinUsers,
    voiceXpAfkMinutes: initial.voiceXpAfkMinutes,
  })
  const [saving, setSaving] = useState(false)
  const dirty =
    s.chatXpEnabled !== initial.chatXpEnabled ||
    s.chatXpMin !== initial.chatXpMin ||
    s.chatXpMax !== initial.chatXpMax ||
    s.chatXpCooldown !== initial.chatXpCooldown ||
    s.chatXpMinLength !== initial.chatXpMinLength ||
    s.voiceXpEnabled !== initial.voiceXpEnabled ||
    s.voiceXpPerMinute !== initial.voiceXpPerMinute ||
    s.voiceXpMinUsers !== initial.voiceXpMinUsers ||
    s.voiceXpAfkMinutes !== initial.voiceXpAfkMinutes

  async function save() {
    setSaving(true)
    try {
      await updateLevelingSettings(guildId, s)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Block title={t("leveling.sources.title")} description={t("leveling.sources.description")}>
      <Toggle
        checked={s.chatXpEnabled}
        onChange={(v) => setS({ ...s, chatXpEnabled: v })}
        label={t("leveling.sources.chatEnable")}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label={t("leveling.sources.chatMin")}>
          <NumberInput min={0} max={1000} value={s.chatXpMin} onChange={(v) => setS({ ...s, chatXpMin: v })} />
        </Field>
        <Field label={t("leveling.sources.chatMax")}>
          <NumberInput min={0} max={1000} value={s.chatXpMax} onChange={(v) => setS({ ...s, chatXpMax: v })} />
        </Field>
        <Field label={t("leveling.sources.chatCooldown")}>
          <NumberInput min={0} value={s.chatXpCooldown} onChange={(v) => setS({ ...s, chatXpCooldown: v })} />
        </Field>
        <Field label={t("leveling.sources.chatMinLength")}>
          <NumberInput min={0} value={s.chatXpMinLength} onChange={(v) => setS({ ...s, chatXpMinLength: v })} />
        </Field>
      </div>

      <Toggle
        checked={s.voiceXpEnabled}
        onChange={(v) => setS({ ...s, voiceXpEnabled: v })}
        label={t("leveling.sources.voiceEnable")}
      />
      <div className="grid grid-cols-3 gap-3">
        <Field label={t("leveling.sources.voicePerMin")}>
          <NumberInput min={0} max={1000} value={s.voiceXpPerMinute} onChange={(v) => setS({ ...s, voiceXpPerMinute: v })} />
        </Field>
        <Field label={t("leveling.sources.voiceMinUsers")}>
          <NumberInput min={1} max={99} value={s.voiceXpMinUsers} onChange={(v) => setS({ ...s, voiceXpMinUsers: v })} />
        </Field>
        <Field label={t("leveling.sources.voiceAfk")}>
          <NumberInput min={1} value={s.voiceXpAfkMinutes} onChange={(v) => setS({ ...s, voiceXpAfkMinutes: v })} />
        </Field>
      </div>

      <SaveButton dirty={dirty} saving={saving} onClick={save} />
    </Block>
  )
}

// ────────────────────────────────────────────────────────────
// Block 3: Tiers
// ────────────────────────────────────────────────────────────

function TiersBlock({ guildId, initial }: { guildId: string; initial: LevelingTier[] }) {
  const { t } = useTranslation()
  const [tiers, setTiers] = useState<LevelingTier[]>(initial)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const dirty = JSON.stringify(tiers) !== JSON.stringify(initial)

  function update(i: number, patch: Partial<LevelingTier>) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }
  function remove(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i))
  }
  function add() {
    const last = tiers[tiers.length - 1]
    const start = last ? last.endLevel + 1 : 1
    setTiers((prev) => [
      ...prev,
      {
        name: "New tier",
        emoji: null,
        iconUrl: null,
        startLevel: start,
        endLevel: start + 5,
        color: "#8b5cf6",
        levelupMessage: null,
        sortOrder: prev.length,
      },
    ])
  }

  async function save() {
    setSaving(true)
    try {
      const saved = await replaceLevelingTiers(guildId, tiers)
      setTiers(saved)
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    if (!confirm(t("leveling.tiers.confirmReset"))) return
    setSaving(true)
    try {
      const saved = await resetLevelingTiers(guildId)
      setTiers(saved)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Block title={t("leveling.tiers.title")} description={t("leveling.tiers.description")}>
      <div className="space-y-2">
        {tiers.map((tier, i) => {
          const open = expanded.has(i)
          return (
            <div key={i} className="rounded-lg border border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((s) => {
                      const next = new Set(s)
                      next.has(i) ? next.delete(i) : next.add(i)
                      return next
                    })
                  }
                  className="text-white/60 hover:text-white"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                </button>
                <span className="w-8 h-8 grid place-items-center rounded-md border border-white/10" style={{ backgroundColor: tier.color + "30" }}>
                  {tier.emoji ?? "✦"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{tier.name}</p>
                  <p className="text-[11px] text-white/40">
                    {t("leveling.tiers.levels", { start: tier.startLevel, end: tier.endLevel })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-white/40 hover:text-red-400"
                  title={t("leveling.tiers.deleteTip")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {open && (
                <div className="border-t border-white/5 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("leveling.tiers.name")}>
                      <TextInput value={tier.name} onChange={(v) => update(i, { name: v })} />
                    </Field>
                    <Field label="Emoji">
                      <TextInput value={tier.emoji ?? ""} onChange={(v) => update(i, { emoji: v || null })} />
                    </Field>
                    <Field label="Start level">
                      <NumberInput min={1} max={9999} value={tier.startLevel} onChange={(v) => update(i, { startLevel: v })} />
                    </Field>
                    <Field label="End level">
                      <NumberInput min={1} max={9999} value={tier.endLevel} onChange={(v) => update(i, { endLevel: v })} />
                    </Field>
                    <Field label={t("leveling.tiers.color")}>
                      <ColorInput value={tier.color} onChange={(v) => update(i, { color: v })} />
                    </Field>
                  </div>
                  <Field
                    label={t("leveling.tiers.milestoneLabel")}
                    hint={t("leveling.tiers.milestoneHint")}
                  >
                    <Textarea
                      value={tier.levelupMessage ?? ""}
                      onChange={(v) => update(i, { levelupMessage: v || null })}
                    />
                  </Field>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06]"
        >
          <Plus className="h-4 w-4" /> {t("leveling.tiers.add")}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06]"
        >
          <RefreshCw className="h-4 w-4" /> {t("leveling.tiers.resetDefault")}
        </button>
        <div className="flex-1" />
        <SaveButton dirty={dirty} saving={saving} onClick={save} label={t("leveling.tiers.saveLabel")} />
      </div>
    </Block>
  )
}

// ────────────────────────────────────────────────────────────
// Block 4: Role Rewards
// ────────────────────────────────────────────────────────────

function RoleRewardsBlock({
  guildId,
  initial,
  roles,
  limit,
  mode,
  onModeChange,
}: {
  guildId: string
  initial: RoleReward[]
  roles: GuildRole[]
  limit: number
  mode: "stack" | "replace"
  onModeChange: (m: "stack" | "replace") => Promise<void>
}) {
  const { t } = useTranslation()
  const [rewards, setRewards] = useState<RoleReward[]>(initial)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(rewards) !== JSON.stringify(initial)

  function update(i: number, patch: Partial<RoleReward>) {
    setRewards((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function remove(i: number) {
    setRewards((prev) => prev.filter((_, idx) => idx !== i))
  }
  function add() {
    const lastLevel = rewards.reduce((max, r) => Math.max(max, r.level), 0)
    setRewards((prev) => [...prev, { level: lastLevel + 5 || 5, roleId: "" }])
  }

  async function save() {
    setSaving(true)
    try {
      const saved = await replaceLevelingRoleRewards(
        guildId,
        rewards.filter((r) => r.roleId),
      )
      setRewards(saved)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Block title={t("leveling.rewards.title")} description={t("leveling.rewards.description", { limit })}>
      <Field label={t("leveling.rewards.mode")}>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onModeChange("stack")}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm text-left",
              mode === "stack" ? "border-violet-500 bg-violet-500/10 text-white" : "border-white/10 text-white/60 hover:bg-white/[0.04]",
            )}
          >
            <p className="font-medium">{t("leveling.rewards.stackTitle")}</p>
            <p className="text-[11px] text-white/50">{t("leveling.rewards.stackDesc")}</p>
          </button>
          <button
            type="button"
            onClick={() => onModeChange("replace")}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm text-left",
              mode === "replace" ? "border-violet-500 bg-violet-500/10 text-white" : "border-white/10 text-white/60 hover:bg-white/[0.04]",
            )}
          >
            <p className="font-medium">{t("leveling.rewards.replaceTitle")}</p>
            <p className="text-[11px] text-white/50">{t("leveling.rewards.replaceDesc")}</p>
          </button>
        </div>
      </Field>

      <div className="space-y-2">
        {rewards.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="flex gap-2 items-center">
            <span className="text-xs text-white/40 w-12 shrink-0">Lv</span>
            <NumberInput min={1} max={1000} value={r.level} onChange={(v) => update(i, { level: v })} />
            <select
              value={r.roleId}
              onChange={(e) => update(i, { roleId: e.target.value })}
              className="flex-[2] rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60"
            >
              <option value="">{t("leveling.rewards.pickRole")}</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => remove(i)} className="text-white/40 hover:text-red-400 px-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={rewards.length >= limit}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06] disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> {t("leveling.rewards.add")}
        </button>
        <div className="flex-1" />
        <SaveButton dirty={dirty} saving={saving} onClick={save} />
      </div>
    </Block>
  )
}

// ────────────────────────────────────────────────────────────
// Block 5: No XP Zones
// ────────────────────────────────────────────────────────────

function NoXpZonesBlock({
  guildId,
  roles,
  channels,
  initialRoles,
  initialTextChannels,
  initialVoiceChannels,
  ignored,
  onUnignore,
}: {
  guildId: string
  roles: GuildRole[]
  channels: Channel[]
  initialRoles: string[]
  initialTextChannels: string[]
  initialVoiceChannels: string[]
  ignored: { id: string; discordId: string }[]
  onUnignore: (discordId: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [selRoles, setSelRoles] = useState(new Set(initialRoles))
  const [selText, setSelText] = useState(new Set(initialTextChannels))
  const [selVoice, setSelVoice] = useState(new Set(initialVoiceChannels))
  const [saving, setSaving] = useState(false)

  const dirty =
    !setsEqual(selRoles, new Set(initialRoles)) ||
    !setsEqual(selText, new Set(initialTextChannels)) ||
    !setsEqual(selVoice, new Set(initialVoiceChannels))

  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)
  const voiceChannels = channels.filter((c) => c.type === 2 || c.type === 13)

  async function save() {
    setSaving(true)
    try {
      await replaceNoXpRoles(guildId, [...selRoles])
      await replaceNoXpChannels(guildId, { text: [...selText], voice: [...selVoice] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Block title={t("leveling.noXp.title")} description={t("leveling.noXp.description")}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("leveling.noXp.rolesLabel")} hint={t("leveling.noXp.rolesHint")}>
          <MultiPicker items={roles.map((r) => ({ id: r.id, label: r.name }))} selected={selRoles} onChange={setSelRoles} />
        </Field>
        <Field label={t("leveling.noXp.textLabel")}>
          <MultiPicker items={textChannels.map((c) => ({ id: c.id, label: "#" + c.name }))} selected={selText} onChange={setSelText} />
        </Field>
        <Field label={t("leveling.noXp.voiceLabel")} hint={t("leveling.noXp.voiceHint")}>
          <MultiPicker items={voiceChannels.map((c) => ({ id: c.id, label: "🔊 " + c.name }))} selected={selVoice} onChange={setSelVoice} />
        </Field>
        <div>
          <p className="text-xs font-medium text-white/70 mb-1.5">
            {t("leveling.noXp.ignoredTitle")} <span className="text-white/40">{t("leveling.noXp.ignoredManaged")}</span>
          </p>
          <div className="rounded-lg border border-white/10 bg-[#0e0e18] p-2 min-h-[100px] max-h-[200px] overflow-y-auto space-y-1">
            {ignored.length === 0 && <p className="text-xs text-white/40 px-1 py-2">{t("leveling.noXp.listEmpty")}</p>}
            {ignored.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-xs text-white/80 px-2 py-1">
                <span className="font-mono">{u.discordId}</span>
                <button
                  type="button"
                  onClick={() => onUnignore(u.discordId)}
                  className="text-white/40 hover:text-red-400"
                  title={t("leveling.noXp.removeIgnoredTip")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SaveButton dirty={dirty} saving={saving} onClick={save} />
    </Block>
  )
}

function MultiPicker({
  items,
  selected,
  onChange,
}: {
  items: { id: string; label: string }[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border border-white/10 bg-[#0e0e18] p-2 max-h-[160px] overflow-y-auto space-y-0.5">
      {items.length === 0 && <p className="text-xs text-white/40 px-1 py-2">{t("leveling.noXp.nothing")}</p>}
      {items.map((it) => {
        const checked = selected.has(it.id)
        return (
          <label
            key={it.id}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm",
              checked ? "bg-violet-500/15 text-white" : "text-white/80 hover:bg-white/[0.04]",
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                const next = new Set(selected)
                e.target.checked ? next.add(it.id) : next.delete(it.id)
                onChange(next)
              }}
              className="accent-violet-500"
            />
            <span className="truncate">{it.label}</span>
          </label>
        )
      })}
    </div>
  )
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

// ────────────────────────────────────────────────────────────
// Block 6: Rank Card (config only — preview lands with PNG backend)
// ────────────────────────────────────────────────────────────

function RankCardBlock({
  guildId,
  initial,
  channels,
}: {
  guildId: string
  initial: LevelingSettings
  channels: Channel[]
}) {
  const { t } = useTranslation()
  const [s, setS] = useState({
    rankBgImageUrl: initial.rankBgImageUrl,
    rankBgColor: initial.rankBgColor,
    rankOverlayOpacity: initial.rankOverlayOpacity,
    rankPrimaryTextColor: initial.rankPrimaryTextColor,
    rankSecondaryTextColor: initial.rankSecondaryTextColor,
    rankAccentColor: initial.rankAccentColor,
    rankProgressColor: initial.rankProgressColor,
    rankProgressBgColor: initial.rankProgressBgColor,
  })
  const [saving, setSaving] = useState(false)
  const dirty = (Object.keys(s) as (keyof typeof s)[]).some((k) => s[k] !== initial[k])

  // ── Live preview via the backend renderer ──
  // Debounced 500ms per spec so colour-picker drags don't fire a render per pixel.
  // Object-URL revoked on the next render to avoid blob leaks.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const handle = setTimeout(() => {
      setPreviewLoading(true)
      setPreviewError(null)
      fetchRankCardPreview(guildId, s)
        .then((blob) => {
          if (!alive) return
          const url = URL.createObjectURL(blob)
          // Replace the currently-shown URL via the updater so we can revoke
          // the previous one without a separate ref.
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return url
          })
        })
        .catch((e) => {
          if (!alive) return
          setPreviewError(e instanceof Error ? e.message : t("leveling.card.previewError"))
        })
        .finally(() => {
          if (alive) setPreviewLoading(false)
        })
    }, 500)
    return () => {
      alive = false
      clearTimeout(handle)
    }
  }, [guildId, s])

  // ── Test card sender ──
  const textChannels = useMemo(() => channels.filter((c) => c.type === 0 || c.type === 5), [channels])
  const [testChannelId, setTestChannelId] = useState<string>(textChannels[0]?.id ?? "")
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function send() {
    if (!testChannelId) return
    setSendingTest(true)
    setTestResult(null)
    try {
      await sendTestRankCard(guildId, testChannelId)
      setTestResult({ ok: true, text: t("leveling.card.testSent") })
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : t("leveling.card.sendError") })
    } finally {
      setSendingTest(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      await updateLevelingSettings(guildId, s)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setS({
      rankBgImageUrl: null,
      rankBgColor: "#1a1a1a",
      rankOverlayOpacity: 40,
      rankPrimaryTextColor: "#FFFFFF",
      rankSecondaryTextColor: "#B0B0B0",
      rankAccentColor: "#8b5cf6",
      rankProgressColor: "#8b5cf6",
      rankProgressBgColor: "rgba(255,255,255,0.2)",
    })
  }

  return (
    <Block title={t("leveling.card.title")} description={t("leveling.card.description")}>
      <Field label={t("leveling.card.bgImage")} hint={t("leveling.card.bgImageHint")}>
        <TextInput
          value={s.rankBgImageUrl ?? ""}
          onChange={(v) => setS({ ...s, rankBgImageUrl: v || null })}
          placeholder="https://..."
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("leveling.card.bgColor")}>
          <ColorInput value={s.rankBgColor} onChange={(v) => setS({ ...s, rankBgColor: v })} />
        </Field>
        <Field label={t("leveling.card.overlay")}>
          <NumberInput min={0} max={100} value={s.rankOverlayOpacity} onChange={(v) => setS({ ...s, rankOverlayOpacity: v })} />
        </Field>
        <Field label={t("leveling.card.primaryText")}>
          <ColorInput value={s.rankPrimaryTextColor} onChange={(v) => setS({ ...s, rankPrimaryTextColor: v })} />
        </Field>
        <Field label={t("leveling.card.secondaryText")}>
          <ColorInput value={s.rankSecondaryTextColor} onChange={(v) => setS({ ...s, rankSecondaryTextColor: v })} />
        </Field>
        <Field label={t("leveling.card.accent")}>
          <ColorInput value={s.rankAccentColor} onChange={(v) => setS({ ...s, rankAccentColor: v })} />
        </Field>
        <Field label={t("leveling.card.progress")}>
          <ColorInput value={s.rankProgressColor} onChange={(v) => setS({ ...s, rankProgressColor: v })} />
        </Field>
        <Field label={t("leveling.card.progressTrack")} hint={t("leveling.card.progressTrackHint")}>
          <TextInput value={s.rankProgressBgColor} onChange={(v) => setS({ ...s, rankProgressBgColor: v })} />
        </Field>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-white/40">{t("leveling.card.previewLabel")}</p>
          {previewLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
        </div>
        <div className="rounded-xl overflow-hidden bg-[#0e0e18] border border-white/5 min-h-[120px] flex items-center justify-center">
          {previewError ? (
            <p className="text-xs text-red-400 p-4">{previewError}</p>
          ) : previewUrl ? (
            <img src={previewUrl} alt="Rank card preview" className="w-full block" />
          ) : (
            <p className="text-xs text-white/40 p-4">{t("leveling.card.previewLoading")}</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
        <p className="text-xs font-medium text-white/70">{t("leveling.card.testTitle")}</p>
        <div className="flex gap-2 items-stretch">
          <select
            value={testChannelId}
            onChange={(e) => setTestChannelId(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60"
          >
            <option value="">{t("leveling.general.pickChannel")}</option>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={send}
            disabled={!testChannelId || sendingTest}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("leveling.card.send")}
          </button>
        </div>
        {testResult && (
          <p className={cn("text-xs", testResult.ok ? "text-emerald-400" : "text-red-400")}>
            {testResult.text}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06]"
        >
          <RefreshCw className="h-4 w-4" /> {t("leveling.tiers.resetDefault")}
        </button>
        <div className="flex-1" />
        <SaveButton dirty={dirty} saving={saving} onClick={save} />
      </div>
    </Block>
  )
}

// ────────────────────────────────────────────────────────────
// Block 7: Advanced
// ────────────────────────────────────────────────────────────

function AdvancedBlock({ guildId }: { guildId: string }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<"recalc" | "wipe" | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function recalc() {
    setBusy("recalc")
    setResult(null)
    try {
      const r = await recalcLeveling(guildId)
      setResult(t("leveling.advanced.recalcResult", { n: r.updated }))
    } finally {
      setBusy(null)
    }
  }

  async function wipe() {
    if (!confirm(t("leveling.advanced.confirmWipe1"))) return
    if (!confirm(t("leveling.advanced.confirmWipe2"))) return
    setBusy("wipe")
    setResult(null)
    try {
      const r = await wipeLeveling(guildId)
      setResult(t("leveling.advanced.wipeResult", { n: r.affected }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Block title={t("leveling.advanced.title")} description={t("leveling.advanced.description")}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={recalc}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06] disabled:opacity-50"
        >
          {busy === "recalc" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t("leveling.advanced.recalc")}
        </button>
        <a
          href={levelingCsvExportUrl(guildId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06]"
        >
          <Download className="h-4 w-4" /> {t("leveling.advanced.exportCsv")}
        </a>
        <button
          type="button"
          onClick={wipe}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 disabled:opacity-50"
        >
          {busy === "wipe" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {t("leveling.advanced.wipe")}
        </button>
      </div>
      {result && <p className="text-xs text-emerald-400">{result}</p>}
    </Block>
  )
}

// ────────────────────────────────────────────────────────────
// Block 8: Command permissions (Misha TZ pt.2 §6)
// ────────────────────────────────────────────────────────────

function PermissionsBlock({
  guildId,
  roles,
}: {
  guildId: string
  roles: GuildRole[]
}) {
  const { t } = useTranslation()
  const [data, setData] = useState<LevelingPermissionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Per-row "saving…" indicator + last-save error. Keyed by command so two
  // rows can be edited in parallel without one overwriting the other's state.
  const [savingCmd, setSavingCmd] = useState<LevelingCommandKey | null>(null)
  const [rowErrors, setRowErrors] = useState<Partial<Record<LevelingCommandKey, string>>>({})

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    getLevelingPermissions(guildId)
      .then((r) => {
        if (alive) setData(r)
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : t("leveling.permissions.loadError"))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [guildId, t])

  async function persist(
    command: LevelingCommandKey,
    next: { mode: LevelingPermMode; allowedRoleIds: string[] },
  ) {
    setSavingCmd(command)
    setRowErrors((p) => ({ ...p, [command]: undefined }))
    try {
      const saved = await setLevelingPermission(guildId, command, next)
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          permissions: prev.permissions.map((p) => (p.command === command ? saved : p)),
        }
      })
    } catch (e) {
      setRowErrors((p) => ({
        ...p,
        [command]: e instanceof Error ? e.message : t("leveling.permissions.saveError"),
      }))
    } finally {
      setSavingCmd(null)
    }
  }

  return (
    <Block
      title={t("leveling.permissions.title")}
      description={t("leveling.permissions.description")}
    >
      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-white/40" />
        </div>
      )}
      {error && !loading && (
        <p className="text-sm text-red-300">{error}</p>
      )}
      {data && !loading && (
        <div className="space-y-2">
          {data.commands.map(({ command, defaultMode }) => {
            const row =
              data.permissions.find((p) => p.command === command) ??
              ({ command, mode: defaultMode, allowedRoleIds: [] } as LevelingCommandPermission)
            return (
              <PermissionRow
                key={command}
                command={command}
                defaultMode={defaultMode}
                row={row}
                roles={roles}
                saving={savingCmd === command}
                rowError={rowErrors[command]}
                onChange={(next) => void persist(command, next)}
              />
            )
          })}
        </div>
      )}
    </Block>
  )
}

function PermissionRow({
  command,
  defaultMode,
  row,
  roles,
  saving,
  rowError,
  onChange,
}: {
  command: LevelingCommandKey
  defaultMode: LevelingPermMode
  row: LevelingCommandPermission
  roles: GuildRole[]
  saving: boolean
  rowError: string | undefined
  onChange: (next: { mode: LevelingPermMode; allowedRoleIds: string[] }) => void
}) {
  const { t } = useTranslation()
  const isDefault = row.mode === defaultMode && row.allowedRoleIds.length === 0

  function changeMode(mode: LevelingPermMode) {
    if (mode === row.mode && mode !== "roles") return
    onChange({ mode, allowedRoleIds: mode === "roles" ? row.allowedRoleIds : [] })
  }

  function toggleRole(roleId: string) {
    const next = new Set(row.allowedRoleIds)
    if (next.has(roleId)) next.delete(roleId)
    else next.add(roleId)
    onChange({ mode: "roles", allowedRoleIds: [...next] })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <code className="text-sm font-mono text-white">
          {t(`leveling.permissions.commands.${command}`)}
        </code>
        {isDefault && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-white/40">
            {t("leveling.permissions.defaultBadge")}
          </span>
        )}
        <div className="flex-1" />
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
      </div>

      <div className="flex gap-2 flex-wrap">
        <ModeButton
          active={row.mode === "everyone"}
          label={t("leveling.permissions.modeEveryone")}
          onClick={() => changeMode("everyone")}
        />
        <ModeButton
          active={row.mode === "admins"}
          label={t("leveling.permissions.modeAdmins")}
          onClick={() => changeMode("admins")}
        />
        <ModeButton
          active={row.mode === "roles"}
          label={t("leveling.permissions.modeRoles")}
          onClick={() => changeMode("roles")}
        />
      </div>

      {row.mode === "roles" && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-white/40">
            {t("leveling.permissions.rolesHeader")}
          </p>
          <div className="rounded-lg border border-white/10 bg-[#0e0e18] p-2 max-h-[160px] overflow-y-auto space-y-0.5">
            {roles.length === 0 && (
              <p className="text-xs text-white/40 px-1 py-2">
                {t("leveling.permissions.rolesPlaceholder")}
              </p>
            )}
            {roles.map((r) => {
              const checked = row.allowedRoleIds.includes(r.id)
              return (
                <label
                  key={r.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm",
                    checked ? "bg-violet-500/15 text-white" : "text-white/80 hover:bg-white/[0.04]",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRole(r.id)}
                    className="accent-violet-500"
                  />
                  <span className="truncate">{r.name}</span>
                </label>
              )
            })}
          </div>
          {row.allowedRoleIds.length === 0 && (
            <p className="text-[11px] text-amber-300/80">{t("leveling.permissions.noRoles")}</p>
          )}
        </div>
      )}

      {rowError && <p className="text-xs text-red-300">{rowError}</p>}
    </div>
  )
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
        active
          ? "border-violet-500 bg-violet-500/15 text-white"
          : "border-white/10 text-white/60 hover:bg-white/[0.04]",
      )}
    >
      {label}
    </button>
  )
}

// ────────────────────────────────────────────────────────────
// Audit log (xp_events_log)
// ────────────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS: { value: XpEventType; label: string; color: string }[] = [
  { value: "chat", label: "Chat", color: "bg-blue-500/20 text-blue-300" },
  { value: "voice", label: "Voice", color: "bg-cyan-500/20 text-cyan-300" },
  { value: "admin_give", label: "Admin +", color: "bg-emerald-500/20 text-emerald-300" },
  { value: "admin_remove", label: "Admin −", color: "bg-amber-500/20 text-amber-300" },
  { value: "admin_set", label: "Admin set", color: "bg-violet-500/20 text-violet-300" },
  { value: "admin_reset", label: "Reset", color: "bg-red-500/20 text-red-300" },
]

const AUDIT_PAGE_SIZE = 25

function AuditLogBlock({ guildId }: { guildId: string }) {
  const { t } = useTranslation()
  const [events, setEvents] = useState<LevelingEvent[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [userFilter, setUserFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState<Set<XpEventType>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(nextOffset = offset) {
    setLoading(true)
    setError(null)
    try {
      const res = await getLevelingEvents(guildId, {
        userId: userFilter.trim() || undefined,
        types: typeFilter.size ? [...typeFilter] : undefined,
        limit: AUDIT_PAGE_SIZE,
        offset: nextOffset,
      })
      setEvents(res.events)
      setTotal(res.total)
      setOffset(nextOffset)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("leveling.loadError"))
    } finally {
      setLoading(false)
    }
  }

  // Initial load + reload when filters change. Reset to page 1 on filter edit.
  useEffect(() => {
    void load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, userFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE))
  const currentPage = Math.floor(offset / AUDIT_PAGE_SIZE) + 1

  return (
    <Block title={t("leveling.audit.title")} description={t("leveling.audit.description")}>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={userFilter}
          placeholder={t("leveling.audit.userIdPlaceholder")}
          onChange={(e) => setUserFilter(e.target.value)}
          className="w-64 rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-1.5 text-sm font-mono text-white outline-none focus:border-violet-500/60"
        />
        <div className="flex flex-wrap gap-1">
          {EVENT_TYPE_OPTIONS.map((opt) => {
            const active = typeFilter.has(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setTypeFilter((s) => {
                    const next = new Set(s)
                    next.has(opt.value) ? next.delete(opt.value) : next.add(opt.value)
                    return next
                  })
                }}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                  active
                    ? "border-violet-500 bg-violet-500/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => load(offset)}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs hover:bg-white/[0.06] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t("leveling.audit.refresh")}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      <div className="rounded-lg border border-white/10 bg-[#0e0e18] overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-white/40 border-b border-white/5">
            <tr>
              <th className="text-left font-medium px-3 py-2">{t("leveling.audit.colTime")}</th>
              <th className="text-left font-medium px-3 py-2">{t("leveling.audit.colUser")}</th>
              <th className="text-left font-medium px-3 py-2">{t("leveling.audit.colType")}</th>
              <th className="text-right font-medium px-3 py-2">XP</th>
              <th className="text-right font-medium px-3 py-2">Total</th>
              <th className="text-right font-medium px-3 py-2">Lv</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center text-white/40 px-3 py-6">
                  {t("leveling.audit.noEvents")}
                </td>
              </tr>
            )}
            {events.map((e) => {
              const meta = EVENT_TYPE_OPTIONS.find((o) => o.value === e.eventType)
              return (
                <tr key={e.id} className="border-b border-white/5 last:border-b-0">
                  <td className="px-3 py-1.5 text-white/60 whitespace-nowrap">{formatRelativeTime(e.createdAt)}</td>
                  <td className="px-3 py-1.5 font-mono text-white/70">{e.discordId}</td>
                  <td className="px-3 py-1.5">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium", meta?.color ?? "bg-white/10 text-white/60")}>
                      {meta?.label ?? e.eventType}
                    </span>
                  </td>
                  <td className={cn("px-3 py-1.5 text-right font-mono", e.xpAmount >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {e.xpAmount >= 0 ? "+" : ""}
                    {e.xpAmount.toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-white/80">
                    {Number(e.newTotal).toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-1.5 text-right text-white/80">{e.newLevel}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-xs text-white/50">
        <button
          type="button"
          onClick={() => load(Math.max(0, offset - AUDIT_PAGE_SIZE))}
          disabled={loading || offset === 0}
          className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 hover:bg-white/[0.06] disabled:opacity-40"
        >
          {t("leveling.audit.prev")}
        </button>
        <span>
          {t("leveling.audit.pageInfo", { current: currentPage, total: totalPages, n: total.toLocaleString("en-US") })}
        </span>
        <button
          type="button"
          onClick={() => load(offset + AUDIT_PAGE_SIZE)}
          disabled={loading || offset + AUDIT_PAGE_SIZE >= total}
          className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 hover:bg-white/[0.06] disabled:opacity-40"
        >
          {t("leveling.audit.next")}
        </button>
      </div>
    </Block>
  )
}

/** Tiny relative-time formatter — avoids pulling a dep just for "5 min ago". */
function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const t = new Date(iso).getTime()
  const diff = Math.max(0, now - t)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

// ────────────────────────────────────────────────────────────

function normalizeHex(s: string): string {
  if (/^#[0-9a-f]{6}$/i.test(s)) return s
  if (/^#[0-9a-f]{3}$/i.test(s)) return "#" + s.slice(1).split("").map((c) => c + c).join("")
  return "#000000"
}
