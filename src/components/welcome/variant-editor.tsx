import { useState } from "react"
import { ChevronDown, Plus, Send, Trash2, X } from "lucide-react"
import { Loader2 } from "lucide-react"
import type {
  AvatarConfig,
  ImageSendMode,
  ImageTextBlock,
  UsernameConfig,
  WelcomeButton,
} from "@/lib/api"
import { ImageControls } from "@/components/welcome/image-controls"
import { cn } from "@/lib/utils"

/**
 * Shape of a single variant — used in both user dashboard and owner template editor.
 * `id` is undefined for newly-created variants until they're saved.
 */
export type VariantState = {
  id?: string
  text: string
  imageEnabled: boolean
  imageSendMode: ImageSendMode
  backgroundImageUrl: string | null
  backgroundFill: string | null
  avatarConfig: AvatarConfig | null
  usernameConfig: UsernameConfig | null
  imageTextConfig: ImageTextBlock | null
  /** Welcome-only; goodbye should hide button controls */
  buttonsConfig?: WelcomeButton[] | null
}

export function emptyVariant(text = ""): VariantState {
  return {
    text,
    imageEnabled: false,
    imageSendMode: "with_text",
    backgroundImageUrl: null,
    backgroundFill: null,
    avatarConfig: null,
    usernameConfig: null,
    imageTextConfig: null,
    buttonsConfig: null,
  }
}

interface VariantEditorProps {
  /** Used for image preview endpoint. May be a real guildId or a synthetic id for owner-admin previews. */
  previewGuildId: string | null
  /** Which preview endpoint to call. Owner-admin uses no preview (pass undefined). */
  previewKind?: "welcome" | "goodbye" | null
  value: VariantState
  onChange: (next: VariantState) => void
  onRemove?: () => void
  onTest?: () => void
  testing?: boolean
  label: string
  /** Hide buttons section (for goodbye and returning-message variants) */
  hideButtons?: boolean
  /** Start collapsed */
  defaultOpen?: boolean
}

export function VariantEditor({
  previewGuildId,
  previewKind,
  value,
  onChange,
  onRemove,
  onTest,
  testing,
  label,
  hideButtons,
  defaultOpen,
}: VariantEditorProps) {
  const [open, setOpen] = useState(!!defaultOpen)

  function patch(p: Partial<VariantState>) {
    onChange({ ...value, ...p })
  }

  const summary = value.text?.trim().slice(0, 80) || "(пустой вариант)"
  const hasImage = value.imageEnabled
  const buttonCount = value.buttonsConfig?.length ?? 0

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center gap-3 min-w-0 text-left"
        >
          <ChevronDown className={cn("h-4 w-4 text-white/40 transition-transform", open && "rotate-180")} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{label}</p>
            <p className="text-xs text-white/40 truncate">{summary}</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/40">
            {hasImage && <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-200">img</span>}
            {!hideButtons && buttonCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-white/10">{buttonCount} btn</span>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1">
          {onTest && (
            <button
              type="button"
              onClick={onTest}
              disabled={testing}
              className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white disabled:opacity-50"
              title="Отправить только этот вариант"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-red-500/10 hover:text-red-400"
              title="Удалить вариант"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-white/5 p-4 space-y-4">
          <div>
            <label className="text-xs text-white/60 block mb-1">Текст сообщения (поддерживает переменные)</label>
            <textarea
              value={value.text}
              onChange={(e) => patch({ text: e.target.value })}
              placeholder="Привет, {user}!"
              rows={3}
              className="w-full rounded-lg bg-black/40 border border-white/10 text-sm text-white p-3 outline-none focus:border-violet-500/60 resize-y"
            />
          </div>

          {!hideButtons && (
            <ButtonsSection
              buttons={value.buttonsConfig ?? []}
              onChange={(next) => patch({ buttonsConfig: next.length ? next : null })}
            />
          )}

          <ImageControls
            previewGuildId={previewGuildId}
            previewKind={previewKind ?? null}
            value={{
              imageEnabled: value.imageEnabled,
              imageSendMode: value.imageSendMode,
              backgroundImageUrl: value.backgroundImageUrl,
              backgroundFill: value.backgroundFill,
              avatarConfig: value.avatarConfig,
              usernameConfig: value.usernameConfig,
              imageTextConfig: value.imageTextConfig,
            }}
            onChange={(next) => patch(next)}
          />
        </div>
      )}
    </div>
  )
}

function ButtonsSection({
  buttons,
  onChange,
}: {
  buttons: WelcomeButton[]
  onChange: (next: WelcomeButton[]) => void
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
            Кнопки-ссылки <span className="text-white/40 normal-case">— до 3</span>
          </p>
        </div>
        {buttons.length < 3 && (
          <button
            type="button"
            onClick={() => onChange([...buttons, { label: "", url: "", emoji: null }])}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80"
          >
            <Plus className="h-3 w-3" />
            Добавить
          </button>
        )}
      </div>
      {buttons.length === 0 && <p className="text-xs text-white/40">Нет кнопок.</p>}
      {buttons.map((b, i) => (
        <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
          <input
            value={b.label}
            onChange={(e) =>
              onChange(buttons.map((row, idx) => (idx === i ? { ...row, label: e.target.value } : row)))
            }
            placeholder="Текст кнопки"
            className="rounded-lg bg-black/40 border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-violet-500/60"
          />
          <input
            value={b.url}
            onChange={(e) =>
              onChange(buttons.map((row, idx) => (idx === i ? { ...row, url: e.target.value } : row)))
            }
            placeholder="https://..."
            className="rounded-lg bg-black/40 border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-violet-500/60"
          />
          <button
            type="button"
            onClick={() => onChange(buttons.filter((_, idx) => idx !== i))}
            className="grid place-items-center w-9 rounded-lg border border-white/10 hover:bg-white/5 text-white/40 hover:text-red-400"
            aria-label="Удалить"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
