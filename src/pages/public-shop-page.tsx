import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
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
import { buyProduct } from "@/lib/shop-buy"
import { formatCents } from "@/lib/price"

const CATEGORY_LABELS: Record<StoreCategory, string> = {
  streamer: "Streamer",
  vtuber: "VTuber",
  gaming: "Gaming",
  community: "Community",
  anime: "Anime",
  crypto: "Crypto",
  streaming: "Streaming",
  other: "Other",
}

const SORT_KEYS: StoreSort[] = ["newest", "popular", "price_asc", "price_desc"]
/** Map sort key → i18n leaf for the label. */
const SORT_I18N: Record<StoreSort, string> = {
  newest: "shop.sort.newest",
  popular: "shop.sort.popular",
  price_asc: "shop.sort.priceAsc",
  price_desc: "shop.sort.priceDesc",
}

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
  const { t } = useTranslation()

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [category, setCategory] = useState<StoreCategory | undefined>(undefined)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<StoreSort>("newest")
  const [page, setPage] = useState(0)

  // SEO (TZ-1 §2).
  useEffect(() => {
    document.title = "Shop — ready-made Discord servers | Level Up"
    const el =
      document.head.querySelector<HTMLMetaElement>('meta[name="description"]') ??
      (() => {
        const m = document.createElement("meta")
        m.name = "description"
        document.head.appendChild(m)
        return m
      })()
    el.content = "Ready-made Discord servers: buy, create a server, and the bot sets up everything automatically."
  }, [])

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
          <span className="shop-eyebrow">{t("shop.eyebrow")}</span>
          <h1>{t("shop.title")}</h1>
          <p className="shop-sub">{t("shop.sub")}</p>
        </div>
      </header>

      {/* Featured strip */}
      {!filtersActive && featured.length > 0 && (
        <section className="public-section" style={{ paddingTop: 40, paddingBottom: 40 }}>
          <div className="public-wrap">
            <div className="public-head">
              <span className="eyebrow">{t("shop.featuredEyebrow")}</span>
              <div className="row">
                <h2>{t("shop.featuredTitle")}</h2>
                <span className="fl" />
                <span className="fl-end">✦</span>
              </div>
            </div>
            <div className="featured-strip">
              {featured.map((p) => (
                <Link key={p.id ?? p.templateId} to={`/shop/${p.slug ?? p.id}`} className="public-card featured-tile">
                  <div className="ft-img">
                    {p.coverImageUrl || p.screenshots?.[0] || p.iconUrl ? (
                      <img src={p.coverImageUrl ?? p.screenshots?.[0] ?? p.iconUrl ?? ""} alt={p.name} loading="lazy" decoding="async" />
                    ) : (
                      <span className="ft-fallback">{p.name[0]?.toUpperCase() ?? "✦"}</span>
                    )}
                    <span className="ft-badge">FEATURED</span>
                  </div>
                  <div className="ft-body">
                    <h4>{p.name}</h4>
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
            <span className="eyebrow">{t("shop.catalogueEyebrow")}</span>
            <div className="row">
              <h2>{t("shop.catalogueTitle")}</h2>
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
                placeholder={t("shop.searchPlaceholder")}
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as StoreSort)}
              className="shop-select"
            >
              {SORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(SORT_I18N[k])}
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
                ✕ {t("shop.reset")}
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
                {t("shop.all")}
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
              {/* Renamed `t` callback param → `tg` to avoid shadowing
                  the useTranslation()'s `t` function. */}
              {topTags.map((tg) => {
                const on = selectedTags.has(tg.tag)
                return (
                  <button
                    key={tg.tag}
                    type="button"
                    className={"shop-chip shop-chip-sm " + (on ? "on" : "")}
                    onClick={() => {
                      const next = new Set(selectedTags)
                      on ? next.delete(tg.tag) : next.add(tg.tag)
                      setSelectedTags(next)
                    }}
                  >
                    {tg.tag}
                    <span className="shop-chip-count"> ({tg.count})</span>
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
            <div className="shop-loading">{t("shop.loadingRealms")}</div>
          ) : items.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 32 }}>
              {filtersActive ? t("shop.noResults") : t("shop.empty")}
            </div>
          ) : (
            <>
              <div className="catalogue-grid">
                {items.map((p) => (
                  <ProductCard key={p.id ?? p.templateId} product={p} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="shop-pager">
                  <span>
                    {total.toLocaleString("en-US")} {t("shop.realmsLeft")} · {t("shop.page")} {page + 1} / {totalPages}
                  </span>
                  <div className="pager-buttons">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                    >
                      ← {t("common.back")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      {t("common.next")} →
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
  return formatCents(p.price, p.currency)
}

/**
 * Catalog card (TZ-1 §2): 16:9 cover, name, category + tags, price and a Buy
 * button RIGHT ON THE CARD. Hovering the cover auto-cycles the first 3
 * screenshots.
 */
function ProductCard({ product: p }: { product: StoreTemplateProduct }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const slugPath = `/shop/${p.slug ?? p.id}`
  const shots = useMemo(() => {
    const list = [p.coverImageUrl, ...(p.screenshots ?? [])].filter(Boolean) as string[]
    return [...new Set(list)].slice(0, 3)
  }, [p])
  const [shotIdx, setShotIdx] = useState(0)
  const [buying, setBuying] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCycle() {
    if (shots.length < 2 || hoverTimer.current) return
    hoverTimer.current = setInterval(() => {
      setShotIdx((i) => (i + 1) % shots.length)
    }, 1100)
  }
  function stopCycle() {
    if (hoverTimer.current) clearInterval(hoverTimer.current)
    hoverTimer.current = null
    setShotIdx(0)
  }
  useEffect(() => stopCycle, [])

  async function handleBuy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (buying) return
    setBuying(true)
    try {
      await buyProduct(p.slug ?? p.id ?? "", p.slug ?? p.id ?? "")
    } catch {
      // On error fall back to the product page where the message is shown.
      navigate(slugPath)
    }
  }

  return (
    <Link
      to={slugPath}
      className="public-card prod-card"
      onMouseEnter={startCycle}
      onMouseLeave={stopCycle}
    >
      <div className="prod-img">
        {shots.length > 0 ? (
          <img src={shots[Math.min(shotIdx, shots.length - 1)]} alt={p.name} loading="lazy" decoding="async" />
        ) : p.iconUrl ? (
          <img src={p.iconUrl} alt={p.name} loading="lazy" decoding="async" />
        ) : (
          <span className="ft-fallback">{p.name[0]?.toUpperCase() ?? "✦"}</span>
        )}
        {p.featured && <span className="ft-badge">FEATURED</span>}
      </div>
      <div className="prod-body">
        <h4>{p.name}</h4>
        <div className="prod-tags">
          {p.category && <span className="prod-tag prod-tag-cat">{CATEGORY_LABELS[p.category] ?? p.category}</span>}
          {(p.tags ?? []).slice(0, 2).map((tg) => (
            <span key={tg} className="prod-tag">
              {tg}
            </span>
          ))}
        </div>
        <div className="prod-foot">
          <span className="prod-price">
            {p.oldPrice != null && p.oldPrice > p.price && (
              <span className="prod-old">{formatCents(p.oldPrice, p.currency)}</span>
            )}
            {priceLabel(p)}
          </span>
          <button type="button" className="prod-buy" onClick={handleBuy} disabled={buying}>
            {buying ? "…" : t("shop.buy")}
          </button>
        </div>
      </div>
    </Link>
  )
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
        aspect-ratio: 16/9; position: relative; overflow: hidden;
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
      .prod-price { font-family: 'Cinzel'; font-size: 14px; color: var(--pub-gold-br); display: flex; align-items: baseline; gap: 8px; }
      .prod-old { font-size: 11px; color: var(--pub-ink-mut); text-decoration: line-through; }
      .prod-tag-cat { background: rgba(201,164,74,.12); color: var(--pub-gold-br); border-color: rgba(201,164,74,.3); }
      .prod-buy {
        font-family: 'Cinzel'; font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
        padding: 7px 16px; border-radius: 20px; cursor: pointer; transition: .2s;
        background: linear-gradient(180deg, var(--pub-violet), var(--pub-violet-deep));
        border: 1px solid var(--pub-violet-br); color: #fff;
      }
      .prod-buy:hover { filter: brightness(1.15); }
      .prod-buy:disabled { opacity: .5; cursor: wait; }
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
