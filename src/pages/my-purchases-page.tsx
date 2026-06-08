import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2, Loader2, Package, ScrollText } from "lucide-react"
import { ApiError, getMyServerTemplates, type MyTemplateRow } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * Purchase history. Behaviour depends on access.usageType:
 *  - 'oneShot' (default): once installed, "Install" button is replaced by a static info block
 *    showing the install date, price, target guild, etc.
 *  - 'multi': user can install/use any number of times.
 *
 * Backend returns each template + its access record (with installedAt, usageType, pricePaid, …).
 */
export function MyPurchasesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<MyTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getMyServerTemplates()
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
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ScrollText className="h-7 w-7 text-violet-400" />
          My purchases
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Everything you've bought. One-shot items flip to “Installed” once they've been used.
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
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
          <Package className="h-10 w-10 mx-auto text-white/30 mb-3" />
          <p className="text-white/55">No purchases yet.</p>
          <button
            type="button"
            onClick={() => navigate("/store")}
            className="mt-4 px-4 h-9 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-medium hover:opacity-90"
          >
            Open the shop
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((row) => (
            <PurchaseRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

function PurchaseRow({ row }: { row: MyTemplateRow }) {
  const navigate = useNavigate()
  const access = row.access
  const isOneShot = access?.usageType !== "multi"
  const isInstalled = !!access?.installedAt
  const lockedAfterInstall = isOneShot && isInstalled

  return (
    <article className="rounded-2xl bg-[#11111c] border border-white/5 p-5 flex items-center gap-5">
      <div className="w-16 h-16 shrink-0 rounded-xl bg-gradient-to-br from-violet-700/40 to-fuchsia-700/30 grid place-items-center overflow-hidden">
        {row.iconUrl ? (
          <img src={row.iconUrl} alt={row.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-bold text-white/40">
            {row.name?.[0]?.toUpperCase() ?? "?"}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-lg font-semibold text-white">{row.name}</h3>
          <UsageBadge usageType={access?.usageType ?? "oneShot"} />
          {isInstalled && <InstalledBadge />}
        </div>
        {row.description && (
          <p className="text-sm text-white/55 mt-1 line-clamp-2">{row.description}</p>
        )}

        <Meta access={access} createdAt={row.createdAt} />
      </div>

      <div className="shrink-0">
        {lockedAfterInstall ? (
          <div className="text-right">
            <p className="text-xs text-white/40">Install used</p>
            <p className="text-sm font-medium text-emerald-400 inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Installed
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => navigate(`/install/${row.id}`)}
            className={cn(
              "px-5 h-10 rounded-lg text-sm font-medium",
              "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90",
            )}
          >
            {isInstalled ? "Install again" : "Start install"}
          </button>
        )}
      </div>
    </article>
  )
}

function UsageBadge({ usageType }: { usageType: "oneShot" | "multi" }) {
  if (usageType === "multi") {
    return (
      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
        Multi-use
      </span>
    )
  }
  return (
    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
      One-shot
    </span>
  )
}

function InstalledBadge() {
  return (
    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
      Installed
    </span>
  )
}

function Meta({
  access,
  createdAt,
}: {
  access: MyTemplateRow["access"]
  createdAt: string
}) {
  const items: { k: string; v: string }[] = []
  if (access?.grantedAt) {
    items.push({ k: "Purchased", v: fmt(access.grantedAt) })
  } else if (createdAt) {
    items.push({ k: "Created", v: fmt(createdAt) })
  }
  if (access?.installedAt) {
    items.push({ k: "Installed", v: fmt(access.installedAt) })
  }
  if (access?.pricePaid != null) {
    items.push({
      k: "Price",
      v: access.currency === "USD"
        ? `$${access.pricePaid.toFixed(2)}`
        : `${access.pricePaid.toFixed(2)} ${access.currency ?? ""}`.trim(),
    })
  }
  if (access?.installedGuildId) {
    items.push({ k: "Server", v: access.installedGuildId })
  }
  if (items.length === 0) return null

  return (
    <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[11px]">
      {items.map((m) => (
        <div key={m.k}>
          <dt className="text-white/40">{m.k}</dt>
          <dd className="text-white/80 truncate">{m.v}</dd>
        </div>
      ))}
    </dl>
  )
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return iso
  }
}
