import { useEffect, useState } from "react"
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import {
  getTemplateLeveling,
  replaceTemplateLevelingRoleRewards,
  replaceTemplateLevelingTiers,
  replaceTemplateNoXpChannels,
  replaceTemplateNoXpRoles,
  resetTemplateLevelingTiers,
  toggleTemplateLevelingEnabled,
  updateTemplateLevelingSettings,
  wipeTemplateLeveling,
  type Channel,
  type GuildRole,
  type TemplateLevelingSettings,
  type TemplateLevelingState,
  type TemplateLevelingTier,
  type TemplateRoleReward,
} from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * Owner-admin leveling section for the ServerTemplate editor.
 *
 * Two big differences from the per-guild leveling page:
 *  1. Roles & channels are stored by NAME — the install step on the buyer's
 *     guild resolves names → ids. We surface a separate list of "live" names
 *     from a real guild as autocomplete suggestions but the source of truth
 *     is whatever the owner-admin types.
 *  2. No live rank-card PNG preview here. The card is rendered against real
 *     user data + a real guild, neither of which exists in this context.
 *     The buyer sees the live preview in their own dashboard post-install.
 */
export function SectionLeveling({
  templateId,
  liveRoles,
  liveChannels,
}: {
  templateId: string
  liveRoles: GuildRole[]
  liveChannels: Channel[]
}) {
  const [state, setState] = useState<TemplateLevelingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await getTemplateLeveling(templateId)
      setState(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Loading error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            Система прокачки уровней
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Дополнительная фича шаблона. Эти настройки применятся к серверу клиента только при auto-deploy. Сам шаблон XP не накапливает.
          </p>
        </div>
        {state && (
          <MasterToggle
            templateId={templateId}
            enabled={state.enabled}
            onChange={(en) => setState((s) => (s ? { ...s, enabled: en } : s))}
          />
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-white/40" />
        </div>
      )}
      {error && !loading && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {!loading && !error && state && (
        <div className={cn("space-y-5", !state.enabled && "opacity-60")}>
          {!state.enabled && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Leveling выключен — настройки ниже сохраняются, но при установке шаблона на клиентский сервер не применятся, пока не включишь тумблер сверху.
              </span>
            </div>
          )}

          <GeneralSubblock
            templateId={templateId}
            initial={state.settings}
            liveChannels={liveChannels}
            onSaved={(next) => setState((s) => (s ? { ...s, settings: { ...s.settings, ...next } } : s))}
          />
          <XpSourcesSubblock
            templateId={templateId}
            initial={state.settings}
            onSaved={(next) => setState((s) => (s ? { ...s, settings: { ...s.settings, ...next } } : s))}
          />
          <TiersSubblock
            templateId={templateId}
            initial={state.tiers}
            onSaved={(next) => setState((s) => (s ? { ...s, tiers: next } : s))}
          />
          <RoleRewardsSubblock
            templateId={templateId}
            initial={state.rewards}
            liveRoles={liveRoles}
            mode={state.settings.roleRewardsMode}
            onModeChange={async (mode) => {
              const updated = await updateTemplateLevelingSettings(templateId, { roleRewardsMode: mode })
              setState((s) => (s ? { ...s, settings: updated } : s))
            }}
            onSaved={(next) => setState((s) => (s ? { ...s, rewards: next } : s))}
          />
          <NoXpZonesSubblock
            templateId={templateId}
            initialRoles={state.noXpRoles.map((r) => r.roleName)}
            initialText={state.noXpChannels.filter((c) => c.channelType === "text").map((c) => c.channelName)}
            initialVoice={state.noXpChannels.filter((c) => c.channelType === "voice").map((c) => c.channelName)}
            liveRoles={liveRoles}
            liveChannels={liveChannels}
            onSaved={reload}
          />
          <RankCardSubblock
            templateId={templateId}
            initial={state.settings}
            onSaved={(next) => setState((s) => (s ? { ...s, settings: { ...s.settings, ...next } } : s))}
          />

          <div className="flex justify-end pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Сбросить ВСЕ leveling-настройки этого шаблона? Tier'ы, награды, исключения, визуал — всё удалится.")) return
                await wipeTemplateLeveling(templateId)
                await reload()
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" /> Сбросить весь leveling шаблона
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// ────────────────────────────────────────────────────────────
// Primitives (mirrored from leveling-page.tsx; small + standalone)
// ────────────────────────────────────────────────────────────

function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && <p className="text-[11px] text-white/45 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-white/65">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-white/40">{hint}</span>}
    </label>
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-md border border-white/10 bg-[#0e0e18] px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-500/60"
    />
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  list,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  list?: string
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      list={list}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-white/10 bg-[#0e0e18] px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-500/60"
    />
  )
}

function Textarea({
  value,
  onChange,
  rows,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <textarea
      value={value}
      rows={rows ?? 2}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-white/10 bg-[#0e0e18] px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-500/60 resize-y"
    />
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5">
      <input
        type="color"
        value={normalizeHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 rounded-md border border-white/10 bg-transparent cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md border border-white/10 bg-[#0e0e18] px-2.5 py-1 text-xs font-mono text-white outline-none focus:border-violet-500/60"
      />
    </div>
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
        "flex items-center gap-2.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs w-full text-left",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "hover:bg-white/[0.06]",
      )}
    >
      <span className={cn("relative inline-flex w-8 h-4 rounded-full transition-colors shrink-0", checked ? "bg-violet-500" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform", checked && "translate-x-4")} />
      </span>
      <span className="text-white/85">{label}</span>
    </button>
  )
}

function SaveBtn({
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
  return (
    <button
      type="button"
      disabled={!dirty || saving}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
        dirty && !saving
          ? "bg-violet-600 hover:bg-violet-500 text-white"
          : "bg-white/5 text-white/40 cursor-not-allowed",
      )}
    >
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {label ?? "Сохранить"}
    </button>
  )
}

function normalizeHex(s: string): string {
  if (/^#[0-9a-f]{6}$/i.test(s)) return s
  if (/^#[0-9a-f]{3}$/i.test(s)) return "#" + s.slice(1).split("").map((c) => c + c).join("")
  return "#000000"
}

// ────────────────────────────────────────────────────────────
// Master toggle (PATCH /enabled — fires immediately, no save button)
// ────────────────────────────────────────────────────────────

function MasterToggle({
  templateId,
  enabled,
  onChange,
}: {
  templateId: string
  enabled: boolean
  onChange: (next: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        const next = !enabled
        setBusy(true)
        // Optimistic flip; rollback on error
        onChange(next)
        try {
          await toggleTemplateLevelingEnabled(templateId, next)
        } catch {
          onChange(!next)
        } finally {
          setBusy(false)
        }
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium shrink-0",
        enabled
          ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
          : "border-white/10 bg-white/[0.03] text-white/60",
      )}
    >
      <span className={cn("relative inline-flex w-7 h-4 rounded-full transition-colors", enabled ? "bg-violet-500" : "bg-white/20")}>
        <span className={cn("absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform", enabled && "translate-x-3")} />
      </span>
      {busy ? "…" : enabled ? "Leveling включён в шаблоне" : "Leveling выключен"}
    </button>
  )
}

// ────────────────────────────────────────────────────────────
// Subblock 1: General
// ────────────────────────────────────────────────────────────

function GeneralSubblock({
  templateId,
  initial,
  liveChannels,
  onSaved,
}: {
  templateId: string
  initial: TemplateLevelingSettings
  liveChannels: Channel[]
  onSaved: (next: TemplateLevelingSettings) => void
}) {
  const [channelMode, setChannelMode] = useState(initial.levelupChannelMode)
  const [channelName, setChannelName] = useState(initial.levelupChannelName ?? "")
  const [template, setTemplate] = useState(initial.levelupMessageTemplate)
  const [onlyTier, setOnlyTier] = useState(initial.notifyOnlyNewTier)
  const [saving, setSaving] = useState(false)
  const dirty =
    channelMode !== initial.levelupChannelMode ||
    (channelName || null) !== initial.levelupChannelName ||
    template !== initial.levelupMessageTemplate ||
    onlyTier !== initial.notifyOnlyNewTier

  async function save() {
    setSaving(true)
    try {
      const next = await updateTemplateLevelingSettings(templateId, {
        levelupChannelMode: channelMode,
        levelupChannelName: channelName.trim() || null,
        levelupMessageTemplate: template,
        notifyOnlyNewTier: onlyTier,
      })
      onSaved(next)
    } finally {
      setSaving(false)
    }
  }

  const textChannelNames = liveChannels.filter((c) => c.type === 0 || c.type === 5).map((c) => c.name)

  return (
    <Card title="Общее" description="Канал level-up (по ИМЕНИ) и шаблон сообщения">
      <Field label="Куда отправлять level-up сообщения">
        <div className="flex gap-2">
          <select
            value={channelMode}
            onChange={(e) => setChannelMode(e.target.value as "channel" | "dm" | "disabled")}
            className="rounded-md border border-white/10 bg-[#0e0e18] px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-500/60"
          >
            <option value="channel">Канал</option>
            <option value="dm">DM</option>
            <option value="disabled">Не отправлять</option>
          </select>
          {channelMode === "channel" && (
            <TextInput
              value={channelName}
              onChange={setChannelName}
              placeholder="имя канала (например: level-ups)"
              list="leveling-text-channel-suggestions"
            />
          )}
        </div>
        <datalist id="leveling-text-channel-suggestions">
          {textChannelNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </Field>

      <Field label="Шаблон обычного level-up сообщения" hint="Плейсхолдеры: {user}, {user_name}, {level}, {old_level}, {tier}, {server}">
        <Textarea value={template} onChange={setTemplate} rows={2} />
      </Field>

      <Toggle checked={onlyTier} onChange={setOnlyTier} label="Уведомлять только при переходе в новый tier" />

      <div className="flex justify-end">
        <SaveBtn dirty={dirty} saving={saving} onClick={save} />
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// Subblock 2: XP Sources
// ────────────────────────────────────────────────────────────

function XpSourcesSubblock({
  templateId,
  initial,
  onSaved,
}: {
  templateId: string
  initial: TemplateLevelingSettings
  onSaved: (next: TemplateLevelingSettings) => void
}) {
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
  const dirty = (Object.keys(s) as (keyof typeof s)[]).some((k) => s[k] !== initial[k])

  async function save() {
    setSaving(true)
    try {
      const next = await updateTemplateLevelingSettings(templateId, s)
      onSaved(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Источники XP">
      <Toggle checked={s.chatXpEnabled} onChange={(v) => setS({ ...s, chatXpEnabled: v })} label="Chat XP" />
      <div className="grid grid-cols-4 gap-2">
        <Field label="Min XP">
          <NumberInput min={0} max={1000} value={s.chatXpMin} onChange={(v) => setS({ ...s, chatXpMin: v })} />
        </Field>
        <Field label="Max XP">
          <NumberInput min={0} max={1000} value={s.chatXpMax} onChange={(v) => setS({ ...s, chatXpMax: v })} />
        </Field>
        <Field label="Cooldown (s)">
          <NumberInput min={0} value={s.chatXpCooldown} onChange={(v) => setS({ ...s, chatXpCooldown: v })} />
        </Field>
        <Field label="Min длина">
          <NumberInput min={0} value={s.chatXpMinLength} onChange={(v) => setS({ ...s, chatXpMinLength: v })} />
        </Field>
      </div>

      <Toggle checked={s.voiceXpEnabled} onChange={(v) => setS({ ...s, voiceXpEnabled: v })} label="Voice XP" />
      <div className="grid grid-cols-3 gap-2">
        <Field label="XP / минуту">
          <NumberInput min={0} max={1000} value={s.voiceXpPerMinute} onChange={(v) => setS({ ...s, voiceXpPerMinute: v })} />
        </Field>
        <Field label="Min людей">
          <NumberInput min={1} max={99} value={s.voiceXpMinUsers} onChange={(v) => setS({ ...s, voiceXpMinUsers: v })} />
        </Field>
        <Field label="AFK (мин)">
          <NumberInput min={1} value={s.voiceXpAfkMinutes} onChange={(v) => setS({ ...s, voiceXpAfkMinutes: v })} />
        </Field>
      </div>

      <div className="flex justify-end">
        <SaveBtn dirty={dirty} saving={saving} onClick={save} />
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// Subblock 3: Tiers
// ────────────────────────────────────────────────────────────

function TiersSubblock({
  templateId,
  initial,
  onSaved,
}: {
  templateId: string
  initial: TemplateLevelingTier[]
  onSaved: (next: TemplateLevelingTier[]) => void
}) {
  const [tiers, setTiers] = useState<TemplateLevelingTier[]>(initial)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(tiers) !== JSON.stringify(initial)

  function update(i: number, patch: Partial<TemplateLevelingTier>) {
    setTiers((p) => p.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }
  function remove(i: number) {
    setTiers((p) => p.filter((_, idx) => idx !== i))
  }
  function add() {
    const last = tiers[tiers.length - 1]
    const start = last ? last.endLevel + 1 : 1
    setTiers((p) => [
      ...p,
      {
        name: "New tier",
        emoji: null,
        iconUrl: null,
        startLevel: start,
        endLevel: start + 5,
        color: "#8b5cf6",
        levelupMessage: null,
        sortOrder: p.length,
      },
    ])
  }
  async function save() {
    setSaving(true)
    try {
      const next = await replaceTemplateLevelingTiers(templateId, tiers)
      setTiers(next)
      onSaved(next)
    } finally {
      setSaving(false)
    }
  }
  async function reset() {
    if (!confirm("Сбросить tier'ы к дефолту?")) return
    setSaving(true)
    try {
      const next = await resetTemplateLevelingTiers(templateId)
      setTiers(next)
      onSaved(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Tier'ы (звания)" description="Сначала засеяны дефолтные 7 уровней. Меняй имена, диапазоны, цвета и milestone-сообщения.">
      <div className="space-y-1.5">
        {tiers.map((t, i) => {
          const isOpen = open.has(i)
          return (
            <div key={i} className="rounded-md border border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2 p-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpen((s) => {
                      const next = new Set(s)
                      next.has(i) ? next.delete(i) : next.add(i)
                      return next
                    })
                  }
                  className="text-white/50 hover:text-white"
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                </button>
                <span
                  className="w-6 h-6 grid place-items-center rounded text-xs border border-white/10"
                  style={{ backgroundColor: t.color + "30" }}
                >
                  {t.emoji ?? "✦"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{t.name}</p>
                  <p className="text-[10px] text-white/40">
                    Уровни {t.startLevel}–{t.endLevel}
                  </p>
                </div>
                <button type="button" onClick={() => remove(i)} className="text-white/30 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {isOpen && (
                <div className="border-t border-white/5 p-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Название">
                      <TextInput value={t.name} onChange={(v) => update(i, { name: v })} />
                    </Field>
                    <Field label="Emoji">
                      <TextInput value={t.emoji ?? ""} onChange={(v) => update(i, { emoji: v || null })} />
                    </Field>
                    <Field label="Start level">
                      <NumberInput min={1} max={9999} value={t.startLevel} onChange={(v) => update(i, { startLevel: v })} />
                    </Field>
                    <Field label="End level">
                      <NumberInput min={1} max={9999} value={t.endLevel} onChange={(v) => update(i, { endLevel: v })} />
                    </Field>
                    <Field label="Цвет">
                      <ColorInput value={t.color} onChange={(v) => update(i, { color: v })} />
                    </Field>
                  </div>
                  <Field label="Tier milestone сообщение" hint="Опционально. Шлётся вместо обычного при переходе в этот tier.">
                    <Textarea value={t.levelupMessage ?? ""} onChange={(v) => update(i, { levelupMessage: v || null })} />
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
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs hover:bg-white/[0.06]"
        >
          <Plus className="h-3.5 w-3.5" /> Добавить tier
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/[0.06]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Дефолт
        </button>
        <div className="flex-1" />
        <SaveBtn dirty={dirty} saving={saving} onClick={save} label="Сохранить tier'ы" />
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// Subblock 4: Role rewards (role NAME)
// ────────────────────────────────────────────────────────────

function RoleRewardsSubblock({
  templateId,
  initial,
  liveRoles,
  mode,
  onModeChange,
  onSaved,
}: {
  templateId: string
  initial: TemplateRoleReward[]
  liveRoles: GuildRole[]
  mode: "stack" | "replace"
  onModeChange: (m: "stack" | "replace") => void | Promise<void>
  onSaved: (next: TemplateRoleReward[]) => void
}) {
  const [rewards, setRewards] = useState<TemplateRoleReward[]>(initial)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(rewards) !== JSON.stringify(initial)

  function update(i: number, patch: Partial<TemplateRoleReward>) {
    setRewards((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function remove(i: number) {
    setRewards((p) => p.filter((_, idx) => idx !== i))
  }
  function add() {
    const last = rewards.reduce((mx, r) => Math.max(mx, r.level), 0)
    setRewards((p) => [...p, { level: last + 5 || 5, roleName: "" }])
  }
  async function save() {
    setSaving(true)
    try {
      const next = await replaceTemplateLevelingRoleRewards(
        templateId,
        rewards.filter((r) => r.roleName.trim()),
      )
      setRewards(next)
      onSaved(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title="Награды ролями"
      description="Роли по ИМЕНИ. При установке шаблона на клиентский сервер ищется реальная роль с таким именем — если не нашли, награда пропускается."
    >
      <Field label="Режим">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onModeChange("stack")}
            className={cn(
              "flex-1 rounded-md border px-2.5 py-1.5 text-xs text-left",
              mode === "stack" ? "border-violet-500 bg-violet-500/10 text-white" : "border-white/10 text-white/60 hover:bg-white/[0.04]",
            )}
          >
            <p className="font-medium">Stack</p>
            <p className="text-[10px] text-white/50">Все роли по дороге</p>
          </button>
          <button
            type="button"
            onClick={() => onModeChange("replace")}
            className={cn(
              "flex-1 rounded-md border px-2.5 py-1.5 text-xs text-left",
              mode === "replace" ? "border-violet-500 bg-violet-500/10 text-white" : "border-white/10 text-white/60 hover:bg-white/[0.04]",
            )}
          >
            <p className="font-medium">Replace</p>
            <p className="text-[10px] text-white/50">Только наивысшая</p>
          </button>
        </div>
      </Field>

      <div className="space-y-1.5">
        {rewards.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="flex gap-1.5 items-center">
            <span className="text-[10px] text-white/40 w-7 shrink-0">Lv</span>
            <NumberInput min={1} max={1000} value={r.level} onChange={(v) => update(i, { level: v })} />
            <TextInput
              value={r.roleName}
              onChange={(v) => update(i, { roleName: v })}
              placeholder="имя роли"
              list="leveling-role-suggestions"
            />
            <button type="button" onClick={() => remove(i)} className="text-white/40 hover:text-red-400 px-1">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <datalist id="leveling-role-suggestions">
          {liveRoles.map((r) => (
            <option key={r.id} value={r.name} />
          ))}
        </datalist>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs hover:bg-white/[0.06]"
        >
          <Plus className="h-3.5 w-3.5" /> Добавить
        </button>
        <div className="flex-1" />
        <SaveBtn dirty={dirty} saving={saving} onClick={save} />
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// Subblock 5: No XP zones (names + suggestions)
// ────────────────────────────────────────────────────────────

function NoXpZonesSubblock({
  templateId,
  initialRoles,
  initialText,
  initialVoice,
  liveRoles,
  liveChannels,
  onSaved,
}: {
  templateId: string
  initialRoles: string[]
  initialText: string[]
  initialVoice: string[]
  liveRoles: GuildRole[]
  liveChannels: Channel[]
  onSaved: () => void
}) {
  const [roleNames, setRoleNames] = useState<string[]>(initialRoles)
  const [textNames, setTextNames] = useState<string[]>(initialText)
  const [voiceNames, setVoiceNames] = useState<string[]>(initialVoice)
  const [saving, setSaving] = useState(false)
  const dirty =
    JSON.stringify(roleNames) !== JSON.stringify(initialRoles) ||
    JSON.stringify(textNames) !== JSON.stringify(initialText) ||
    JSON.stringify(voiceNames) !== JSON.stringify(initialVoice)

  async function save() {
    setSaving(true)
    try {
      await replaceTemplateNoXpRoles(templateId, roleNames)
      await replaceTemplateNoXpChannels(templateId, { text: textNames, voice: voiceNames })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const textChannelNames = liveChannels.filter((c) => c.type === 0 || c.type === 5).map((c) => c.name)
  const voiceChannelNames = liveChannels.filter((c) => c.type === 2 || c.type === 13).map((c) => c.name)

  return (
    <Card
      title="Исключения"
      description="Списки имён ролей и каналов. При установке резолвятся по имени — если нет, пропускается."
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Роли без XP">
          <NameList items={roleNames} onChange={setRoleNames} suggestions={liveRoles.map((r) => r.name)} suggestionListId="leveling-noxp-roles-sug" />
        </Field>
        <Field label="Текстовые каналы без XP">
          <NameList items={textNames} onChange={setTextNames} suggestions={textChannelNames} suggestionListId="leveling-noxp-text-sug" />
        </Field>
        <Field label="Голосовые каналы без XP">
          <NameList items={voiceNames} onChange={setVoiceNames} suggestions={voiceChannelNames} suggestionListId="leveling-noxp-voice-sug" />
        </Field>
      </div>

      <div className="flex justify-end">
        <SaveBtn dirty={dirty} saving={saving} onClick={save} />
      </div>
    </Card>
  )
}

function NameList({
  items,
  onChange,
  suggestions,
  suggestionListId,
}: {
  items: string[]
  onChange: (next: string[]) => void
  suggestions: string[]
  suggestionListId: string
}) {
  const [draft, setDraft] = useState("")
  return (
    <div className="space-y-1.5">
      <div className="rounded-md border border-white/10 bg-[#0e0e18] p-1.5 min-h-[80px] max-h-[150px] overflow-y-auto space-y-0.5">
        {items.length === 0 && <p className="text-[11px] text-white/30 px-1 py-1">Пусто</p>}
        {items.map((name, i) => (
          <div key={i} className="flex items-center justify-between text-xs text-white/85 px-1.5 py-0.5">
            <span className="truncate">{name}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-white/40 hover:text-red-400"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          placeholder="добавить имя…"
          list={suggestionListId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault()
              if (!items.includes(draft.trim())) onChange([...items, draft.trim()])
              setDraft("")
            }
          }}
          className="flex-1 rounded-md border border-white/10 bg-[#0e0e18] px-2 py-1 text-xs text-white outline-none focus:border-violet-500/60"
        />
        <button
          type="button"
          onClick={() => {
            if (draft.trim() && !items.includes(draft.trim())) onChange([...items, draft.trim()])
            setDraft("")
          }}
          className="rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs hover:bg-white/[0.06]"
        >
          +
        </button>
      </div>
      <datalist id={suggestionListId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Subblock 6: Rank card style (no live preview here)
// ────────────────────────────────────────────────────────────

function RankCardSubblock({
  templateId,
  initial,
  onSaved,
}: {
  templateId: string
  initial: TemplateLevelingSettings
  onSaved: (next: TemplateLevelingSettings) => void
}) {
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

  async function save() {
    setSaving(true)
    try {
      const next = await updateTemplateLevelingSettings(templateId, s)
      onSaved(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title="Rank card (визуал)"
      description="Цвета и фон. Превью увидит покупатель в своей админке — здесь нет реального сервера для PNG-рендера."
    >
      <Field label="Фоновая картинка (URL)">
        <TextInput value={s.rankBgImageUrl ?? ""} onChange={(v) => setS({ ...s, rankBgImageUrl: v || null })} placeholder="https://..." />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Цвет фона">
          <ColorInput value={s.rankBgColor} onChange={(v) => setS({ ...s, rankBgColor: v })} />
        </Field>
        <Field label="Overlay (%)">
          <NumberInput min={0} max={100} value={s.rankOverlayOpacity} onChange={(v) => setS({ ...s, rankOverlayOpacity: v })} />
        </Field>
        <Field label="Основной текст">
          <ColorInput value={s.rankPrimaryTextColor} onChange={(v) => setS({ ...s, rankPrimaryTextColor: v })} />
        </Field>
        <Field label="Второстепенный">
          <ColorInput value={s.rankSecondaryTextColor} onChange={(v) => setS({ ...s, rankSecondaryTextColor: v })} />
        </Field>
        <Field label="Акцент (tier)">
          <ColorInput value={s.rankAccentColor} onChange={(v) => setS({ ...s, rankAccentColor: v })} />
        </Field>
        <Field label="Прогресс-бар">
          <ColorInput value={s.rankProgressColor} onChange={(v) => setS({ ...s, rankProgressColor: v })} />
        </Field>
        <Field label="Трек прогресс-бара">
          <TextInput value={s.rankProgressBgColor} onChange={(v) => setS({ ...s, rankProgressBgColor: v })} />
        </Field>
      </div>

      <div className="flex justify-end">
        <SaveBtn dirty={dirty} saving={saving} onClick={save} />
      </div>
    </Card>
  )
}
