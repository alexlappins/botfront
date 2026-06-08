import { useTranslation } from "react-i18next"
import { LANGUAGES, type LanguageCode } from "@/i18n"
import { cn } from "@/lib/utils"

/**
 * Two-language pill switcher. Two visual styles via `variant`:
 *   - "pill"     — for the dark dashboard sidebar (rounded chips on dark bg)
 *   - "publicNav" — for the gold/violet public navbar (matches `.public-btn-sm`
 *                   aesthetic but stays compact)
 *
 * Writes the choice to localStorage via i18next's LanguageDetector cache so
 * the next page load honours it without a flicker.
 */
export function LanguageSwitcher({
  variant = "pill",
  className,
}: {
  variant?: "pill" | "publicNav"
  className?: string
}) {
  const { i18n } = useTranslation()
  const active = (i18n.resolvedLanguage ?? i18n.language ?? "ru") as LanguageCode

  function set(code: LanguageCode) {
    if (code === active) return
    void i18n.changeLanguage(code)
  }

  if (variant === "publicNav") {
    return (
      <div className={cn("public-lang-switch", className)}>
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            className={cn("public-lang-btn", l.code === active && "on")}
            onClick={() => set(l.code)}
            title={l.name}
            aria-pressed={l.code === active}
          >
            {l.label}
          </button>
        ))}
        <PublicLangStyles />
      </div>
    )
  }

  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.03] p-0.5", className)}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => set(l.code)}
          title={l.name}
          aria-pressed={l.code === active}
          className={cn(
            "px-2 py-0.5 text-[11px] font-semibold rounded transition-colors",
            l.code === active
              ? "bg-violet-500/25 text-white"
              : "text-white/55 hover:text-white hover:bg-white/[0.06]",
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

function PublicLangStyles() {
  return (
    <style>{`
      .public-lang-switch {
        display: inline-flex; align-items: center; gap: 2px;
        padding: 3px; border: 1px solid var(--pub-line-2);
        border-radius: 999px; background: rgba(255,255,255,0.03);
      }
      .public-lang-btn {
        font-family: 'Manrope', sans-serif; font-size: 12px; font-weight: 700;
        letter-spacing: 0.05em; text-transform: uppercase;
        padding: 5px 11px; border-radius: 999px;
        background: transparent; border: 0;
        color: var(--pub-ink-mut); cursor: pointer; transition: .18s;
      }
      .public-lang-btn:hover { color: #fff; }
      .public-lang-btn.on {
        background: var(--pub-blurple);
        color: #fff;
        box-shadow: 0 4px 14px rgba(88,101,242,0.5);
      }
    `}</style>
  )
}
