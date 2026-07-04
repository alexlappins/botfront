import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Check, Gem, Loader2 } from "lucide-react"
import { createPremiumCheckout, createPremiumPortal } from "@/lib/api"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { usePremium } from "@/contexts/premium-context"
import { cn } from "@/lib/utils"

/**
 * /pricing — Free vs Premium comparison + Stripe checkout entry point.
 * The "Premium feature" modal's "Learn more" button lands here (TZ v2.1 §1.2).
 * Checkout goes through POST /premium/checkout → redirect to Stripe-hosted page;
 * activation happens via the Stripe webhook, no client-side confirmation logic.
 */
export function PricingPage() {
  const { t } = useTranslation()
  const guildId = useCurrentGuildId()
  const { premium, refresh } = usePremium()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function upgrade() {
    if (!guildId) {
      setErr(t("pricing.selectServer"))
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const { url } = await createPremiumCheckout(guildId)
      window.location.href = url // Stripe-hosted checkout
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  async function manage() {
    if (!guildId) return
    setBusy(true)
    setErr(null)
    try {
      const { url } = await createPremiumPortal(guildId)
      window.location.href = url // Stripe customer portal
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  void refresh // context refreshes on guild change; nothing extra needed here

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Gem className="h-7 w-7 text-amber-400" />
          {t("pricing.title")}
        </h1>
        <p className="text-sm text-white/50 mt-1">{t("pricing.sub")}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Free */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
          <p className="text-lg font-semibold text-white">{t("pricing.free")}</p>
          <p className="text-3xl font-bold text-white">$0</p>
          <ul className="space-y-2 text-sm text-white/70">
            {t("pricing.features.freeList")
              .split("·")
              .map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-white/40 mt-0.5 shrink-0" />
                  {f.trim()}
                </li>
              ))}
          </ul>
        </div>

        {/* Premium */}
        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/[0.05] p-6 space-y-4 relative">
          <p className="text-lg font-semibold text-amber-300 flex items-center gap-2">
            <Gem className="h-4 w-4" />
            {t("pricing.premium")}
          </p>
          <p className="text-3xl font-bold text-white flex items-baseline gap-2 flex-wrap">
            {/* Keep in sync with the landing plans block and the Stripe Price. */}
            <span className="text-lg font-medium text-white/35 line-through">$9.99</span>
            <span>$4.99</span>
            <span className="text-sm font-normal text-white/50">{t("pricing.period")}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300 px-2 py-0.5">
              {t("landing.plans.launchPrice")}
            </span>
          </p>
          <ul className="space-y-2 text-sm text-white/80">
            {t("pricing.features.premiumList")
              .split("·")
              .map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
                  {f.trim()}
                </li>
              ))}
          </ul>

          {premium ? (
            <div className="space-y-2">
              <p className="text-sm text-emerald-400">{t("pricing.alreadyPremium")}</p>
              <button
                type="button"
                onClick={() => void manage()}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("pricing.manage")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void upgrade()}
              disabled={busy}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold",
                "bg-gradient-to-r from-amber-400 to-amber-500 text-black hover:opacity-90 disabled:opacity-60",
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gem className="h-4 w-4" />}
              {busy ? t("pricing.processing") : t("pricing.cta")}
            </button>
          )}
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      </div>
    </div>
  )
}

/** Landing after a successful Stripe checkout (success_url). */
export function PremiumSuccessPage() {
  const { t } = useTranslation()
  return (
    <div className="grid place-items-center py-24">
      <div className="max-w-md text-center space-y-4">
        <Gem className="h-12 w-12 text-amber-400 mx-auto" />
        <h1 className="text-2xl font-bold text-white">{t("pricing.successTitle")}</h1>
        <p className="text-sm text-white/60">{t("pricing.successBody")}</p>
        <Link
          to="/server-messages"
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-medium text-white"
        >
          {t("pricing.backToDashboard")}
        </Link>
      </div>
    </div>
  )
}
