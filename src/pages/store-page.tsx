import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, ShoppingBag } from "lucide-react"
import {
  ApiError,
  checkoutTemplate,
  getStoreTemplates,
  type StoreTemplateProduct,
} from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * Customer-facing store. Three product categories planned:
 *  - Готовые серверы (server templates) — implemented now
 *  - Шаблоны (simple-template) — placeholder
 *  - Декор (decor pack) — placeholder
 *
 * Architecture: each tab is keyed by a productCategory string. Adding a new
 * category later means adding a new tab + a fetcher; the layout stays the same.
 */

type Tab = "server-template" | "simple-template" | "decor"

const TABS: { key: Tab; label: string; soon?: boolean }[] = [
  { key: "server-template", label: "Готовые серверы" },
  { key: "simple-template", label: "Шаблоны", soon: true },
  { key: "decor", label: "Декор", soon: true },
]

export function StorePage() {
  const [tab, setTab] = useState<Tab>("server-template")

  return (
    <div className="space-y-6">
      <Header />
      <Tabs current={tab} onChange={setTab} />
      {tab === "server-template" ? <ServerTemplatesGrid /> : <ComingSoon />}
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <ShoppingBag className="h-7 w-7 text-violet-400" />
        Магазин
      </h1>
      <p className="text-sm text-white/50 mt-1">Готовые шаблоны Discord-серверов</p>
    </div>
  )
}

function Tabs({ current, onChange }: { current: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-white/5">
      {TABS.map((t) => {
        const active = t.key === current
        return (
          <button
            key={t.key}
            type="button"
            disabled={t.soon}
            onClick={() => !t.soon && onChange(t.key)}
            className={cn(
              "relative px-5 py-3 text-sm font-medium transition-colors",
              active ? "text-white" : "text-white/50 hover:text-white/80",
              t.soon && "cursor-not-allowed opacity-60",
            )}
          >
            <span className="inline-flex items-center gap-2">
              {t.label}
              {t.soon && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                  Скоро
                </span>
              )}
            </span>
            {active && (
              <span className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            )}
          </button>
        )
      })}
    </div>
  )
}

function ServerTemplatesGrid() {
  const navigate = useNavigate()
  const [items, setItems] = useState<StoreTemplateProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await getStoreTemplates())
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      setError(e instanceof Error ? e.message : "Loading error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleBuy(templateId: string) {
    setBuyingId(templateId)
    setError(null)
    setSuccess(null)
    try {
      await checkoutTemplate(templateId)
      setSuccess("Покупка оформлена. Перейдите в «Список покупок» чтобы установить.")
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      setError(e instanceof Error ? e.message : "Ошибка покупки")
    } finally {
      setBuyingId(null)
    }
  }

  // Tags are derived heuristically from name+description for now (no `tags` field on backend).
  // When backend gets tags this becomes a no-op replacement.
  const tagsFor = useMemo(
    () => (item: StoreTemplateProduct): string[] => {
      const text = `${item.name} ${item.description ?? ""}`.toLowerCase()
      const guesses: { tag: string; needles: string[] }[] = [
        { tag: "Gaming", needles: ["gam", "esport", "twitch"] },
        { tag: "Community", needles: ["communit", "сообществ", "клуб"] },
        { tag: "Anime", needles: ["anime", "аниме"] },
        { tag: "Crypto", needles: ["crypto", "крипт", "trading"] },
        { tag: "Streaming", needles: ["stream", "стрим"] },
        { tag: "Esports", needles: ["esport", "киберспорт"] },
        { tag: "Tournaments", needles: ["tournament", "турнир"] },
        { tag: "Art", needles: ["art", "design", "арт"] },
      ]
      return guesses
        .filter((g) => g.needles.some((n) => text.includes(n)))
        .map((g) => g.tag)
        .slice(0, 3)
    },
    [],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-white/40" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
          <p className="text-white/50">В магазине пока нет товаров.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((p) => (
            <ProductCard
              key={p.templateId}
              product={p}
              tags={tagsFor(p)}
              busy={buyingId === p.templateId}
              onBuy={() => void handleBuy(p.templateId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductCard({
  product,
  tags,
  busy,
  onBuy,
}: {
  product: StoreTemplateProduct
  tags: string[]
  busy: boolean
  onBuy: () => void
}) {
  const iconUrl = product.iconUrl ?? product.template?.iconUrl ?? null
  const initial = product.name?.[0]?.toUpperCase() ?? "?"
  const priceLabel =
    product.currency === "USD"
      ? `$${product.price.toFixed(2)}`
      : `${product.price.toFixed(2)} ${product.currency}`

  return (
    <article className="group rounded-2xl bg-[#11111c] border border-white/5 hover:border-violet-500/30 transition-colors overflow-hidden flex flex-col">
      <div className="aspect-[16/9] bg-gradient-to-br from-violet-700/40 to-fuchsia-700/30 grid place-items-center overflow-hidden">
        {iconUrl ? (
          <img src={iconUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-6xl font-bold text-white/30">{initial}</span>
        )}
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-lg font-semibold text-white">{product.name}</h3>
        <p className="text-sm text-white/55 mt-1.5 flex-1 leading-snug line-clamp-3">
          {product.description ?? "Без описания"}
        </p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.map((t) => (
              <span
                key={t}
                className="text-[11px] px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-lg font-semibold text-white">{priceLabel}</span>
          <button
            type="button"
            onClick={onBuy}
            disabled={busy}
            className="px-4 h-9 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {busy ? "…" : "Купить"}
          </button>
        </div>
      </div>
    </article>
  )
}

function ComingSoon() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center">
      <p className="text-white/40">Скоро здесь появятся товары этой категории.</p>
    </div>
  )
}
