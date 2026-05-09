import { useEffect, useRef, useState } from "react"
import { Image as ImageIcon, Loader2, Upload } from "lucide-react"
import {
  fetchWelcomePreviewImage,
  uploadFile,
  type AvatarConfig,
  type ImageSendMode,
  type ImageTextBlock,
  type UsernameConfig,
} from "@/lib/api"
import { cn } from "@/lib/utils"

const CANVAS_W = 1024
const CANVAS_H = 400

const DEFAULT_AVATAR: AvatarConfig = {
  enabled: true,
  x: CANVAS_W / 2,
  y: 170,
  radius: 80,
  borderColor: "#ffffff",
  borderWidth: 6,
}

const DEFAULT_USERNAME: UsernameConfig = {
  enabled: true,
  x: CANVAS_W / 2,
  y: 290,
  fontSize: 36,
  color: "#ffffff",
  bold: true,
  align: "center",
  strokeColor: "#000000",
  strokeWidth: 3,
}

const DEFAULT_TEXT: ImageTextBlock = {
  enabled: true,
  text: "Welcome",
  x: CANVAS_W / 2,
  y: 60,
  fontSize: 30,
  color: "#ffffff",
  bold: true,
  align: "center",
  strokeColor: "#000000",
  strokeWidth: 2,
}

export type ImageEditorState = {
  imageEnabled: boolean
  imageSendMode: ImageSendMode
  backgroundImageUrl: string | null
  backgroundFill: string | null
  avatarConfig: AvatarConfig | null
  usernameConfig: UsernameConfig | null
  imageTextConfig: ImageTextBlock | null
}

export function ImageEditor({
  guildId,
  kind,
  value,
  onChange,
}: {
  guildId: string
  kind: "welcome" | "goodbye"
  value: ImageEditorState
  onChange: (next: ImageEditorState) => void
}) {
  const enabled = value.imageEnabled
  const sendMode = value.imageSendMode
  const bgFill = value.backgroundFill ?? "#1f1f29"
  const bgUrl = value.backgroundImageUrl
  const avatar = value.avatarConfig ?? DEFAULT_AVATAR
  const username = value.usernameConfig ?? DEFAULT_USERNAME
  const text = value.imageTextConfig ?? DEFAULT_TEXT

  function patch(p: Partial<ImageEditorState>) {
    onChange({ ...value, ...p })
  }

  // ── Debounced live preview ───────────────────────────
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const lastUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u)
        return null
      })
      lastUrlRef.current = null
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    const t = setTimeout(async () => {
      try {
        const blob = await fetchWelcomePreviewImage(
          guildId,
          {
            backgroundImageUrl: bgUrl,
            backgroundFill: bgFill,
            avatarConfig: avatar,
            usernameConfig: username,
            imageTextConfig: text,
          },
          kind,
        )
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
        lastUrlRef.current = url
        setPreviewUrl(url)
      } catch (e) {
        if (!cancelled) setPreviewError(e instanceof Error ? e.message : "Ошибка превью")
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    bgUrl,
    bgFill,
    avatar.enabled, avatar.x, avatar.y, avatar.radius, avatar.borderColor, avatar.borderWidth,
    username.enabled, username.x, username.y, username.fontSize, username.color, username.bold, username.align, username.strokeColor, username.strokeWidth,
    text.enabled, text.text, text.x, text.y, text.fontSize, text.color, text.bold, text.align, text.strokeColor, text.strokeWidth,
    guildId, kind,
  ])

  useEffect(() => {
    return () => {
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
    }
  }, [])

  // ── Upload ───────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  async function handleUpload(file: File) {
    setUploading(true)
    setUploadError(null)
    try {
      const { url } = await uploadFile(file)
      patch({ backgroundImageUrl: url })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Ошибка загрузки")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="rounded-2xl bg-[#11111c] border border-white/5 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-violet-400" />
            Картинка
          </p>
          <p className="text-xs text-white/50 mt-0.5">
            Сгенерированный баннер с аватаром и текстом — прикрепляется к сообщению.
          </p>
        </div>
        <Toggle checked={enabled} onChange={(v) => patch({ imageEnabled: v })} />
      </div>

      {enabled && (
        <>
          {/* Live preview */}
          <div className="space-y-2">
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-[1024/400]">
              {previewUrl ? (
                <img src={previewUrl} alt="preview" className="w-full h-full object-contain" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-white/30 text-xs">
                  Загрузка превью…
                </div>
              )}
              {previewLoading && (
                <div className="absolute top-2 right-2 rounded-full bg-black/60 p-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" />
                </div>
              )}
            </div>
            {previewError && (
              <p className="text-xs text-red-300">{previewError}</p>
            )}
          </div>

          {/* Send mode */}
          <div>
            <p className="text-xs font-semibold text-white/70 mb-2">Режим отправки</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: "with_text" as const, label: "Текст + картинка" },
                  { v: "before_text" as const, label: "Картинка перед текстом" },
                  { v: "image_only" as const, label: "Только картинка" },
                ]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => patch({ imageSendMode: opt.v })}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-medium border",
                    sendMode === opt.v
                      ? "border-violet-500 bg-violet-500/15 text-white"
                      : "border-white/10 text-white/60 hover:bg-white/5",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Background */}
          <Section title="Фон">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
              <div className="space-y-2">
                <label className="text-xs text-white/60 block">Цвет заливки (под картинкой фона)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgFill}
                    onChange={(e) => patch({ backgroundFill: e.target.value })}
                    className="h-9 w-12 rounded border border-white/10 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={bgFill}
                    onChange={(e) => patch({ backgroundFill: e.target.value })}
                    className="flex-1 rounded-lg bg-black/40 border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-violet-500/60 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/60 block">Картинка фона</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleUpload(f)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/80"
                  >
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {bgUrl ? "Заменить" : "Загрузить"}
                  </button>
                  {bgUrl && (
                    <button
                      type="button"
                      onClick={() => patch({ backgroundImageUrl: null })}
                      className="px-3 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:text-red-400"
                    >
                      Убрать
                    </button>
                  )}
                </div>
                {uploadError && <p className="text-xs text-red-300">{uploadError}</p>}
              </div>
            </div>
          </Section>

          {/* Avatar */}
          <Section
            title="Аватар"
            extra={<Toggle checked={avatar.enabled} onChange={(v) => patch({ avatarConfig: { ...avatar, enabled: v } })} />}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Slider label="X" min={0} max={CANVAS_W} value={avatar.x} onChange={(v) => patch({ avatarConfig: { ...avatar, x: v } })} />
              <Slider label="Y" min={0} max={CANVAS_H} value={avatar.y} onChange={(v) => patch({ avatarConfig: { ...avatar, y: v } })} />
              <Slider label="Радиус" min={20} max={150} value={avatar.radius} onChange={(v) => patch({ avatarConfig: { ...avatar, radius: v } })} />
              <Slider label="Обводка, px" min={0} max={20} value={avatar.borderWidth} onChange={(v) => patch({ avatarConfig: { ...avatar, borderWidth: v } })} />
            </div>
            <ColorRow label="Цвет обводки" value={avatar.borderColor} onChange={(v) => patch({ avatarConfig: { ...avatar, borderColor: v } })} />
          </Section>

          {/* Username */}
          <Section
            title="Имя пользователя"
            extra={<Toggle checked={username.enabled} onChange={(v) => patch({ usernameConfig: { ...username, enabled: v } })} />}
          >
            <TextBlockControls
              value={username}
              onChange={(next) => patch({ usernameConfig: next })}
              hideContent
            />
          </Section>

          {/* Welcome text block */}
          <Section
            title="Текстовый блок (на картинке)"
            extra={<Toggle checked={text.enabled} onChange={(v) => patch({ imageTextConfig: { ...text, enabled: v } })} />}
          >
            <div>
              <label className="text-xs text-white/60 block mb-1">Текст (поддерживает {"{user.name}"} и др.)</label>
              <input
                type="text"
                value={text.text}
                onChange={(e) => patch({ imageTextConfig: { ...text, text: e.target.value } })}
                placeholder="Welcome to {server.name}"
                className="w-full rounded-lg bg-black/40 border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-violet-500/60"
              />
            </div>
            <TextBlockControls
              value={text}
              onChange={(next) => patch({ imageTextConfig: { ...text, ...next } })}
            />
          </Section>
        </>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────

function Section({
  title,
  extra,
  children,
}: {
  title: string
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">{title}</p>
        {extra}
      </div>
      {children}
    </div>
  )
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
  )
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] text-white/60">{label}</label>
        <span className="text-[11px] text-white/40 tabular-nums">{Math.round(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-violet-500"
      />
    </div>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <label className="text-xs text-white/60 w-32 shrink-0">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 rounded border border-white/10 bg-transparent cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg bg-black/40 border border-white/10 text-xs text-white px-2 py-1.5 outline-none focus:border-violet-500/60 font-mono"
      />
    </div>
  )
}

function TextBlockControls<T extends Omit<ImageTextBlock, "text"> & { text?: string }>({
  value,
  onChange,
  hideContent,
}: {
  value: T
  onChange: (next: T) => void
  hideContent?: boolean
}) {
  function p(patch: Partial<T>) {
    onChange({ ...value, ...patch })
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Slider label="X" min={0} max={CANVAS_W} value={value.x} onChange={(v) => p({ x: v } as Partial<T>)} />
        <Slider label="Y" min={0} max={CANVAS_H} value={value.y} onChange={(v) => p({ y: v } as Partial<T>)} />
        <Slider label="Размер" min={10} max={96} value={value.fontSize} onChange={(v) => p({ fontSize: v } as Partial<T>)} />
        <Slider label="Обводка, px" min={0} max={10} value={value.strokeWidth ?? 0} onChange={(v) => p({ strokeWidth: v } as Partial<T>)} />
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => p({ bold: !value.bold } as Partial<T>)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-bold border",
            value.bold ? "border-violet-500 bg-violet-500/15 text-white" : "border-white/10 text-white/60 hover:bg-white/5",
          )}
        >
          B
        </button>
        <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => p({ align: a } as Partial<T>)}
              className={cn(
                "px-3 py-1.5 text-xs",
                value.align === a ? "bg-violet-500/20 text-white" : "text-white/60 hover:bg-white/5",
              )}
            >
              {a === "left" ? "←" : a === "center" ? "↔" : "→"}
            </button>
          ))}
        </div>
        {hideContent && <span className="text-[11px] text-white/40">(контент = {"{user.name}"})</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ColorRow label="Цвет" value={value.color} onChange={(v) => p({ color: v } as Partial<T>)} />
        <ColorRow label="Цвет обводки" value={value.strokeColor ?? "#000000"} onChange={(v) => p({ strokeColor: v } as Partial<T>)} />
      </div>
    </div>
  )
}
