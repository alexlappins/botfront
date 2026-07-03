import { createContext, useContext, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Gem, Lock, X } from "lucide-react"
import { usePremium } from "@/contexts/premium-context"
import { cn } from "@/lib/utils"

/**
 * Premium UI primitives (Misha TZ v2.1 §1):
 *   - <PremiumBadge>     — header status badge (gray Free / gold Premium)
 *   - <PremiumChip>      — small "◈ Premium" tag to mark a locked control
 *   - <PremiumGate>      — wraps a block; on free it's shown-but-locked and a
 *                          click opens the modal
 *   - usePremiumModal()  — imperative open, for gating a specific handler/button
 *
 * All gating reads usePremium() (the single client-side premium source), so
 * there are no hardcoded guild checks anywhere.
 */

// ── Modal host ───────────────────────────────────────────
const PremiumModalContext = createContext<{ open: () => void } | null>(null)

export function PremiumModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <PremiumModalContext.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <PremiumModal open={isOpen} onClose={() => setIsOpen(false)} />
    </PremiumModalContext.Provider>
  )
}

/** Opens the "Premium feature" modal. No-op if no provider is mounted. */
export function usePremiumModal(): () => void {
  return useContext(PremiumModalContext)?.open ?? (() => {})
}

function PremiumModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-amber-400/30 bg-[#15151f] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-300">
            <Gem className="h-5 w-5" />
            <h2 className="text-base font-semibold text-white">{t("premium.modalTitle")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white"
            aria-label={t("premium.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm text-white/70">{t("premium.modalBody")}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            {t("premium.cancel")}
          </button>
          <Link
            to="/pricing"
            onClick={onClose}
            className="rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-sm font-medium text-black hover:opacity-90"
          >
            {t("premium.learnMore")}
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Badge ────────────────────────────────────────────────
export function PremiumBadge({ className }: { className?: string }) {
  const { premium } = usePremium()
  const { t } = useTranslation()
  return premium ? (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300",
        className,
      )}
    >
      <Gem className="h-3 w-3" />
      {t("premium.badgePremium")}
    </span>
  ) : (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/55",
        className,
      )}
    >
      {t("premium.badgeFree")}
    </span>
  )
}

// ── "◈ Premium" chip for marking a locked control ────────
export function PremiumChip({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      title={t("premium.lockTooltip")}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300",
        className,
      )}
    >
      <Gem className="h-2.5 w-2.5" />
      {t("premium.lockedLabel")}
    </span>
  )
}

// ── Gate: show-but-locked wrapper ────────────────────────
/**
 * Renders children normally on premium. On free, dims + blocks interaction and
 * overlays a lock affordance; clicking opens the Premium modal. Use for whole
 * blocks (a tab body, a settings section). For a single button, prefer gating
 * the click handler with usePremiumModal() + <PremiumChip>.
 */
export function PremiumGate({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { premium } = usePremium()
  const openModal = usePremiumModal()
  const { t } = useTranslation()

  if (premium) return <>{children}</>

  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none select-none opacity-40 blur-[1px]" aria-hidden="true">
        {children}
      </div>
      <button
        type="button"
        onClick={openModal}
        title={t("premium.lockTooltip")}
        className="absolute inset-0 grid place-items-center rounded-xl bg-black/20 backdrop-blur-[1px] transition-colors hover:bg-black/30"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-[#15151f] px-3 py-1.5 text-xs font-semibold text-amber-300 shadow-lg">
          <Lock className="h-3.5 w-3.5" />
          {t("premium.lockedLabel")}
        </span>
      </button>
    </div>
  )
}
