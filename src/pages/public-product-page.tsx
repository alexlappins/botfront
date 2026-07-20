import { useEffect, useRef, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { PublicShell } from "@/components/public-shell"
import {
  getStoreProduct,
  type StoreContents,
  type StoreStructure,
  type StoreTemplateProduct,
} from "@/lib/api"
import { buyProduct } from "@/lib/shop-buy"
import { formatCents } from "@/lib/price"

/**
 * Public product page /shop/[slug] (TZ-1 §3).
 * Hero (gallery + buy) → What's inside (specs + tree) → How it works →
 * description → FAQ → related. Buy goes straight to Stripe Checkout;
 * ?buy=1 (set by the OAuth returnTo) auto-resumes an interrupted purchase.
 * On mobile the Buy button sticks to the bottom of the screen.
 */
export function PublicProductPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()

  const [product, setProduct] = useState<StoreTemplateProduct | null>(null)
  const [contents, setContents] = useState<StoreContents | null>(null)
  const [structure, setStructure] = useState<StoreStructure | null>(null)
  const [related, setRelated] = useState<StoreTemplateProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [galleryIdx, setGalleryIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const autoResumed = useRef(false)

  useEffect(() => {
    if (!id) return
    let alive = true
    setLoading(true)
    setError(null)
    setGalleryIdx(0)
    getStoreProduct(id)
      .then((r) => {
        if (!alive) return
        setProduct(r.product)
        setContents(r.contents)
        setStructure(r.structure)
        setRelated(r.related)
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
  }, [id])

  // SEO (TZ-1 §2) — SPA-level title/description/og.
  useEffect(() => {
    if (!product) return
    document.title = `${product.name} — Level Up Shop`
    setMeta("description", product.description ?? `${product.name} — ready-made Discord server`)
    setMeta("og:title", `${product.name} — Level Up Shop`, true)
    setMeta("og:description", product.description ?? "", true)
    if (product.coverImageUrl) setMeta("og:image", product.coverImageUrl, true)
  }, [product])

  async function handleBuy() {
    if (!product || busy) return
    setBusy(true)
    setError(null)
    try {
      await buyProduct(product.slug ?? product.id ?? "", product.slug ?? product.id ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout error")
      setBusy(false)
    }
  }

  // OAuth return rule (TZ-1 §0): ?buy=1 means the user clicked Buy, went
  // through login and landed back here — continue to Stripe immediately.
  useEffect(() => {
    if (!product || autoResumed.current) return
    if (searchParams.get("buy") === "1") {
      autoResumed.current = true
      setSearchParams({}, { replace: true })
      void handleBuy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, searchParams])

  const buyLabel = product
    ? `${t("product.buyDeploy")} — ${priceLabel(product)}`
    : t("product.buy")

  return (
    <PublicShell activeNav="shop">
      <ProductStyles />

      <div className="public-wrap product-wrap">
        <Link to="/shop" className="back-link">
          ← {t("product.backToShop")}
        </Link>

        {loading ? (
          <div className="shop-loading">{t("shop.summoning")}</div>
        ) : error && !product ? (
          <div className="shop-error">{error ?? t("shop.notFound")}</div>
        ) : product ? (
          <>
            {/* 3.1 Hero */}
            <article className="product-grid">
              <ProductGallery product={product} index={galleryIdx} onIndex={setGalleryIdx} />

              <aside className="product-side">
                <span className="product-eyebrow">
                  {product.category ? product.category.toUpperCase() : "SERVER"}
                </span>
                <h1>{product.name}</h1>
                {product.description && (
                  <p className="product-desc">{product.description}</p>
                )}

                {(product.tags?.length ?? 0) > 0 && (
                  <div className="product-tags">
                    {product.tags!.slice(0, 6).map((tg) => (
                      <span key={tg} className="prod-tag">
                        {tg}
                      </span>
                    ))}
                  </div>
                )}

                {error && <div className="shop-error">{error}</div>}

                <div className="buy-block">
                  <div className="buy-price">
                    {product.oldPrice != null && product.oldPrice > product.price && (
                      <span className="old">{money(product.oldPrice, product.currency)}</span>
                    )}
                    <span className="big">{priceLabel(product)}</span>
                  </div>
                  <button
                    type="button"
                    className="public-btn public-btn-lg public-btn-fill buy-btn"
                    onClick={() => void handleBuy()}
                    disabled={busy}
                  >
                    {busy ? t("product.processing") : buyLabel}
                  </button>
                  <p className="trust-line">{t("product.trustLine")}</p>
                </div>
              </aside>
            </article>

            {/* 3.2 What's inside */}
            {contents && <WhatsInside contents={contents} structure={structure} />}

            {/* 3.3 How it works */}
            <HowItWorks />

            {/* 3.4 Description */}
            {product.longDescription && (
              <section className="long-desc">
                <div className="public-head">
                  <span className="eyebrow">{t("product.chronicleEyebrow")}</span>
                  <div className="row">
                    <h2>{t("product.chronicleTitle")}</h2>
                    <span className="fl" />
                    <span className="fl-end">✦</span>
                  </div>
                </div>
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(product.longDescription) }}
                />
              </section>
            )}

            {/* 3.5 FAQ */}
            <ProductFaq />

            {/* 3.6 You may also like */}
            {related.length > 0 && (
              <section className="also-like">
                <div className="public-head">
                  <span className="eyebrow">{t("product.alsoLikeEyebrow")}</span>
                  <div className="row">
                    <h2>{t("product.alsoLike")}</h2>
                    <span className="fl" />
                    <span className="fl-end">✦</span>
                  </div>
                </div>
                <div className="also-grid">
                  {related.map((p) => (
                    <Link key={p.id} to={`/shop/${p.slug ?? p.id}`} className="public-card also-card">
                      <div className="also-img">
                        {p.coverImageUrl ? (
                          <img src={p.coverImageUrl} alt={p.name} loading="lazy" decoding="async" />
                        ) : (
                          <span className="ft-fallback">{p.name[0]?.toUpperCase() ?? "✦"}</span>
                        )}
                      </div>
                      <div className="also-body">
                        <h4>{p.name}</h4>
                        <span className="also-price">{priceLabel(p)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Mobile sticky Buy (TZ-1 §3) */}
            <div className="sticky-buy">
              <span className="sticky-price">{priceLabel(product)}</span>
              <button
                type="button"
                className="public-btn public-btn-fill"
                onClick={() => void handleBuy()}
                disabled={busy}
              >
                {busy ? t("product.processing") : t("product.buyDeploy")}
              </button>
            </div>
          </>
        ) : (
          <div className="shop-error">{t("shop.notFound")}</div>
        )}
      </div>
    </PublicShell>
  )
}

function setMeta(name: string, content: string, og = false): void {
  const attr = og ? "property" : "name"
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

function ProductGallery({
  product,
  index,
  onIndex,
}: {
  product: StoreTemplateProduct
  index: number
  onIndex: (n: number) => void
}) {
  const shots = product.screenshots?.length
    ? product.screenshots
    : product.coverImageUrl
      ? [product.coverImageUrl]
      : product.iconUrl
        ? [product.iconUrl]
        : []
  if (shots.length === 0) {
    return (
      <div className="gallery gallery-empty">
        <span>{product.name[0]?.toUpperCase() ?? "✦"}</span>
      </div>
    )
  }
  const safe = Math.max(0, Math.min(shots.length - 1, index))

  // Native swipe on touch devices — buttons are fiddly on a phone.
  let touchX = 0
  function onTouchStart(e: React.TouchEvent) {
    touchX = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchX
    if (Math.abs(dx) < 40 || shots.length < 2) return
    if (dx < 0) onIndex(safe === shots.length - 1 ? 0 : safe + 1)
    else onIndex(safe === 0 ? shots.length - 1 : safe - 1)
  }

  return (
    <div className="gallery">
      <div className="gallery-main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <img src={shots[safe]} alt={`${product.name} screenshot ${safe + 1}`} />
        {shots.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => onIndex(safe === 0 ? shots.length - 1 : safe - 1)}
              className="gallery-nav gallery-prev"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => onIndex(safe === shots.length - 1 ? 0 : safe + 1)}
              className="gallery-nav gallery-next"
              aria-label="Next"
            >
              ›
            </button>
            <span className="gallery-counter">
              {safe + 1} / {shots.length}
            </span>
          </>
        )}
      </div>
      {shots.length > 1 && (
        <div className="gallery-strip">
          {shots.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => onIndex(i)}
              className={"thumb " + (i === safe ? "on" : "")}
            >
              <img src={src} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Specs strip + expandable category/channel tree + role list (TZ-1 §3.2). */
function WhatsInside({
  contents,
  structure,
}: {
  contents: StoreContents
  structure: StoreStructure | null
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const counts: { i18nKey: string; count: number; icon: string }[] = [
    { icon: "▤", i18nKey: "categories", count: contents.categories },
    { icon: "#", i18nKey: "channels", count: contents.channels },
    { icon: "◈", i18nKey: "roles", count: contents.roles },
    { icon: "📜", i18nKey: "messages", count: contents.messages },
    { icon: "🎟", i18nKey: "reactionRoles", count: contents.reactionRoles },
    { icon: "😺", i18nKey: "emojis", count: contents.emojis },
    { icon: "✦", i18nKey: "welcomeVariants", count: contents.welcomeVariants },
  ].filter((c) => c.count > 0)
  const modules: { i18nKey: string; on: boolean }[] = [
    { i18nKey: "serverStats", on: contents.serverStatsEnabled },
    { i18nKey: "welcome", on: contents.welcomeEnabled },
    { i18nKey: "goodbye", on: contents.goodbyeEnabled },
    { i18nKey: "leveling", on: contents.levelingEnabled },
  ].filter((m) => m.on)

  const hasTree =
    structure && (structure.categories.length > 0 || structure.uncategorized.length > 0 || structure.roles.length > 0)

  return (
    <section className="inside-section">
      <div className="public-head">
        <span className="eyebrow">{t("product.insideEyebrow")}</span>
        <div className="row">
          <h2>{t("product.whatsInside")}</h2>
          <span className="fl" />
          <span className="fl-end">✦</span>
        </div>
      </div>

      <div className="inside-counts">
        {counts.map((c) => (
          <div key={c.i18nKey} className="inside-count">
            <span className="inside-ic">{c.icon}</span>
            <b>{c.count}</b> {t(`product.contentLabels.${c.i18nKey}`)}
          </div>
        ))}
        {modules.map((m) => (
          <div key={m.i18nKey} className="inside-count inside-mod-count">
            ✓ {t(`product.contentLabels.${m.i18nKey}`)}
          </div>
        ))}
      </div>

      {hasTree && (
        <div className="tree-block">
          <button type="button" className="tree-toggle" onClick={() => setOpen((v) => !v)}>
            {open ? "▾" : "▸"} {t("product.fullStructure")}
          </button>
          {open && structure && (
            <div className="tree-grid">
              <div className="tree-col">
                {structure.categories.map((cat) => (
                  <div key={cat.name} className="tree-cat">
                    <p className="tree-cat-name">▤ {cat.name}</p>
                    {cat.channels.map((ch) => (
                      <p key={ch.name} className="tree-ch">
                        {ch.type === 2 ? "🔊" : "#"} {ch.name}
                      </p>
                    ))}
                  </div>
                ))}
                {structure.uncategorized.length > 0 && (
                  <div className="tree-cat">
                    {structure.uncategorized.map((ch) => (
                      <p key={ch.name} className="tree-ch">
                        {ch.type === 2 ? "🔊" : "#"} {ch.name}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              {structure.roles.length > 0 && (
                <div className="tree-col">
                  <p className="tree-cat-name">{t("product.rolesTitle")}</p>
                  {structure.roles.map((r) => (
                    <p key={r.name} className="tree-role">
                      <span
                        className="role-dot"
                        style={{ background: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#99aab5" }}
                      />
                      {r.name}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** TZ-2 §5: Buy → Create your server → Bot sets up everything automatically. */
function HowItWorks() {
  const { t } = useTranslation()
  const steps = [
    { n: 1, icon: "🛒", key: "buy" },
    { n: 2, icon: "✨", key: "create" },
    { n: 3, icon: "🤖", key: "auto" },
  ]
  return (
    <section className="hiw">
      <div className="public-head">
        <span className="eyebrow">{t("product.hiwEyebrow")}</span>
        <div className="row">
          <h2>{t("product.hiwTitle")}</h2>
          <span className="fl" />
          <span className="fl-end">✦</span>
        </div>
      </div>
      <div className="hiw-grid">
        {steps.map((s) => (
          <div key={s.n} className="public-card hiw-card">
            <span className="hiw-num">{s.n}</span>
            <span className="hiw-icon">{s.icon}</span>
            <h4>{t(`product.hiw.${s.key}Title`)}</h4>
            <p>{t(`product.hiw.${s.key}Body`)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/** FAQ accordion (TZ-1 §3.5, texts per TZ-2 §5 where specified). */
function ProductFaq() {
  const { t } = useTranslation()
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const items = ["existing", "channels", "customize", "redeploy", "support"]
  return (
    <section className="faq">
      <div className="public-head">
        <span className="eyebrow">{t("product.faqEyebrow")}</span>
        <div className="row">
          <h2>{t("product.faqTitle")}</h2>
          <span className="fl" />
          <span className="fl-end">✦</span>
        </div>
      </div>
      <div className="faq-list">
        {items.map((key, i) => (
          <div key={key} className={"faq-item " + (openIdx === i ? "open" : "")}>
            <button type="button" className="faq-q" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
              {t(`product.faq.${key}Q`)}
              <span className="faq-chevron">{openIdx === i ? "−" : "+"}</span>
            </button>
            {openIdx === i && <p className="faq-a">{t(`product.faq.${key}A`)}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function money(v: number, currency: string): string {
  return formatCents(v, currency)
}

function priceLabel(p: StoreTemplateProduct): string {
  return money(p.price, p.currency)
}

function simpleMarkdownToHtml(s: string): string {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return esc
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /`([^`]+)`/g,
      "<code style='background:rgba(255,255,255,0.06);padding:0 4px;border-radius:3px;font-size:0.9em'>$1</code>",
    )
    .replace(/\n\n/g, "<br/><br/>")
}

function ProductStyles() {
  return (
    <style>{`
      .product-wrap { padding-top: 40px; padding-bottom: 80px; position: relative; z-index: 2; }
      .back-link {
        display: inline-block; margin-bottom: 20px;
        font-family: 'Cinzel'; font-size: 11px; letter-spacing: .2em;
        text-transform: uppercase; color: var(--pub-ink-mut); transition: color .2s;
      }
      .back-link:hover { color: var(--pub-gold-br); }

      .product-grid {
        display: grid; grid-template-columns: 1.4fr 1fr; gap: 36px;
      }
      @media (max-width: 960px) { .product-grid { grid-template-columns: 1fr; } }

      /* Gallery */
      .gallery { display: flex; flex-direction: column; gap: 10px; }
      /* 16:9 so 1920×1080 screenshots show FULLY, никогда не обрезаются (TZ §5). */
      .gallery-main {
        position: relative; aspect-ratio: 16/9;
        border: 1px solid var(--pub-line); border-radius: 12px; overflow: hidden;
        background: rgba(10,8,16,.6);
      }
      .gallery-main img { width: 100%; height: 100%; object-fit: contain; }
      .gallery-empty {
        aspect-ratio: 16/10; border: 1px solid var(--pub-line); border-radius: 12px;
        display: grid; place-items: center; font-family: 'Cinzel'; font-size: 80px;
        color: rgba(255,255,255,.2);
        background: linear-gradient(135deg, rgba(155,107,255,.15), rgba(201,164,74,.05));
      }
      .gallery-nav {
        position: absolute; top: 50%; transform: translateY(-50%);
        width: 44px; height: 44px; border-radius: 50%;
        background: rgba(20,15,30,.7); border: 1px solid var(--pub-line);
        color: var(--pub-gold-br); font-size: 24px; cursor: pointer;
        display: grid; place-items: center; transition: .2s;
      }
      .gallery-nav:hover { background: rgba(20,15,30,.9); border-color: var(--pub-gold-deep); }
      .gallery-prev { left: 12px; }
      .gallery-next { right: 12px; }
      .gallery-counter {
        position: absolute; bottom: 10px; right: 10px;
        padding: 4px 12px; border-radius: 12px;
        background: rgba(20,15,30,.7); color: var(--pub-ink-soft);
        font-family: 'Cinzel'; font-size: 11px; letter-spacing: .12em;
      }
      .gallery-strip {
        display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;
      }
      .gallery-strip .thumb {
        flex-shrink: 0; width: 80px; height: 48px;
        border: 2px solid transparent; border-radius: 6px; overflow: hidden;
        background: transparent; cursor: pointer; padding: 0; transition: border-color .2s;
      }
      .gallery-strip .thumb.on { border-color: var(--pub-gold); }
      .gallery-strip .thumb img { width: 100%; height: 100%; object-fit: cover; }

      /* Phone: the gallery must not crop screenshots or hide behind tiny
         controls — full-bleed width, contain-fit image, swipe to navigate,
         dots instead of overlapping arrows, bigger thumb targets. */
      @media (max-width: 720px) {
        .product-wrap { padding-top: 20px; }
        .product-grid { gap: 20px; }
        .gallery-main {
          aspect-ratio: 16/9; border-radius: 10px;
          background: rgba(10,8,16,.6);
        }
        .gallery-main img { object-fit: contain; }
        .gallery-nav { display: none; }         /* swipe handles it */
        .gallery-counter {
          bottom: 8px; right: 8px; padding: 3px 10px; font-size: 10px;
        }
        .gallery-strip { gap: 8px; padding: 2px 2px 6px; }
        .gallery-strip .thumb { width: 68px; height: 44px; border-radius: 8px; }
        .product-side h1 { font-size: 24px; }
        .buy-block { padding: 16px; }
        .buy-price .big { font-size: 26px; }
      }

      /* Side */
      .product-side { display: flex; flex-direction: column; gap: 14px; }
      .product-eyebrow {
        font-family: 'Cinzel'; font-size: 10px; letter-spacing: .26em;
        color: var(--pub-gold);
      }
      .product-side h1 {
        font-size: clamp(26px, 3.4vw, 38px); margin-bottom: 4px;
      }
      .product-desc {
        color: var(--pub-ink-soft); font-size: 15px; line-height: 1.55;
      }
      .product-tags { display: flex; flex-wrap: wrap; gap: 6px; }
      .prod-tag {
        font-size: 10px; padding: 3px 8px; border-radius: 4px;
        background: rgba(155,107,255,.12); color: var(--pub-violet-br);
        border: 1px solid var(--pub-line-v);
      }

      .buy-block {
        margin-top: 6px; padding: 22px;
        background: linear-gradient(180deg, rgba(155,107,255,.08), rgba(20,15,30,.6));
        border: 1px solid var(--pub-line-2); border-radius: 12px;
      }
      .buy-price {
        display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px;
      }
      .buy-price .big {
        font-family: 'Cinzel'; font-size: 32px; color: var(--pub-gold-br);
        text-shadow: 0 0 24px rgba(201,164,74,.4);
      }
      .buy-price .old {
        font-family: 'Cinzel'; font-size: 18px; color: var(--pub-ink-mut);
        text-decoration: line-through;
      }
      .buy-btn { width: 100%; justify-content: center; }
      .buy-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }
      .trust-line {
        margin-top: 12px; font-size: 12px; color: var(--pub-ink-mut); text-align: center;
        line-height: 1.5;
      }

      /* What's inside */
      .inside-section { margin-top: 64px; }
      .inside-counts {
        display: flex; flex-wrap: wrap; gap: 10px;
      }
      .inside-count {
        display: inline-flex; align-items: center; gap: 8px;
        font-size: 13.5px; color: var(--pub-ink-soft);
        padding: 8px 14px; border-radius: 30px;
        background: var(--pub-panel); border: 1px solid var(--pub-line);
      }
      .inside-count b { color: #fff; font-family: 'Cinzel'; }
      .inside-ic {
        width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center;
        background: rgba(155,107,255,.15); border: 1px solid var(--pub-line-v);
        color: var(--pub-violet-br); font-size: 10px;
      }
      .inside-mod-count { color: #98d6a8; border-color: rgba(110,200,140,.25); }

      .tree-block { margin-top: 18px; }
      .tree-toggle {
        background: transparent; border: 1px solid var(--pub-line); border-radius: 8px;
        color: var(--pub-ink-soft); padding: 10px 16px; font-size: 13px; cursor: pointer;
        transition: .2s;
      }
      .tree-toggle:hover { border-color: var(--pub-line-2); color: #fff; }
      .tree-grid {
        margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
        padding: 20px; background: var(--pub-panel);
        border: 1px solid var(--pub-line); border-radius: 12px;
      }
      @media (max-width: 720px) { .tree-grid { grid-template-columns: 1fr; } }
      .tree-cat { margin-bottom: 14px; }
      .tree-cat-name {
        font-family: 'Cinzel'; font-size: 11px; letter-spacing: .16em;
        text-transform: uppercase; color: var(--pub-gold); margin-bottom: 6px;
      }
      .tree-ch { font-size: 13px; color: var(--pub-ink-soft); padding: 2px 0 2px 14px; }
      .tree-role {
        display: flex; align-items: center; gap: 8px;
        font-size: 13px; color: var(--pub-ink-soft); padding: 3px 0;
      }
      .role-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

      /* How it works */
      .hiw { margin-top: 64px; }
      .hiw-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
      @media (max-width: 720px) { .hiw-grid { grid-template-columns: 1fr; } }
      .hiw-card { padding: 22px; position: relative; }
      .hiw-num {
        position: absolute; top: 14px; right: 16px;
        font-family: 'Cinzel'; font-size: 30px; color: rgba(255,255,255,.08);
      }
      .hiw-icon { font-size: 26px; display: block; margin-bottom: 10px; }
      .hiw-card h4 { font-size: 16px; margin-bottom: 8px; }
      .hiw-card p { font-size: 13.5px; color: var(--pub-ink-soft); line-height: 1.55; }

      /* Long description */
      .long-desc { margin-top: 64px; }
      .markdown-body {
        color: var(--pub-ink-soft); font-size: 15.5px; line-height: 1.75;
        max-width: 70ch; white-space: pre-wrap;
      }
      .markdown-body strong { color: #fff; }
      .markdown-body em { color: var(--pub-gold-br); font-style: italic; }

      /* FAQ */
      .faq { margin-top: 64px; }
      .faq-list { max-width: 760px; }
      .faq-item { border-bottom: 1px solid var(--pub-line); }
      .faq-q {
        width: 100%; display: flex; align-items: center; justify-content: space-between;
        gap: 16px; padding: 16px 4px; background: transparent; border: 0;
        color: var(--pub-ink); font-size: 15px; text-align: left; cursor: pointer;
        font-family: inherit;
      }
      .faq-q:hover { color: var(--pub-gold-br); }
      .faq-chevron { color: var(--pub-gold); font-size: 18px; }
      .faq-a {
        padding: 0 4px 16px; color: var(--pub-ink-soft); font-size: 14px; line-height: 1.65;
        max-width: 65ch;
      }

      /* Also like */
      .also-like { margin-top: 64px; }
      .also-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      @media (max-width: 960px) { .also-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 520px) { .also-grid { grid-template-columns: 1fr; } }
      .also-card { overflow: hidden; }
      .also-img {
        aspect-ratio: 16/9; overflow: hidden; position: relative;
        background: linear-gradient(135deg, rgba(155,107,255,.2), rgba(201,164,74,.1));
      }
      .also-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s; }
      .also-card:hover .also-img img { transform: scale(1.04); }
      .also-body { padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
      .also-body h4 { font-size: 14px; }
      .also-price { font-family: 'Cinzel'; font-size: 13px; color: var(--pub-gold-br); white-space: nowrap; }

      /* Mobile sticky buy */
      .sticky-buy {
        display: none;
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
        padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
        background: rgba(14,10,22,.92); backdrop-filter: blur(10px);
        border-top: 1px solid var(--pub-line-2);
        align-items: center; justify-content: space-between; gap: 12px;
      }
      .sticky-price { font-family: 'Cinzel'; font-size: 18px; color: var(--pub-gold-br); }
      @media (max-width: 720px) { .sticky-buy { display: flex; } }

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
