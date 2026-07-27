import { useState, type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronUp, ExternalLink, GripVertical, Link2, Plus, Trash2 } from "lucide-react"
import type { TemplateButton } from "@/lib/api"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { DiscordEmbedPreview, type EmbedFormState } from "@/components/template-embed-builder"
import { cn } from "@/lib/utils"

export const MAX_TEMPLATE_BUTTONS = 3
const LABEL_MAX = 80
const URL_RE = /^(https?:\/\/|discord:\/\/)/i

export function emptyTemplateButton(): TemplateButton {
  // style is fixed to 5 (Link): Discord rejects any other style on a URL button.
  return { label: "", url: "", emoji: "", style: 5 }
}

/** Buttons that are complete enough to send. Half-typed rows are dropped. */
export function usableButtons(buttons: TemplateButton[]): TemplateButton[] {
  return buttons
    .filter((b) => b.label.trim() && b.url.trim())
    .slice(0, MAX_TEMPLATE_BUTTONS)
    .map((b) => ({
      label: b.label.trim(),
      url: b.url.trim(),
      emoji: b.emoji?.trim() || null,
      style: 5,
    }))
}

/** First client-side problem, so a bad row is caught before the API round-trip. */
export function validateButtonsClientSide(
  buttons: TemplateButton[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  for (const [i, b] of buttons.entries()) {
    const label = b.label.trim()
    const url = b.url.trim()
    if (!label && !url) continue
    if (!label) return t("templateButtons.errors.labelRequired", { n: i + 1 })
    if (label.length > LABEL_MAX) return t("templateButtons.errors.labelTooLong", { n: i + 1 })
    if (!URL_RE.test(url)) return t("templateButtons.errors.badUrl", { n: i + 1 })
  }
  return null
}

/**
 * Up to 3 link buttons attached to a message template.
 *
 * Style is intentionally not selectable: Discord forces style 5 (Link) on every
 * URL button, so a picker would only offer choices the API rejects. The field is
 * still shown (disabled) so the constraint is visible rather than mysterious.
 */
export function TemplateButtonsEditor({
  buttons,
  onChange,
  equalizeWidth,
  onEqualizeChange,
}: {
  buttons: TemplateButton[]
  onChange: (next: TemplateButton[]) => void
  equalizeWidth: boolean
  onEqualizeChange: (next: boolean) => void
}) {
  const { t } = useTranslation()
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function patch(i: number, changes: Partial<TemplateButton>) {
    onChange(buttons.map((b, idx) => (idx === i ? { ...b, ...changes } : b)))
  }

  function remove(i: number) {
    onChange(buttons.filter((_, idx) => idx !== i))
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= buttons.length || from === to) return
    const next = [...buttons]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  const canAdd = buttons.length < MAX_TEMPLATE_BUTTONS

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-white/40" />
          <Label className="text-sm font-medium">
            {t("templateButtons.title")}{" "}
            <span className="text-white/40 font-normal">
              ({buttons.length}/{MAX_TEMPLATE_BUTTONS})
            </span>
          </Label>
        </div>
        <button
          type="button"
          onClick={() => canAdd && onChange([...buttons, emptyTemplateButton()])}
          disabled={!canAdd}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium transition-colors",
            canAdd ? "text-white hover:bg-white/5" : "text-white/25 cursor-not-allowed",
          )}
        >
          <Plus className="h-3 w-3" />
          {t("templateButtons.add")}
        </button>
      </div>

      {buttons.length === 0 && (
        <p className="text-xs text-white/40">{t("templateButtons.empty")}</p>
      )}

      {buttons.map((b, i) => {
        const labelLen = b.label.length
        const urlBad = Boolean(b.url.trim()) && !URL_RE.test(b.url.trim())
        return (
          <div
            key={i}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, i)
              setDragIndex(null)
            }}
            onDragEnd={() => setDragIndex(null)}
            className={cn(
              "rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2",
              dragIndex === i && "opacity-50",
            )}
          >
            <div className="flex items-center gap-2">
              {/* Drag handle on pointer devices; the ↑↓ pair below is the
                  touch equivalent, since HTML5 drag doesn't work on mobile. */}
              <GripVertical className="h-4 w-4 text-white/25 cursor-grab shrink-0 hidden sm:block" />
              <span className="text-xs text-white/40 shrink-0">#{i + 1}</span>
              <div className="flex gap-1 sm:hidden">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/60 disabled:opacity-30"
                  aria-label={t("templateButtons.moveUp")}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === buttons.length - 1}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/60 disabled:opacity-30"
                  aria-label={t("templateButtons.moveDown")}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/5 hover:text-[hsl(var(--destructive))]"
                aria-label={t("templateButtons.remove")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_120px_90px]">
              <div className="grid gap-1">
                <Label className="text-[11px] text-white/50">{t("templateButtons.label")}</Label>
                <Input
                  value={b.label}
                  maxLength={LABEL_MAX}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => patch(i, { label: e.target.value })}
                  placeholder={t("templateButtons.labelPlaceholder")}
                />
                <span
                  className={cn(
                    "text-[10px] text-right",
                    labelLen > LABEL_MAX - 10 ? "text-amber-400" : "text-white/30",
                  )}
                >
                  {labelLen}/{LABEL_MAX}
                </span>
              </div>
              <div className="grid gap-1">
                <Label className="text-[11px] text-white/50">{t("templateButtons.style")}</Label>
                <div
                  className="flex h-9 items-center rounded-md border border-white/10 bg-white/[0.02] px-3 text-sm text-white/40"
                  title={t("templateButtons.styleLocked")}
                >
                  {t("templateButtons.styleLink")}
                </div>
                <span className="text-[10px] text-white/30">{t("templateButtons.styleLocked")}</span>
              </div>
              <div className="grid gap-1">
                <Label className="text-[11px] text-white/50">{t("templateButtons.emoji")}</Label>
                <Input
                  value={b.emoji ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => patch(i, { emoji: e.target.value })}
                  placeholder="🔗"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label className="text-[11px] text-white/50">{t("templateButtons.url")}</Label>
              <Input
                value={b.url}
                onChange={(e: ChangeEvent<HTMLInputElement>) => patch(i, { url: e.target.value })}
                placeholder="https://example.com"
                className={cn(urlBad && "border-[hsl(var(--destructive))]")}
              />
              {urlBad && (
                <span className="text-[10px] text-[hsl(var(--destructive))]">
                  {t("templateButtons.urlHint")}
                </span>
              )}
            </div>
          </div>
        )
      })}

      {buttons.length > 1 && (
        <label className="flex items-start gap-2 text-xs text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={equalizeWidth}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onEqualizeChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>
            {t("templateButtons.equalize")}
            <span className="block text-white/35">{t("templateButtons.equalizeHint")}</span>
          </span>
        </label>
      )}
    </div>
  )
}

/** Pad labels to the longest one, mirroring the backend's send-time padding. */
function padLabels(buttons: TemplateButton[], equalize: boolean): TemplateButton[] {
  if (!equalize || buttons.length < 2) return buttons
  const longest = Math.max(...buttons.map((b) => b.label.length))
  return buttons.map((b) => {
    const missing = longest - b.label.length
    if (missing <= 0) return b
    const left = Math.floor(missing / 2)
    return { ...b, label: `${" ".repeat(left)}${b.label}${" ".repeat(missing - left)}` }
  })
}

/**
 * Discord-shaped preview of the whole message: plain text, embed and buttons.
 * On mobile it sits behind a "Show preview" toggle so the editor stays reachable.
 */
export function TemplateMessagePreview({
  content,
  embedForm,
  buttons,
  equalizeWidth,
  collapsible = true,
}: {
  content: string
  embedForm: EmbedFormState
  buttons: TemplateButton[]
  equalizeWidth: boolean
  collapsible?: boolean
}) {
  const { t } = useTranslation()
  const [openMobile, setOpenMobile] = useState(false)
  const shown = padLabels(usableButtons(buttons), equalizeWidth)

  const body = (
    <div className="rounded-xl border border-white/10 bg-[#313338] p-3 space-y-2">
      {content.trim() && (
        <p className="whitespace-pre-wrap break-words text-sm text-[#dbdee1]">{content}</p>
      )}
      <DiscordEmbedPreview form={embedForm} />
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {shown.map((b, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#4e5058] px-4 py-1.5 text-sm font-medium text-white"
            >
              {b.emoji?.trim() && !b.emoji.startsWith("<") && <span>{b.emoji}</span>}
              <span className="whitespace-pre">{b.label}</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </span>
          ))}
        </div>
      )}
    </div>
  )

  if (!collapsible) return body

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpenMobile((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 sm:hidden"
      >
        {openMobile ? t("templateButtons.hidePreview") : t("templateButtons.showPreview")}
        {openMobile ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      <div className={cn(openMobile ? "block" : "hidden", "sm:block")}>
        <Label className="text-xs text-white/50 mb-1 block">{t("templateButtons.preview")}</Label>
        {body}
      </div>
    </div>
  )
}
