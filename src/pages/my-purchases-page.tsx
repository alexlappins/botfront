import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { CheckCircle2, Loader2, Package, ShoppingBag } from "lucide-react"
import { ApiError, getMyPurchases, type ShopPurchase } from "@/lib/api"

/**
 * My Purchases (TZ-1 §5): shop orders with deploy state.
 * Each row: cover, name, purchase date, status (Not installed / Installed on
 * [server]) and one Install button that opens the Install Flow (TZ-2). The
 * button disappears after a successful install — one purchase, one server.
 * Landing here with ?status=success (Stripe success_url) shows a toast.
 */
export function MyPurchasesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<ShopPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get("status") === "success") {
      setToast("Purchase successful — ready to deploy!")
      setSearchParams({}, { replace: true })
      const timer = setTimeout(() => setToast(null), 6000)
      return () => clearTimeout(timer)
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    let alive = true
    getMyPurchases()
      .then((rows) => {
        if (alive) setItems(rows)
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
        if (alive) setError(e instanceof Error ? e.message : "Loading error")
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [navigate])

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300 shadow-xl backdrop-blur">
          <CheckCircle2 className="h-4 w-4" />
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Package className="h-7 w-7 text-violet-400" />
          My Purchases
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Your ready-made servers. Each one installs onto a brand-new Discord server.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-white/40" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-16 text-center space-y-4">
          <ShoppingBag className="h-10 w-10 text-white/25 mx-auto" />
          <p className="text-white/55">You haven't bought anything yet.</p>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-sm font-medium text-white"
          >
            Browse the shop
          </Link>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                {row.product.coverImageUrl ? (
                  <img src={row.product.coverImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-white/25 text-xl">✦</div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium text-white truncate">{row.product.name}</p>
                <p className="text-xs text-white/40">
                  {new Date(row.createdAt).toLocaleDateString()} · {money(row.amount, row.currency)}
                  {row.status === "refunded" && <span className="ml-2 text-red-400">refunded</span>}
                </p>
                <p className="text-xs mt-1">
                  {row.deployedGuildId ? (
                    <span className="text-emerald-400">
                      ✓ Installed on {row.deployedGuildName ?? row.deployedGuildId}
                    </span>
                  ) : (
                    <span className="text-white/50">Not installed yet</span>
                  )}
                </p>
              </div>

              {/* One Install button; gone after a successful install (TZ-2 §5). */}
              {row.status === "paid" && !row.deployedGuildId && (
                <button
                  type="button"
                  onClick={() => navigate(`/install/${row.id}`)}
                  className="shrink-0 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-medium text-white"
                >
                  Install
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function money(v: number, currency: string): string {
  return currency === "USD" ? `$${v.toFixed(2)}` : `${v.toFixed(2)} ${currency}`
}
