import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, ChevronDown, Globe } from "lucide-react"
import { LANGUAGES, type LanguageCode } from "@/i18n"
import { cn } from "@/lib/utils"

/**
 * Compact language dropdown. Replaces the old pill-row layout — pills don't
 * scale past ~3 languages without wrapping the header, and we plan to add
 * 5-8 more (per Misha's TZ part 2 §5). The trigger is a single chip that
 * shows the current short label (`EN` / `RU` / `UA` / …); clicking it opens
 * a panel listing every language with its native name.
 *
 * Two visual variants, same dropdown behaviour:
 *   - "pill"      — dashboard top bar (compact dark chip).
 *   - "publicNav" — public landing/shop navbar (matches the neon button row).
 *
 * The choice is persisted by i18next's LanguageDetector → localStorage, so a
 * page reload picks up the same language without flicker.
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
  const activeLang = LANGUAGES.find((l) => l.code === active) ?? LANGUAGES[0]

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click + Escape. One effect, registered while open.
  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("touchstart", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("touchstart", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function pick(code: LanguageCode) {
    setOpen(false)
    if (code === active) return
    void i18n.changeLanguage(code)
  }

  const isPublic = variant === "publicNav"
  return (
    <div
      ref={rootRef}
      className={cn(
        isPublic ? "public-lang-switch" : "lang-switch-pill",
        open && "is-open",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={isPublic ? "public-lang-trigger" : "lang-trigger"}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={activeLang.name}
      >
        <Globe className="lang-globe" />
        <span className="lang-label">{activeLang.label}</span>
        <ChevronDown className={cn("lang-chevron", open && "is-open")} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Language"
          className={isPublic ? "public-lang-menu" : "lang-menu"}
        >
          {LANGUAGES.map((l) => {
            const on = l.code === active
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => pick(l.code)}
                  className={cn("lang-opt", on && "is-on")}
                >
                  <span className="lang-opt-code">{l.label}</span>
                  <span className="lang-opt-name">{l.name}</span>
                  {on && <Check className="lang-opt-check" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <LangStyles />
    </div>
  )
}

function LangStyles() {
  return (
    <style>{`
      /* Shared dropdown bits — both variants reuse these.
         (.lang-* classes; public variant overrides colours via .public-* prefix.) */
      .lang-switch-pill, .public-lang-switch {
        position: relative; display: inline-flex; align-items: center;
      }
      .lang-trigger, .public-lang-trigger {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 6px 10px 6px 9px;
        border-radius: 999px;
        cursor: pointer; transition: .18s;
        font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      }
      .lang-globe { width: 13px; height: 13px; opacity: .7; }
      .lang-label { font-size: 12px; }
      .lang-chevron { width: 12px; height: 12px; opacity: .55; transition: transform .18s; }
      .lang-chevron.is-open { transform: rotate(180deg); }

      /* Dashboard pill variant */
      .lang-trigger {
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.10);
        color: rgba(255,255,255,0.78);
      }
      .lang-trigger:hover { background: rgba(255,255,255,0.07); color: #fff; }
      .lang-switch-pill.is-open .lang-trigger {
        background: rgba(139,146,255,0.14);
        border-color: rgba(139,146,255,0.35);
        color: #fff;
      }
      .lang-menu {
        position: absolute; top: calc(100% + 6px); right: 0;
        min-width: 160px; max-height: 320px; overflow-y: auto;
        padding: 4px;
        list-style: none; margin: 0;
        background: #15151f;
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 12px;
        box-shadow: 0 18px 44px rgba(0,0,0,0.5);
        z-index: 100;
      }

      /* Public-nav variant — neon chip + dark popover */
      .public-lang-trigger {
        font-family: 'Manrope', sans-serif;
        background: rgba(255,255,255,0.03);
        border: 1px solid var(--pub-line-2);
        color: var(--pub-ink-mut);
      }
      .public-lang-trigger:hover { color: #fff; }
      .public-lang-switch.is-open .public-lang-trigger {
        background: rgba(88,101,242,0.12);
        border-color: var(--pub-blurple-br);
        color: #fff;
      }
      .public-lang-menu {
        position: absolute; top: calc(100% + 8px); right: 0;
        min-width: 180px; max-height: 320px; overflow-y: auto;
        padding: 4px;
        list-style: none; margin: 0;
        background: var(--pub-bg-2, #0b0b17);
        border: 1px solid var(--pub-line-2);
        border-radius: 14px;
        box-shadow: 0 18px 44px rgba(0,0,0,0.55);
        z-index: 100;
      }

      .lang-opt {
        width: 100%;
        display: flex; align-items: center; gap: 10px;
        padding: 8px 10px;
        border: 0; background: transparent;
        border-radius: 8px;
        cursor: pointer;
        color: rgba(255,255,255,0.78);
        font-family: inherit; text-align: left;
        transition: background .15s, color .15s;
      }
      .lang-opt:hover { background: rgba(124,132,255,0.10); color: #fff; }
      .lang-opt.is-on {
        background: rgba(88,101,242,0.18);
        color: #fff;
      }
      .lang-opt-code {
        font-size: 11px; font-weight: 800; letter-spacing: 0.06em;
        text-transform: uppercase;
        min-width: 28px;
        color: rgba(139,146,255,0.95);
      }
      .lang-opt-name {
        flex: 1;
        font-size: 13px; font-weight: 500;
      }
      .lang-opt-check { width: 14px; height: 14px; color: rgba(139,146,255,0.95); }
    `}</style>
  )
}
