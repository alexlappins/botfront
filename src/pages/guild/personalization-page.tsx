import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Bot, CheckCircle2, Info, Loader2, Send, Upload } from "lucide-react"
import {
  getBotPersonalization,
  getChannels,
  previewBotPersonalization,
  saveBotPersonalization,
  uploadFile,
  type BotPersonalizationSettings,
  type Channel,
} from "@/lib/api"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { PremiumGate } from "@/components/premium"
import { cn } from "@/lib/utils"

/**
 * Bot Personalization (TZ v2.1 §8): custom name + avatar for bot messages via
 * webhooks. Premium-only — the whole page body is wrapped in PremiumGate so
 * free users see it locked with the Premium modal on click (§8.8).
 */
export function PersonalizationPage() {
  const { t } = useTranslation()
  const guildId = useCurrentGuildId()
  const [settings, setSettings] = useState<BotPersonalizationSettings | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!guildId) return
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([getBotPersonalization(guildId), getChannels(guildId).catch(() => [] as Channel[])])
      .then(([s, ch]) => {
        if (!alive) return
        setSettings(s)
        setChannels(ch)
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : t("personalization.loadError"))
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Bot className="h-7 w-7 text-violet-400" />
          {t("personalization.title")}
        </h1>
        <p className="text-sm text-white/50 mt-1">{t("personalization.sub")}</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      )}
      {error && !loading && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {!loading && !error && settings && (
        <PremiumGate>
          <SettingsForm guildId={guildId} initial={settings} channels={channels} />
        </PremiumGate>
      )}
    </div>
  )
}

function SettingsForm({
  guildId,
  initial,
  channels,
}: {
  guildId: string
  initial: BotPersonalizationSettings
  channels: Channel[]
}) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [name, setName] = useState(initial.customName ?? "")
  const [avatarUrl, setAvatarUrl] = useState(initial.customAvatarUrl ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Discord webhook avatar constraints (TZ §3): PNG/JPG/GIF, ≤256 KB, ≥128×128.
  const AVATAR_MAX_BYTES = 256 * 1024
  const AVATAR_MIN_SIZE = 128
  const AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif"])

  async function handleAvatarFile(file: File) {
    setErr(null)
    if (!AVATAR_TYPES.has(file.type)) {
      setErr(t("personalization.avatarErrType"))
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setErr(t("personalization.avatarErrSize"))
      return
    }
    const objectUrl = URL.createObjectURL(file)
    try {
      const ok = await new Promise<boolean>((resolve) => {
        const img = new Image()
        img.onload = () =>
          resolve(img.naturalWidth >= AVATAR_MIN_SIZE && img.naturalHeight >= AVATAR_MIN_SIZE)
        img.onerror = () => resolve(false)
        img.src = objectUrl
      })
      if (!ok) {
        setErr(t("personalization.avatarErrSmall"))
        return
      }
      setUploading(true)
      const { url } = await uploadFile(file)
      setAvatarUrl(url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("personalization.saveError"))
    } finally {
      URL.revokeObjectURL(objectUrl)
      setUploading(false)
    }
  }

  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)
  const [previewChannel, setPreviewChannel] = useState(textChannels[0]?.id ?? "")
  const [previewing, setPreviewing] = useState(false)
  const [previewResult, setPreviewResult] = useState<"webhook" | "bot" | null>(null)

  async function save() {
    setSaving(true)
    setErr(null)
    setSaved(false)
    try {
      await saveBotPersonalization(guildId, {
        enabled,
        customName: name.trim() || null,
        customAvatarUrl: avatarUrl.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("personalization.saveError"))
    } finally {
      setSaving(false)
    }
  }

  async function preview() {
    if (!previewChannel) return
    setPreviewing(true)
    setPreviewResult(null)
    setErr(null)
    try {
      const res = await previewBotPersonalization(guildId, previewChannel)
      setPreviewResult(res.via)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("personalization.saveError"))
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Enable + identity */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm w-full text-left hover:bg-white/[0.06]"
        >
          <span
            className={cn(
              "relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0",
              enabled ? "bg-violet-500" : "bg-white/15",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                enabled && "translate-x-4",
              )}
            />
          </span>
          <span className="text-white/85">{t("personalization.enable")}</span>
        </button>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-white/70">{t("personalization.name")}</span>
          <input
            type="text"
            value={name}
            maxLength={32}
            placeholder={t("personalization.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60"
          />
        </label>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-white/70">{t("personalization.avatar")}</span>

          {/* File upload — the primary way to set an avatar (TZ §3) */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleAvatarFile(f)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06] disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t("personalization.avatarUpload")}
            </button>
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover border border-white/10"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = "none"
                }}
              />
            )}
          </div>
          <span className="block text-[11px] text-white/40">{t("personalization.avatarFileHint")}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("personalization.save")}
          </button>
          {saved && <span className="text-xs text-emerald-400">{t("personalization.saved")}</span>}
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </section>

      {/* Preview */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <p className="text-xs font-medium text-white/70">{t("personalization.previewChannel")}</p>
        <div className="flex gap-2 items-stretch">
          <select
            value={previewChannel}
            onChange={(e) => setPreviewChannel(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-violet-500/60"
          >
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void preview()}
            disabled={!previewChannel || previewing}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06] disabled:opacity-50"
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("personalization.preview")}
          </button>
        </div>
        {previewResult === "webhook" && (
          <p className="text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> {t("personalization.previewSentWebhook")}
          </p>
        )}
        {previewResult === "bot" && (
          <p className="text-xs text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> {t("personalization.previewSentBot")}
          </p>
        )}
      </section>

      {/* Info block: what changes / what doesn't (TZ §8.3) */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-white">{t("personalization.whatChangesTitle")}</p>
            <p className="text-white/60 text-xs mt-1">{t("personalization.whatChanges")}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-white">{t("personalization.whatStaysTitle")}</p>
            <p className="text-white/60 text-xs mt-1">{t("personalization.whatStays")}</p>
          </div>
        </div>
      </section>

      {/* Manage Webhooks warnings (TZ §8.7) */}
      {initial.missingWebhookPerms.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-1.5">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("personalization.permWarning")}
          </p>
          <p className="text-amber-200/80">
            {initial.missingWebhookPerms.map((c) => `#${c.channelName}`).join(", ")}
          </p>
        </section>
      )}
    </div>
  )
}
