import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { HandHeart, Loader2, Plus, Send, Wand2 } from "lucide-react"
import {
  ApiError,
  getChannels,
  getGoodbyeConfig,
  getWelcomeConfig,
  testGoodbyeMessage,
  testWelcomeMessage,
  updateGoodbyeConfig,
  updateWelcomeConfig,
  type Channel,
  type GoodbyeConfig,
  type GoodbyeVariant,
  type WelcomeConfig,
  type WelcomeVariant,
  type WelcomeVariantRole,
} from "@/lib/api"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { usePremium } from "@/contexts/premium-context"
import { PremiumChip, PremiumGate, usePremiumModal } from "@/components/premium"
import { cn } from "@/lib/utils"
import {
  emptyVariant,
  VariantEditor,
  type VariantState,
} from "@/components/welcome/variant-editor"

type Tab = "welcome" | "goodbye"

/** Variable keys are placeholders the bot substitutes at runtime — they are
 *  user-visible code, not translatable. The human-readable description IS
 *  translated (see welcome.variables.* in the locale files). */
const VARIABLES: { key: string; i18nKey: string }[] = [
  { key: "{user}", i18nKey: "user" },
  { key: "{user.name}", i18nKey: "userName" },
  { key: "{user.tag}", i18nKey: "userTag" },
  { key: "{user.id}", i18nKey: "userId" },
  { key: "{server.name}", i18nKey: "serverName" },
  { key: "{server.memberCount}", i18nKey: "serverMemberCount" },
]

const DEFAULT_WELCOME_TEXT = "Hey {user}! Welcome to **{server.name}** 🎉"
const DEFAULT_RETURNING_TEXT = "Welcome back, {user}!"
const DEFAULT_GOODBYE_TEXT =
  "{user.name} has left **{server.name}**. We are now {server.memberCount}."

export function WelcomePage() {
  const guildId = useCurrentGuildId()
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>("welcome")
  const [channels, setChannels] = useState<Channel[]>([])
  const [welcome, setWelcome] = useState<WelcomeConfig | null>(null)
  const [goodbye, setGoodbye] = useState<GoodbyeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!guildId) return
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([getChannels(guildId), getWelcomeConfig(guildId), getGoodbyeConfig(guildId)])
      .then(([c, w, g]) => {
        if (!alive) return
        setChannels(c)
        setWelcome(w)
        setGoodbye(g)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setError(t("common.noAccess"))
        } else {
          setError(e instanceof Error ? e.message : t("welcome.loadError"))
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [guildId])

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
          <HandHeart className="h-7 w-7 text-violet-400" />
          {t("welcome.title")}
        </h1>
        <p className="text-sm text-white/50 mt-1">{t("welcome.sub")}</p>
      </div>

      <div className="flex items-center gap-2 border-b border-white/5">
        {/* Renamed callback param `t` → `tk` to avoid shadowing useTranslation's t. */}
        {(["welcome", "goodbye"] as Tab[]).map((tk) => (
          <button
            key={tk}
            type="button"
            onClick={() => setTab(tk)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === tk
                ? "border-violet-500 text-white"
                : "border-transparent text-white/50 hover:text-white/80",
            )}
          >
            {t(`welcome.tabs.${tk}`)}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && tab === "welcome" && welcome && (
        <WelcomeTab guildId={guildId} channels={channels} value={welcome} onChange={setWelcome} />
      )}
      {!loading && !error && tab === "goodbye" && goodbye && (
        /* Goodbye is Premium-only (TZ v2.1 §4.1): visible but locked on free. */
        <PremiumGate>
          <GoodbyeTab guildId={guildId} channels={channels} value={goodbye} onChange={setGoodbye} />
        </PremiumGate>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Welcome tab
// ─────────────────────────────────────────────────────────

function welcomeVariantToState(v: WelcomeVariant): VariantState {
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

function goodbyeVariantToState(v: GoodbyeVariant): VariantState {
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

function WelcomeTab({
  guildId,
  channels,
  value,
  onChange,
}: {
  guildId: string
  channels: Channel[]
  value: WelcomeConfig
  onChange: (next: WelcomeConfig) => void
}) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(value.enabled)
  const [sendMode, setSendMode] = useState<"channel" | "dm">(value.sendMode)
  const [channelId, setChannelId] = useState<string | null>(value.channelId)
  const [returningEnabled, setReturningEnabled] = useState(value.returningMemberEnabled)

  const [newVariants, setNewVariants] = useState<VariantState[]>(() => {
    const fromServer = value.templates
      .filter((t) => t.role === "new_member")
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(welcomeVariantToState)
    return fromServer.length ? fromServer : [emptyVariant(DEFAULT_WELCOME_TEXT)]
  })
  const [returningVariants, setReturningVariants] = useState<VariantState[]>(() =>
    value.templates
      .filter((t) => t.role === "returning_member")
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(welcomeVariantToState),
  )

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  function setFlashAuto(type: "ok" | "err", text: string) {
    setFlash({ type, text })
    setTimeout(() => setFlash(null), 3500)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const allVariants: WelcomeVariantsForApi[] = [
        ...newVariants.map((v) => withRole(v, "new_member")),
        ...returningVariants.map((v) => withRole(v, "returning_member")),
      ]
      const next = await updateWelcomeConfig(guildId, {
        enabled,
        sendMode,
        channelId,
        returningMemberEnabled: returningEnabled,
        variants: allVariants,
      })
      onChange(next)
      setNewVariants(
        next.templates
          .filter((t) => t.role === "new_member")
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map(welcomeVariantToState),
      )
      setReturningVariants(
        next.templates
          .filter((t) => t.role === "returning_member")
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map(welcomeVariantToState),
      )
      setFlashAuto("ok", t("common.saved"))
    } catch (e) {
      setFlashAuto("err", e instanceof Error ? e.message : t("welcome.saveError"))
    } finally {
      setSaving(false)
    }
  }

  async function handleTest(variantId?: string, returning?: boolean) {
    setTesting(variantId ?? "any")
    try {
      await testWelcomeMessage(guildId, { variantId, returning })
      setFlashAuto("ok", t("welcome.testSent"))
    } catch (e) {
      setFlashAuto("err", e instanceof Error ? e.message : t("welcome.testFailed"))
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{t("welcome.enabledTitle")}</p>
              <p className="text-xs text-white/50 mt-0.5">{t("welcome.enabledSubWelcome")}</p>
            </div>
            <Toggle checked={enabled} onChange={setEnabled} />
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-white mb-3">{t("welcome.sendTo")}</p>
          <div className="flex gap-2 mb-4">
            {(["channel", "dm"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSendMode(m)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium border",
                  sendMode === m
                    ? "border-violet-500 bg-violet-500/15 text-white"
                    : "border-white/10 text-white/60 hover:bg-white/5",
                )}
              >
                {t(`welcome.sendMode.${m}`)}
              </button>
            ))}
          </div>
          {sendMode === "channel" && (
            <ChannelPicker
              channels={channels}
              value={channelId}
              onChange={setChannelId}
              placeholder={t("welcome.channelPlaceholder")}
            />
          )}
          {sendMode === "dm" && (
            <p className="text-xs text-white/50">{t("welcome.dmHint")}</p>
          )}
        </Card>

        <VariantsList
          title={t("welcome.variants.newWelcomeTitle")}
          subtitle={t("welcome.variants.subtitle")}
          variants={newVariants}
          onChange={setNewVariants}
          defaultText={DEFAULT_WELCOME_TEXT}
          guildId={guildId}
          previewKind="welcome"
          onTest={(id) => handleTest(id, false)}
          testing={testing}
        />

        {/* Returning members is Premium-only (TZ v2.1 §4.2). */}
        <PremiumGate>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-white">{t("welcome.returning.title")}</p>
                <p className="text-xs text-white/50 mt-0.5">{t("welcome.returning.sub")}</p>
              </div>
              <Toggle checked={returningEnabled} onChange={setReturningEnabled} />
            </div>
            {returningEnabled && (
              <VariantsList
                title=""
                subtitle=""
                variants={returningVariants}
                onChange={setReturningVariants}
                defaultText={DEFAULT_RETURNING_TEXT}
                guildId={guildId}
                previewKind="welcome"
                onTest={(id) => handleTest(id, true)}
                testing={testing}
                embedded
              />
            )}
          </Card>
        </PremiumGate>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 self-start">
        <VariablesList />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {t("welcome.actions.save")}
          </button>
          <button
            type="button"
            onClick={() => handleTest()}
            disabled={!!testing || !enabled}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm font-medium disabled:opacity-50"
            title={!enabled ? t("welcome.actions.testDisabledHint") : ""}
          >
            {testing === "any" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("welcome.actions.testRandom")}
          </button>
        </div>

        {flash && <FlashBox flash={flash} />}
      </aside>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Goodbye tab
// ─────────────────────────────────────────────────────────

function GoodbyeTab({
  guildId,
  channels,
  value,
  onChange,
}: {
  guildId: string
  channels: Channel[]
  value: GoodbyeConfig
  onChange: (next: GoodbyeConfig) => void
}) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(value.enabled)
  const [channelId, setChannelId] = useState<string | null>(value.channelId)
  const [variants, setVariants] = useState<VariantState[]>(() => {
    const fromServer = value.templates
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(goodbyeVariantToState)
    return fromServer.length ? fromServer : [emptyVariant(DEFAULT_GOODBYE_TEXT)]
  })

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  function setFlashAuto(type: "ok" | "err", text: string) {
    setFlash({ type, text })
    setTimeout(() => setFlash(null), 3500)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const next = await updateGoodbyeConfig(guildId, {
        enabled,
        channelId,
        variants: variants.map((v) => stripButtons(v)),
      })
      onChange(next)
      setVariants(
        next.templates.sort((a, b) => a.orderIndex - b.orderIndex).map(goodbyeVariantToState),
      )
      setFlashAuto("ok", t("common.saved"))
    } catch (e) {
      setFlashAuto("err", e instanceof Error ? e.message : t("welcome.saveError"))
    } finally {
      setSaving(false)
    }
  }

  async function handleTest(variantId?: string) {
    setTesting(variantId ?? "any")
    try {
      await testGoodbyeMessage(guildId, { variantId })
      setFlashAuto("ok", t("welcome.testSent"))
    } catch (e) {
      setFlashAuto("err", e instanceof Error ? e.message : t("welcome.testFailed"))
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{t("welcome.enabledTitle")}</p>
              <p className="text-xs text-white/50 mt-0.5">{t("welcome.enabledSubGoodbye")}</p>
            </div>
            <Toggle checked={enabled} onChange={setEnabled} />
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-white mb-3">{t("welcome.channel")}</p>
          <ChannelPicker
            channels={channels}
            value={channelId}
            onChange={setChannelId}
            placeholder={t("welcome.channelPlaceholder")}
          />
        </Card>

        <VariantsList
          title={t("welcome.variants.goodbyeTitle")}
          subtitle={t("welcome.variants.subtitle")}
          variants={variants}
          onChange={setVariants}
          defaultText={DEFAULT_GOODBYE_TEXT}
          guildId={guildId}
          previewKind="goodbye"
          onTest={handleTest}
          testing={testing}
          hideButtons
        />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 self-start">
        <VariablesList />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {t("welcome.actions.save")}
          </button>
          <button
            type="button"
            onClick={() => handleTest()}
            disabled={!!testing || !enabled}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm font-medium disabled:opacity-50"
          >
            {testing === "any" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("welcome.actions.testRandom")}
          </button>
        </div>

        {flash && <FlashBox flash={flash} />}
      </aside>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────

type WelcomeVariantsForApi = VariantState & { role: WelcomeVariantRole }

function withRole(v: VariantState, role: WelcomeVariantRole): WelcomeVariantsForApi {
  return { ...v, role }
}

function stripButtons(v: VariantState): VariantState {
  const { buttonsConfig: _b, ...rest } = v
  void _b
  return rest
}

function VariantsList({
  title,
  subtitle,
  variants,
  onChange,
  defaultText,
  guildId,
  previewKind,
  onTest,
  testing,
  hideButtons,
  embedded,
}: {
  title: string
  subtitle: string
  variants: VariantState[]
  onChange: (next: VariantState[]) => void
  defaultText: string
  guildId: string
  previewKind: "welcome" | "goodbye"
  onTest: (variantId?: string) => void
  testing: string | null
  hideButtons?: boolean
  embedded?: boolean
}) {
  const { t } = useTranslation()
  const { premium } = usePremium()
  const openPremiumModal = usePremiumModal()
  // Multiple variants are Premium (TZ v2.1 §3): free = exactly 1 active variant.
  const atFreeLimit = !premium && variants.length >= 1
  const inner = (
    <>
      <div className={cn("flex items-center justify-between", embedded ? "mb-2 mt-3" : "mb-3")}>
        <div>
          {title && <p className="text-sm font-semibold text-white">{title}</p>}
          {subtitle && <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>}
        </div>
        {variants.length < 5 && (
          <button
            type="button"
            onClick={() =>
              atFreeLimit ? openPremiumModal() : onChange([...variants, emptyVariant(defaultText)])
            }
            title={atFreeLimit ? t("premium.lockTooltip") : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm",
              atFreeLimit
                ? "bg-white/[0.03] border-white/10 text-white/40 cursor-pointer"
                : "bg-violet-600/20 hover:bg-violet-600/30 border-violet-500/40 text-violet-100",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("welcome.variants.add")}
            {atFreeLimit && <PremiumChip />}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {variants.length === 0 && (
          <p className="text-xs text-white/40 italic">{t("welcome.variants.empty")}</p>
        )}
        {variants.map((v, i) => (
          <VariantEditor
            key={v.id ?? `new-${i}`}
            previewGuildId={guildId}
            previewKind={previewKind}
            value={v}
            onChange={(next) =>
              onChange(variants.map((row, idx) => (idx === i ? next : row)))
            }
            onRemove={
              variants.length > 1
                ? () => onChange(variants.filter((_, idx) => idx !== i))
                : undefined
            }
            onTest={v.id ? () => onTest(v.id) : undefined}
            testing={testing === v.id}
            label={t("welcome.variants.label", { n: i + 1 })}
            hideButtons={hideButtons}
            defaultOpen={variants.length === 1 || i === 0}
          />
        ))}
      </div>
    </>
  )

  if (embedded) return inner
  return <Card>{inner}</Card>
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-[#11111c] border border-white/5 p-5">{children}</div>
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-violet-500" : "bg-white/15",
      )}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  )
}

function ChannelPicker({
  channels,
  value,
  onChange,
  placeholder,
}: {
  channels: Channel[]
  value: string | null
  onChange: (v: string | null) => void
  placeholder: string
}) {
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-lg bg-black/40 border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-violet-500/60"
    >
      <option value="">{placeholder}</option>
      {textChannels.map((c) => (
        <option key={c.id} value={c.id}>
          # {c.name}
        </option>
      ))}
    </select>
  )
}

function VariablesList() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl bg-[#11111c] border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-white"
      >
        <span>{t("welcome.variablesHeading")}</span>
        <span className="text-white/40">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="px-5 pb-4 space-y-1.5 text-xs">
          {VARIABLES.map((v) => (
            <li key={v.key} className="flex items-baseline gap-2">
              <code className="text-violet-300">{v.key}</code>
              <span className="text-white/50">— {t(`welcome.variables.${v.i18nKey}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FlashBox({ flash }: { flash: { type: "ok" | "err"; text: string } }) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 text-xs border",
        flash.type === "ok"
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          : "bg-red-500/10 border-red-500/30 text-red-300",
      )}
    >
      {flash.text}
    </div>
  )
}
