import { useEffect, useMemo, useState } from "react"
import { HandHeart, Loader2, Plus } from "lucide-react"
import {
  createTemplateGoodbyeVariant,
  createTemplateWelcomeVariant,
  deleteTemplateGoodbyeVariant,
  deleteTemplateWelcomeVariant,
  updateServerTemplate,
  updateTemplateGoodbyeVariant,
  updateTemplateWelcomeVariant,
  type ServerTemplateDetail,
  type TemplateChannel,
  type TemplateGoodbyeVariant,
  type TemplateWelcomeVariant,
  type WelcomeVariantRole,
} from "@/lib/api"
import {
  VariantEditor,
  type VariantState,
} from "@/components/welcome/variant-editor"
import { cn } from "@/lib/utils"

const DEFAULT_WELCOME = "Привет, {user}! Добро пожаловать на **{server.name}** 🎉"
const DEFAULT_RETURNING = "С возвращением, {user}!"
const DEFAULT_GOODBYE =
  "{user.name} покинул(а) **{server.name}**. Нас стало {server.memberCount}."

/**
 * Owner-admin section to configure Welcome/Goodbye on a ServerTemplate.
 * Renders the SAME VariantEditor used in the user dashboard so what the buyer
 * sees post-install matches what the template author configured here.
 *
 * Save model: each variant is upserted individually on its own save click;
 * config-level fields (enabled, channel) save via the parent template PATCH.
 */
export function SectionWelcomeGoodbye({
  templateId,
  template,
  channels,
  onUpdate,
}: {
  templateId: string
  template: ServerTemplateDetail
  channels: TemplateChannel[]
  onUpdate: () => void
}) {
  const [tab, setTab] = useState<"welcome" | "goodbye">("welcome")
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const [welcomeEnabled, setWelcomeEnabled] = useState(!!template.welcomeEnabled)
  const [welcomeSendMode, setWelcomeSendMode] = useState<"channel" | "dm">(
    template.welcomeSendMode ?? "channel",
  )
  const [welcomeChannelName, setWelcomeChannelName] = useState<string>(
    template.welcomeChannelName ?? "",
  )
  const [welcomeReturningEnabled, setWelcomeReturningEnabled] = useState(
    !!template.welcomeReturningEnabled,
  )
  const [goodbyeEnabled, setGoodbyeEnabled] = useState(!!template.goodbyeEnabled)
  const [goodbyeChannelName, setGoodbyeChannelName] = useState<string>(
    template.goodbyeChannelName ?? "",
  )

  function setFlashAuto(kind: "ok" | "err", text: string) {
    setFlash({ kind, text })
    setTimeout(() => setFlash(null), 3000)
  }

  async function handleSaveConfig() {
    setSaving(true)
    try {
      await updateServerTemplate(templateId, {
        welcomeEnabled,
        welcomeSendMode,
        welcomeChannelName: welcomeChannelName.trim() || null,
        welcomeReturningEnabled,
        goodbyeEnabled,
        goodbyeChannelName: goodbyeChannelName.trim() || null,
      })
      setFlashAuto("ok", "Настройки сохранены")
      onUpdate()
    } catch (e) {
      setFlashAuto("err", e instanceof Error ? e.message : "Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  const welcomeNew = useMemo(
    () =>
      (template.welcomeVariants ?? [])
        .filter((v) => v.role === "new_member")
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [template.welcomeVariants],
  )
  const welcomeReturning = useMemo(
    () =>
      (template.welcomeVariants ?? [])
        .filter((v) => v.role === "returning_member")
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [template.welcomeVariants],
  )
  const goodbye = useMemo(
    () => (template.goodbyeVariants ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex),
    [template.goodbyeVariants],
  )

  const channelNames = channels.map((c) => c.name)

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <HandHeart className="h-5 w-5 text-violet-400" />
          Welcome / Goodbye
        </h2>
        <p className="text-xs text-white/50 mt-1">
          Все варианты — полноценные сообщения (текст + картинка + аватар + кнопки). При установке
          шаблона переезжают на сервер покупателя 1:1. Канал привязывается по имени.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ConfigBlock title="Welcome">
          <Toggle
            label="Включено"
            checked={welcomeEnabled}
            onChange={setWelcomeEnabled}
          />
          <SendModeRow value={welcomeSendMode} onChange={setWelcomeSendMode} />
          {welcomeSendMode === "channel" && (
            <ChannelNameRow
              value={welcomeChannelName}
              onChange={setWelcomeChannelName}
              suggestions={channelNames}
            />
          )}
          <Toggle
            label="Использовать пул для возвращающихся"
            checked={welcomeReturningEnabled}
            onChange={setWelcomeReturningEnabled}
          />
        </ConfigBlock>

        <ConfigBlock title="Goodbye">
          <Toggle
            label="Включено"
            checked={goodbyeEnabled}
            onChange={setGoodbyeEnabled}
          />
          <ChannelNameRow
            value={goodbyeChannelName}
            onChange={setGoodbyeChannelName}
            suggestions={channelNames}
          />
        </ConfigBlock>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Сохранить настройки
        </button>
        {flash && (
          <span
            className={cn(
              "text-xs",
              flash.kind === "ok" ? "text-emerald-400" : "text-red-300",
            )}
          >
            {flash.text}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-white/5 pt-2">
        {(["welcome", "goodbye"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-violet-500 text-white"
                : "border-transparent text-white/50 hover:text-white/80",
            )}
          >
            {t === "welcome" ? "Welcome варианты" : "Goodbye варианты"}
          </button>
        ))}
      </div>

      {tab === "welcome" && (
        <div className="space-y-5">
          <WelcomeVariantsList
            templateId={templateId}
            title="Новые участники"
            subtitle="До 5 вариантов. Бот выберет один случайно."
            role="new_member"
            variants={welcomeNew}
            onUpdate={onUpdate}
            defaultText={DEFAULT_WELCOME}
          />
          <WelcomeVariantsList
            templateId={templateId}
            title="Возвращающиеся участники"
            subtitle="Срабатывает только при включённом флаге выше."
            role="returning_member"
            variants={welcomeReturning}
            onUpdate={onUpdate}
            defaultText={DEFAULT_RETURNING}
          />
        </div>
      )}

      {tab === "goodbye" && (
        <GoodbyeVariantsList
          templateId={templateId}
          variants={goodbye}
          onUpdate={onUpdate}
          defaultText={DEFAULT_GOODBYE}
        />
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────
// Welcome variants list
// ─────────────────────────────────────────────────────────

function welcomeVariantToState(v: TemplateWelcomeVariant): VariantState {
  return {
    id: v.id,
    text: v.text,
    imageEnabled: v.imageEnabled,
    imageSendMode: v.imageSendMode,
    backgroundImageUrl: v.backgroundImageUrl,
    backgroundFill: v.backgroundFill,
    avatarConfig: v.avatarConfig,
    usernameConfig: v.usernameConfig,
    imageTextConfig: v.imageTextConfig,
    buttonsConfig: v.buttonsConfig,
  }
}

function goodbyeVariantToState(v: TemplateGoodbyeVariant): VariantState {
  return {
    id: v.id,
    text: v.text,
    imageEnabled: v.imageEnabled,
    imageSendMode: v.imageSendMode,
    backgroundImageUrl: v.backgroundImageUrl,
    backgroundFill: v.backgroundFill,
    avatarConfig: v.avatarConfig,
    usernameConfig: v.usernameConfig,
    imageTextConfig: v.imageTextConfig,
  }
}

function WelcomeVariantsList({
  templateId,
  title,
  subtitle,
  role,
  variants,
  defaultText,
  onUpdate,
}: {
  templateId: string
  title: string
  subtitle: string
  role: WelcomeVariantRole
  variants: TemplateWelcomeVariant[]
  defaultText: string
  onUpdate: () => void
}) {
  const [drafts, setDrafts] = useState<VariantState[]>(() => variants.map(welcomeVariantToState))
  useEffect(() => setDrafts(variants.map(welcomeVariantToState)), [variants])

  async function handleAdd() {
    try {
      await createTemplateWelcomeVariant(templateId, {
        text: defaultText,
        role,
        orderIndex: variants.length,
      })
      onUpdate()
    } catch {
      // ignored — UI shows nothing extra
    }
  }

  async function handleSaveOne(i: number) {
    const v = drafts[i]
    if (!v.id) return
    await updateTemplateWelcomeVariant(templateId, v.id, {
      text: v.text,
      role,
      imageEnabled: v.imageEnabled,
      imageSendMode: v.imageSendMode,
      backgroundImageUrl: v.backgroundImageUrl,
      backgroundFill: v.backgroundFill,
      avatarConfig: v.avatarConfig,
      usernameConfig: v.usernameConfig,
      imageTextConfig: v.imageTextConfig,
      buttonsConfig: v.buttonsConfig ?? null,
    })
    onUpdate()
  }

  async function handleRemove(i: number) {
    const v = drafts[i]
    if (!v.id) return
    if (!confirm("Удалить вариант?")) return
    await deleteTemplateWelcomeVariant(templateId, v.id)
    onUpdate()
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>
        </div>
        {variants.length < 5 && (
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-sm text-violet-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить вариант
          </button>
        )}
      </div>
      <div className="space-y-2">
        {drafts.length === 0 && (
          <p className="text-xs text-white/40 italic">
            Нет вариантов. Добавьте хотя бы один, если включаете эту фичу.
          </p>
        )}
        {drafts.map((v, i) => (
          <VariantWithSave
            key={v.id ?? `tmp-${i}`}
            value={v}
            onChange={(next) =>
              setDrafts((arr) => arr.map((row, idx) => (idx === i ? next : row)))
            }
            onSave={() => handleSaveOne(i)}
            onRemove={() => handleRemove(i)}
            label={`${title.split(" ")[0]} — вариант ${i + 1}`}
            hideButtons={false}
            templateId={templateId}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Goodbye variants list
// ─────────────────────────────────────────────────────────

function GoodbyeVariantsList({
  templateId,
  variants,
  defaultText,
  onUpdate,
}: {
  templateId: string
  variants: TemplateGoodbyeVariant[]
  defaultText: string
  onUpdate: () => void
}) {
  const [drafts, setDrafts] = useState<VariantState[]>(() => variants.map(goodbyeVariantToState))
  useEffect(() => setDrafts(variants.map(goodbyeVariantToState)), [variants])

  async function handleAdd() {
    await createTemplateGoodbyeVariant(templateId, {
      text: defaultText,
      orderIndex: variants.length,
    })
    onUpdate()
  }

  async function handleSaveOne(i: number) {
    const v = drafts[i]
    if (!v.id) return
    await updateTemplateGoodbyeVariant(templateId, v.id, {
      text: v.text,
      imageEnabled: v.imageEnabled,
      imageSendMode: v.imageSendMode,
      backgroundImageUrl: v.backgroundImageUrl,
      backgroundFill: v.backgroundFill,
      avatarConfig: v.avatarConfig,
      usernameConfig: v.usernameConfig,
      imageTextConfig: v.imageTextConfig,
    })
    onUpdate()
  }

  async function handleRemove(i: number) {
    const v = drafts[i]
    if (!v.id) return
    if (!confirm("Удалить вариант?")) return
    await deleteTemplateGoodbyeVariant(templateId, v.id)
    onUpdate()
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Прощания</p>
          <p className="text-xs text-white/50 mt-0.5">До 5 вариантов. Бот выберет один случайно.</p>
        </div>
        {variants.length < 5 && (
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-sm text-violet-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить вариант
          </button>
        )}
      </div>
      <div className="space-y-2">
        {drafts.length === 0 && (
          <p className="text-xs text-white/40 italic">
            Нет вариантов. Добавьте хотя бы один, если включаете эту фичу.
          </p>
        )}
        {drafts.map((v, i) => (
          <VariantWithSave
            key={v.id ?? `tmp-${i}`}
            value={v}
            onChange={(next) =>
              setDrafts((arr) => arr.map((row, idx) => (idx === i ? next : row)))
            }
            onSave={() => handleSaveOne(i)}
            onRemove={() => handleRemove(i)}
            label={`Goodbye — вариант ${i + 1}`}
            hideButtons
            templateId={templateId}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function VariantWithSave({
  value,
  onChange,
  onSave,
  onRemove,
  label,
  hideButtons,
  templateId: _templateId,
}: {
  value: VariantState
  onChange: (next: VariantState) => void
  onSave: () => Promise<void> | void
  onRemove: () => void
  label: string
  hideButtons: boolean
  templateId: string
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function doSave() {
    setSaving(true)
    setErr(null)
    try {
      await onSave()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div>
      <VariantEditor
        previewGuildId={null}
        previewKind={null}
        value={value}
        onChange={onChange}
        onRemove={onRemove}
        label={label}
        hideButtons={hideButtons}
        defaultOpen={false}
      />
      <div className="flex items-center justify-end gap-2 mt-2">
        {err && <span className="text-xs text-red-300">{err}</span>}
        <button
          type="button"
          onClick={doSave}
          disabled={saving || !value.id}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 disabled:opacity-50"
          title={!value.id ? "Вариант ещё не создан" : "Сохранить"}
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          Сохранить вариант
        </button>
      </div>
    </div>
  )
}

function ConfigBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
      <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-white/70 cursor-pointer">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-violet-500" : "bg-white/15",
        )}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  )
}

function SendModeRow({
  value,
  onChange,
}: {
  value: "channel" | "dm"
  onChange: (v: "channel" | "dm") => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["channel", "dm"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium border",
            value === m
              ? "border-violet-500 bg-violet-500/15 text-white"
              : "border-white/10 text-white/60 hover:bg-white/5",
          )}
        >
          {m === "channel" ? "В канал" : "В личные"}
        </button>
      ))}
    </div>
  )
}

function ChannelNameRow({
  value,
  onChange,
  suggestions,
}: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-white/60 block">
        Имя канала (привязка по имени; должен существовать в шаблоне)
      </label>
      <input
        list="welcome-channels-list"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="welcome"
        className="w-full rounded-lg bg-black/40 border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-violet-500/60"
      />
      <datalist id="welcome-channels-list">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}
