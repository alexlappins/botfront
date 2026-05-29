import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ChevronRight, Loader2, Search, ShoppingBag, Sparkles, Star, X } from "lucide-react"
import {
  ApiError,
  checkoutTemplate,
  getStoreFacets,
  getStoreFeatured,
  getStoreTemplates,
  type StoreCategory,
  type StoreFacets,
  type StoreSort,
  type StoreTemplateProduct,
} from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * Customer-facing store. Three product categories planned:
 *  - Готовые серверы (server templates) — implemented now
 *  - Шаблоны (simple-template) — placeholder
 *  - Декор (decor pack) — placeholder
 */

type Tab = "server-template" | "simple-template" | "decor"

const TABS: { key: Tab; label: string; soon?: boolean }[] = [
  { key: "server-template", label: "Готовые серверы" },
  { key: "simple-template", label: "Шаблоны", soon: true },
  { key: "decor", label: "Декор", soon: true },
]

const CATEGORY_LABELS: Record<StoreCategory, string> = {
  gaming: "Gaming",
  community: "Community",
  anime: "Anime",
  crypto: "Crypto",
  streaming: "Streaming",
  other: "Other",
}

const SORT_OPTIONS: { key: StoreSort; label: string }[] = [
  { key: "newest", label: "Новые" },
  { key: "popular", label: "Популярные" },
  { key: "price_asc", label: "Цена ↑" },
  { key: "price_desc", label: "Цена ↓" },
]

const PAGE_SIZE = 24

export function StorePage() {
  const [tab, setTab] = useState<Tab>("server-template")

  return (
    <div className="space-y-6">
      <Header />
      <Tabs current={tab} onChange={setTab} />
      {tab === "server-template" ? <ServerTemplatesView /> : <ComingSoon />}
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

// ────────────────────────────────────────────────────────────
// Server templates: featured hero + filtered grid
// ────────────────────────────────────────────────────────────

function ServerTemplatesView() {
  const navigate = useNavigate()
  const [items, setItems] = useState<StoreTemplateProduct[]>([])
  const [total, setTotal] = useState(0)
  const [featured, setFeatured] = useState<StoreTemplateProduct[]>([])
  const [facets, setFacets] = useState<StoreFacets>({ categories: [], tags: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [category, setCategory] = useState<StoreCategory | undefined>(undefined)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<StoreSort>("newest")
  const [page, setPage] = useState(0)

  // Debounce search input so we don't spam the backend on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  // Reset to first page whenever filters change.
  useEffect(() => {
    setPage(0)
  }, [debouncedQuery, category, selectedTags, sort])

  // Featured + facets load once (don't depend on filter state).
  useEffect(() => {
    let alive = true
    Promise.all([getStoreFeatured(), getStoreFacets()])
      .then(([f, fc]) => {
        if (!alive) return
        setFeatured(f)
        setFacets(fc)
      })
      .catch(() => {
        // Non-critical — grid still works without featured/facets.
      })
    return () => {
      alive = false
    }
  }, [])

  // Filtered grid load.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    getStoreTemplates({
      q: debouncedQuery || undefined,
      category,
      tags: selectedTags.size ? [...selectedTags] : undefined,
      sort,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((res) => {
        if (!alive) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
        setError(e instanceof Error ? e.message : "Loading error")
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [debouncedQuery, category, selectedTags, sort, page, navigate])

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

  const filtersActive = debouncedQuery || category || selectedTags.size > 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
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

      {!filtersActive && featured.length > 0 && <FeaturedStrip items={featured} />}

      <Filters
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
        sort={sort}
        onSortChange={setSort}
        facets={facets}
        onClear={() => {
          setQuery("")
          setDebouncedQuery("")
          setCategory(undefined)
          setSelectedTags(new Set())
        }}
        canClear={Boolean(filtersActive)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-white/40" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
          <p className="text-white/50">
            {filtersActive ? "По таким фильтрам ничего не нашлось." : "В магазине пока нет товаров."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {items.map((p) => (
              <ProductCard
                key={p.id ?? p.templateId}
                product={p}
                busy={buyingId === p.templateId}
                onBuy={() => void handleBuy(p.templateId)}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
          )}
        </>
      )}
    </div>
  )
}

function FeaturedStrip({ items }: { items: StoreTemplateProduct[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-700/10 via-fuchsia-700/5 to-transparent p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-violet-400" />
        Рекомендуем
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((p) => (
          <Link
            key={p.id ?? p.templateId}
            to={`/store/${p.id}`}
            className="group shrink-0 w-[220px] rounded-xl bg-[#11111c] border border-white/5 hover:border-violet-500/40 transition-colors overflow-hidden"
          >
            <div className="aspect-[16/9] bg-gradient-to-br from-violet-700/40 to-fuchsia-700/30 grid place-items-center overflow-hidden">
              {(p.screenshots?.[0] ?? p.iconUrl) ? (
                <img
                  src={p.screenshots?.[0] ?? p.iconUrl ?? undefined}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <span className="text-3xl font-bold text-white/30">{p.name[0]?.toUpperCase() ?? "?"}</span>
              )}
            </div>
            <div className="p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-[10px] uppercase tracking-wide text-amber-300/80">Featured</span>
              </div>
              <p className="text-sm font-semibold text-white truncate">{p.name}</p>
              <p className="text-[11px] text-white/55 line-clamp-2">{p.description ?? "Без описания"}</p>
              <p className="text-sm font-semibold text-white pt-1">{priceLabel(p)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function Filters({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  selectedTags,
  onTagsChange,
  sort,
  onSortChange,
  facets,
  onClear,
  canClear,
}: {
  query: string
  onQueryChange: (v: string) => void
  category: StoreCategory | undefined
  onCategoryChange: (c: StoreCategory | undefined) => void
  selectedTags: Set<string>
  onTagsChange: (s: Set<string>) => void
  sort: StoreSort
  onSortChange: (s: StoreSort) => void
  facets: StoreFacets
  onClear: () => void
  canClear: boolean
}) {
  const topTags = useMemo(() => facets.tags.slice(0, 14), [facets.tags])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            value={query}
            placeholder="Поиск шаблонов…"
            onChange={(e) => onQueryChange(e.target.value)}
            className="w-full pl-9 pr-3 h-9 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/60"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as StoreSort)}
          className="h-9 rounded-lg border border-white/10 bg-[#0e0e18] px-3 text-sm text-white outline-none focus:border-violet-500/60"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        {canClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white px-2 py-1.5 rounded-md border border-white/10 hover:bg-white/[0.05]"
          >
            <X className="h-3 w-3" /> Сбросить
          </button>
        )}
      </div>

      {facets.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip active={category === undefined} onClick={() => onCategoryChange(undefined)}>
            Все
          </Chip>
          {facets.categories.map((c) => (
            <Chip key={c.category} active={category === c.category} onClick={() => onCategoryChange(c.category)}>
              {CATEGORY_LABELS[c.category] ?? c.category}{" "}
              <span className="opacity-50">({c.count})</span>
            </Chip>
          ))}
        </div>
      )}

      {topTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topTags.map((t) => {
            const active = selectedTags.has(t.tag)
            return (
              <Chip
                key={t.tag}
                active={active}
                small
                onClick={() => {
                  const next = new Set(selectedTags)
                  active ? next.delete(t.tag) : next.add(t.tag)
                  onTagsChange(next)
                }}
              >
                {t.tag} <span className="opacity-50">({t.count})</span>
              </Chip>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Chip({
  children,
  active,
  small,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  small?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border transition-colors",
        small ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        active
          ? "border-violet-500 bg-violet-500/15 text-white"
          : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
      )}
    >
      {children}
    </button>
  )
}

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (p: number) => void
}) {
  return (
    <div className="flex items-center justify-between text-xs text-white/50">
      <span>
        Найдено: {total.toLocaleString("en-US")} · стр. {page + 1} / {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 hover:bg-white/[0.06] disabled:opacity-40"
        >
          ← Назад
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 hover:bg-white/[0.06] disabled:opacity-40"
        >
          Вперёд →
        </button>
      </div>
    </div>
  )
}

function priceLabel(p: StoreTemplateProduct): string {
  return p.currency === "USD" ? `$${p.price.toFixed(2)}` : `${p.price.toFixed(2)} ${p.currency}`
}

function ProductCard({
  product,
  busy,
  onBuy,
}: {
  product: StoreTemplateProduct
  busy: boolean
  onBuy: () => void
}) {
  const heroImage = product.screenshots?.[0] ?? product.iconUrl ?? product.template?.iconUrl ?? null
  const initial = product.name?.[0]?.toUpperCase() ?? "?"

  return (
    <article className="group rounded-xl bg-[#11111c] border border-white/5 hover:border-violet-500/30 transition-colors overflow-hidden flex flex-col">
      <Link to={`/store/${product.id}`} className="block aspect-square bg-gradient-to-br from-violet-700/40 to-fuchsia-700/30 grid place-items-center overflow-hidden relative">
        {heroImage ? (
          <img
            src={heroImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <span className="text-3xl font-bold text-white/30">{initial}</span>
        )}
        {product.featured && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/90 text-[10px] font-bold text-black">
            <Star className="h-2.5 w-2.5 fill-current" />
            FEATURED
          </span>
        )}
      </Link>
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <Link to={`/store/${product.id}`} className="text-sm font-semibold text-white truncate hover:text-violet-300">
          {product.name}
        </Link>
        <p className="text-[11px] text-white/55 leading-snug line-clamp-2 flex-1">
          {product.description ?? "Без описания"}
        </p>
        {(product.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.tags!.slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white">{priceLabel(product)}</span>
          <div className="flex items-center gap-1">
            <Link
              to={`/store/${product.id}`}
              className="px-2 h-7 grid place-items-center rounded-md border border-white/10 text-[11px] text-white/70 hover:bg-white/[0.06]"
              title="Подробнее"
            >
              <ChevronRight className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={onBuy}
              disabled={busy}
              className="px-2.5 h-7 rounded-md bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {busy ? "…" : "Купить"}
            </button>
          </div>
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
