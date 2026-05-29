import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { PublicShell } from "@/components/public-shell"
import {
  getStoreFacets,
  getStoreFeatured,
  getStoreTemplates,
  type StoreCategory,
  type StoreFacets,
  type StoreSort,
  type StoreTemplateProduct,
} from "@/lib/api"

const CATEGORY_LABELS: Record<StoreCategory, string> = {
  gaming: "Gaming",
  community: "Community",
  anime: "Anime",
  crypto: "Crypto",
  streaming: "Streaming",
  other: "Other",
}

const SORT_OPTIONS: { key: StoreSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "popular", label: "Popular" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
]

const PAGE_SIZE = 24

/**
 * Public storefront at /shop. Mirrors the private dashboard store but with
 * the dark-fantasy chrome and no entitlement awareness — anyone can browse,
 * the "Buy" CTA opens the product detail page where login is gated.
 */
export function PublicShopPage() {
  const [items, setItems] = useState<StoreTemplateProduct[]>([])
  const [total, setTotal] = useState(0)
  const [featured, setFeatured] = useState<StoreTemplateProduct[]>([])
  const [facets, setFacets] = useState<StoreFacets>({ categories: [], tags: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [category, setCategory] = useState<StoreCategory | undefined>(undefined)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<StoreSort>("newest")
  const [page, setPage] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    setPage(0)
  }, [debouncedQuery, category, selectedTags, sort])

  useEffect(() => {
    let alive = true
    Promise.all([getStoreFeatured(), getStoreFacets()])
      .then(([f, fc]) => {
        if (!alive) return
        setFeatured(f)
        setFacets(fc)
      })
      .catch(() => {
        // Facets/featured are non-critical — grid still works.
      })
    return () => {
      alive = false
    }
  }, [])

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
        setError(e instanceof Error ? e.message : "Loading error")
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [debouncedQuery, category, selectedTags, sort, page])

  const filtersActive = Boolean(debouncedQuery || category || selectedTags.size > 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const topTags = useMemo(() => facets.tags.slice(0, 14), [facets.tags])

  return (
    <PublicShell activeNav="shop">
      <ShopStyles />

      {/* Heading band */}
      <header className="shop-hero">
        <div className="public-wrap shop-hero-in">
          <span className="shop-eyebrow">The Merchant</span>
          <h1>The Shop</h1>
          <p className="shop-sub">
            Ready-forged Discord realms — channels, roles, welcome flow, leveling and live alerts.
            Browse without an account; install after sign-in.
          </p>
        </div>
      </header>

      {/* Featured strip */}
      {!filtersActive && featured.length > 0 && (
        <section className="public-section" style={{ paddingTop: 40, paddingBottom: 40 }}>
          <div className="public-wrap">
            <div className="public-head">
              <span className="eyebrow">Curated</span>
              <div className="row">
                <h2>Featured Realms</h2>
                <span className="fl" />
                <span className="fl-end">✦</span>
              </div>
            </div>
            <div className="featured-strip">
              {featured.map((p) => (
                <Link key={p.id ?? p.templateId} to={`/shop/${p.id}`} className="public-card featured-tile">
                  <div className="ft-img">
                    {p.screenshots?.[0] || p.iconUrl ? (
                      <img src={p.screenshots?.[0] ?? p.iconUrl ?? ""} alt={p.name} />
                    ) : (
                      <span className="ft-fallback">{p.name[0]?.toUpperCase() ?? "✦"}</span>
                    )}
                    <span className="ft-badge">FEATURED</span>
                  </div>
                  <div className="ft-body">
                    <h4>{p.name}</h4>
                    <p>{p.description ?? "Без описания"}</p>
                    <div className="ft-foot">
                      <span className="ft-price">{priceLabel(p)}</span>
                      <span className="ft-cat">{p.category ? CATEGORY_LABELS[p.category] : ""}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Filters + grid */}
      <section className="public-section" style={{ paddingTop: 20 }}>
        <div className="public-wrap">
          <div className="public-head">
            <span className="eyebrow">Catalogue</span>
            <div className="row">
              <h2>All Realms</h2>
              <span className="fl" />
              <span className="fl-end">✦</span>
            </div>
          </div>

          {/* Toolbar */}
          <div className="shop-toolbar">
            <div className="shop-search">
              <span className="ss-icon">🔍</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search realms…"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as StoreSort)}
              className="shop-select"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            {filtersActive && (
              <button
                type="button"
                className="shop-clear"
                onClick={() => {
                  setQuery("")
                  setDebouncedQuery("")
                  setCategory(undefined)
                  setSelectedTags(new Set())
                }}
              >
                ✕ Reset
              </button>
            )}
          </div>

          {facets.categories.length > 0 && (
            <div className="shop-chips">
              <button
                type="button"
                className={"shop-chip " + (category === undefined ? "on" : "")}
                onClick={() => setCategory(undefined)}
              >
                All
              </button>
              {facets.categories.map((c) => (
                <button
                  key={c.category}
                  type="button"
                  className={"shop-chip " + (category === c.category ? "on" : "")}
                  onClick={() => setCategory(c.category)}
                >
                  {CATEGORY_LABELS[c.category] ?? c.category}
                  <span className="shop-chip-count"> ({c.count})</span>
                </button>
              ))}
            </div>
          )}

          {topTags.length > 0 && (
            <div className="shop-chips shop-chips-tags">
              {topTags.map((t) => {
                const on = selectedTags.has(t.tag)
                return (
                  <button
                    key={t.tag}
                    type="button"
                    className={"shop-chip shop-chip-sm " + (on ? "on" : "")}
                    onClick={() => {
                      const next = new Set(selectedTags)
                      on ? next.delete(t.tag) : next.add(t.tag)
                      setSelectedTags(next)
                    }}
                  >
                    {t.tag}
                    <span className="shop-chip-count"> ({t.count})</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Grid */}
          {error && (
            <div className="shop-error">{error}</div>
          )}
          {loading ? (
            <div className="shop-loading">⌛ summoning realms…</div>
          ) : items.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 32 }}>
              {filtersActive ? "По таким фильтрам ничего не нашлось." : "Магазин пока пуст."}
            </div>
          ) : (
            <>
              <div className="catalogue-grid">
                {items.map((p) => (
                  <Link
                    key={p.id ?? p.templateId}
                    to={`/shop/${p.id}`}
                    className="public-card prod-card"
                  >
                    <div className="prod-img">
                      {p.screenshots?.[0] || p.iconUrl ? (
                        <img src={p.screenshots?.[0] ?? p.iconUrl ?? ""} alt={p.name} />
                      ) : (
                        <span className="ft-fallback">{p.name[0]?.toUpperCase() ?? "✦"}</span>
                      )}
                      {p.featured && <span className="ft-badge">FEATURED</span>}
                    </div>
                    <div className="prod-body">
                      <h4>{p.name}</h4>
                      <p>{p.description ?? "Без описания"}</p>
                      {(p.tags?.length ?? 0) > 0 && (
                        <div className="prod-tags">
                          {p.tags!.slice(0, 3).map((t) => (
                            <span key={t} className="prod-tag">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="prod-foot">
                        <span className="prod-price">{priceLabel(p)}</span>
                        <span className="prod-cta">View →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="shop-pager">
                  <span>
                    {total.toLocaleString("en-US")} realms · page {page + 1} / {totalPages}
                  </span>
                  <div className="pager-buttons">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </PublicShell>
  )
}

function priceLabel(p: StoreTemplateProduct): string {
  return p.currency === "USD" ? `$${p.price.toFixed(2)}` : `${p.price.toFixed(2)} ${p.currency}`
}

function ShopStyles() {
  return (
    <style>{`
      .shop-hero {
        padding: 64px 0 36px;
        text-align: center;
      }
      .shop-eyebrow {
        display: inline-block;
        font-family: 'Cinzel'; font-size: 11px; letter-spacing: .32em;
        text-transform: uppercase; color: var(--pub-gold); margin-bottom: 14px;
      }
      .shop-hero h1 {
        font-size: clamp(32px, 4.5vw, 54px); margin-bottom: 14px;
      }
      .shop-sub {
        max-width: 60ch; margin: 0 auto; color: var(--pub-ink-soft); font-size: 16px;
      }

      /* Featured strip */
      .featured-strip {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;
      }
      .featured-tile { overflow: hidden; }
      .featured-tile .ft-img {
        aspect-ratio: 16/10; position: relative; overflow: hidden;
        background: linear-gradient(135deg, rgba(155,107,255,.2), rgba(201,164,74,.1));
      }
      .featured-tile .ft-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s; }
      .featured-tile:hover .ft-img img { transform: scale(1.04); }
      .ft-fallback {
        position: absolute; inset: 0; display: grid; place-items: center;
        font-family: 'Cinzel'; font-size: 64px; color: rgba(255,255,255,.2);
      }
      .ft-badge {
        position: absolute; top: 10px; left: 10px;
        font-family: 'Cinzel'; font-size: 9px; letter-spacing: .2em;
        padding: 3px 8px; border-radius: 4px;
        background: linear-gradient(180deg, var(--pub-gold-br), var(--pub-gold));
        color: #1a1428; font-weight: 700;
      }
      .ft-body { padding: 18px; }
      .ft-body h4 { font-size: 18px; margin-bottom: 8px; }
      .ft-body p {
        color: var(--pub-ink-soft); font-size: 13px; line-height: 1.5;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        overflow: hidden; margin-bottom: 14px;
      }
      .ft-foot {
        display: flex; align-items: center; justify-content: space-between;
        padding-top: 12px; border-top: 1px solid var(--pub-line);
      }
      .ft-price {
        font-family: 'Cinzel'; font-size: 16px; color: var(--pub-gold-br);
      }
      .ft-cat {
        font-family: 'Cinzel'; font-size: 10px; letter-spacing: .18em;
        text-transform: uppercase; color: var(--pub-ink-mut);
      }
      @media (max-width: 820px) { .featured-strip { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 540px) { .featured-strip { grid-template-columns: 1fr; } }

      /* Toolbar */
      .shop-toolbar {
        display: flex; gap: 12px; align-items: center; margin-bottom: 18px; flex-wrap: wrap;
      }
      .shop-search {
        flex: 1; min-width: 240px; position: relative;
      }
      .shop-search .ss-icon {
        position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
        color: var(--pub-ink-mut); font-size: 14px;
      }
      .shop-search input {
        width: 100%; height: 44px; padding: 0 16px 0 40px;
        background: var(--pub-panel); border: 1px solid var(--pub-line); border-radius: 30px;
        color: var(--pub-ink); font-family: inherit; font-size: 14px;
        outline: none; transition: border-color .2s;
      }
      .shop-search input:focus { border-color: var(--pub-line-2); }
      .shop-search input::placeholder { color: var(--pub-ink-mut); }
      .shop-select {
        height: 44px; padding: 0 18px;
        background: var(--pub-panel); border: 1px solid var(--pub-line); border-radius: 30px;
        color: var(--pub-ink); font-family: 'Cinzel'; font-size: 11px;
        letter-spacing: .14em; text-transform: uppercase; cursor: pointer;
      }
      .shop-clear {
        height: 44px; padding: 0 16px;
        background: transparent; border: 1px solid var(--pub-line); border-radius: 30px;
        color: var(--pub-ink-mut); font-family: 'Cinzel'; font-size: 11px;
        letter-spacing: .14em; text-transform: uppercase; cursor: pointer; transition: .2s;
      }
      .shop-clear:hover { color: var(--pub-gold-br); border-color: var(--pub-line-2); }

      /* Chips */
      .shop-chips {
        display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;
      }
      .shop-chips-tags { margin-bottom: 28px; }
      .shop-chip {
        font-family: 'Cinzel'; font-size: 11px; letter-spacing: .12em; text-transform: uppercase;
        padding: 8px 16px; border-radius: 30px;
        background: transparent; border: 1px solid var(--pub-line);
        color: var(--pub-ink-soft); cursor: pointer; transition: .2s;
      }
      .shop-chip-sm { font-size: 10px; padding: 6px 12px; letter-spacing: .08em; text-transform: none; font-family: 'Hanken Grotesk', sans-serif; }
      .shop-chip:hover { border-color: var(--pub-line-2); color: #fff; }
      .shop-chip.on {
        background: linear-gradient(180deg, var(--pub-violet), var(--pub-violet-deep));
        border-color: var(--pub-violet-br); color: #fff;
      }
      .shop-chip-count { opacity: .55; }

      /* Catalogue grid */
      .catalogue-grid {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-top: 8px;
      }
      .prod-card { display: flex; flex-direction: column; overflow: hidden; }
      .prod-card .prod-img {
        aspect-ratio: 1; position: relative; overflow: hidden;
        background: linear-gradient(135deg, rgba(155,107,255,.2), rgba(201,164,74,.1));
      }
      .prod-card .prod-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s; }
      .prod-card:hover .prod-img img { transform: scale(1.04); }
      .prod-body { padding: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
      .prod-body h4 { font-size: 15px; }
      .prod-body p {
        font-size: 12.5px; color: var(--pub-ink-mut); line-height: 1.45;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        overflow: hidden; flex: 1;
      }
      .prod-tags { display: flex; flex-wrap: wrap; gap: 4px; }
      .prod-tag {
        font-size: 9.5px; padding: 2px 6px; border-radius: 4px;
        background: rgba(155,107,255,.12); color: var(--pub-violet-br);
        border: 1px solid var(--pub-line-v);
      }
      .prod-foot {
        display: flex; align-items: center; justify-content: space-between;
        padding-top: 10px; border-top: 1px solid var(--pub-line); margin-top: 4px;
      }
      .prod-price { font-family: 'Cinzel'; font-size: 14px; color: var(--pub-gold-br); }
      .prod-cta { font-family: 'Cinzel'; font-size: 10px; letter-spacing: .18em; color: var(--pub-violet-br); }
      @media (max-width: 980px) { .catalogue-grid { grid-template-columns: repeat(3, 1fr); } }
      @media (max-width: 720px) { .catalogue-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 480px) { .catalogue-grid { grid-template-columns: 1fr; } }

      /* Pager */
      .shop-pager {
        display: flex; align-items: center; justify-content: space-between;
        margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--pub-line);
        font-family: 'Cinzel'; font-size: 11px; letter-spacing: .14em;
        text-transform: uppercase; color: var(--pub-ink-mut);
      }
      .pager-buttons { display: flex; gap: 8px; }
      .pager-buttons button {
        padding: 8px 16px; border-radius: 30px;
        background: transparent; border: 1px solid var(--pub-line);
        color: var(--pub-ink-soft); font-family: inherit; font-size: 11px;
        letter-spacing: .14em; text-transform: uppercase; cursor: pointer; transition: .2s;
      }
      .pager-buttons button:not(:disabled):hover { border-color: var(--pub-gold-deep); color: var(--pub-gold-br); }
      .pager-buttons button:disabled { opacity: .35; cursor: not-allowed; }

      .shop-loading {
        text-align: center; padding: 60px 20px; color: var(--pub-ink-mut);
        font-family: 'Cinzel'; letter-spacing: .14em;
      }
      .shop-error {
        margin: 16px 0; padding: 14px 18px; border-radius: 8px;
        background: rgba(224,112,143,.1); border: 1px solid rgba(224,112,143,.3);
        color: var(--pub-rose); font-size: 14px;
      }
    `}</style>
  )
}
