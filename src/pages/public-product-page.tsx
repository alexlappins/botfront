import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { PublicShell } from "@/components/public-shell"
import { useAuth } from "@/contexts/auth-context"
import {
  checkoutTemplate,
  getStoreProduct,
  type StoreContents,
  type StoreTemplateProduct,
} from "@/lib/api"

/**
 * Public product detail at /shop/:id.
 *
 * Anyone can view. The "Buy" CTA behaves as follows:
 *   - guest      → redirect to OAuth, return URL preserved via ?next so we land back here after sign-in
 *   - customer   → triggers checkout, then redirects to /store (my-purchases) for install
 *   - admin      → just open the dashboard (admins don't buy)
 */
export function PublicProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation()

  const [product, setProduct] = useState<StoreTemplateProduct | null>(null)
  const [contents, setContents] = useState<StoreContents | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [galleryIdx, setGalleryIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    setLoading(true)
    setError(null)
    getStoreProduct(id)
      .then((r) => {
        if (!alive) return
        setProduct(r.product)
        setContents(r.contents)
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

  async function handleBuy() {
    if (!product) return
    if (!user) {
      // Stash where to come back to so the buy flow continues post-login.
      // The OAuth callback uses FRONTEND_URL — we can't pass state through it
      // generically, so we rely on the user clicking Buy again after sign-in.
      const next = encodeURIComponent(`/shop/${id ?? ""}`)
      window.location.href = `/api/auth/discord?next=${next}`
      return
    }
    if (user.role === "admin") {
      navigate("/server-templates")
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await checkoutTemplate(product.templateId)
      setSuccess(t("product.purchased"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicShell activeNav="shop">
      <ProductStyles />

      <div className="public-wrap product-wrap">
        <Link to="/shop" className="back-link">
          ← {t("product.backToShop")}
        </Link>

        {loading ? (
          <div className="shop-loading">{t("shop.summoning")}</div>
        ) : error || !product ? (
          <div className="shop-error">{error ?? t("shop.notFound")}</div>
        ) : (
          <article className="product-grid">
            {/* Gallery */}
            <ProductGallery product={product} index={galleryIdx} onIndex={setGalleryIdx} />

            {/* Side */}
            <aside className="product-side">
              <span className="product-eyebrow">
                {product.category ? product.category.toUpperCase() : "REALM"}
              </span>
              <h1>{product.name}</h1>
              {product.description && <p className="product-desc">{product.description}</p>}

              {(product.tags?.length ?? 0) > 0 && (
                <div className="product-tags">
                  {product.tags!.map((tg) => (
                    <span key={tg} className="prod-tag">
                      {tg}
                    </span>
                  ))}
                </div>
              )}

              {success && <div className="success-banner">✓ {success}</div>}

              <div className="buy-block">
                <div className="buy-price">
                  <span className="big">{priceLabel(product)}</span>
                  <span className="hint">{t("product.perInstall")}</span>
                </div>
                <button
                  type="button"
                  className="public-btn public-btn-lg public-btn-fill buy-btn"
                  onClick={handleBuy}
                  disabled={busy}
                >
                  {busy ? t("product.processing") : user ? t("product.buy") : t("product.signInToBuy")}
                </button>
                <p className="buy-hint">
                  {user ? t("product.buyHintLoggedIn") : t("product.buyHintGuest")}
                </p>
              </div>

              {contents && <WhatsInside contents={contents} />}
            </aside>
          </article>
        )}

        {product?.longDescription && (
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
      </div>
    </PublicShell>
  )
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
  const images = product.screenshots?.length
    ? product.screenshots
    : product.iconUrl
      ? [product.iconUrl]
      : []
  if (images.length === 0) {
    return (
      <div className="gallery gallery-empty">
        <span>{product.name[0]?.toUpperCase() ?? "✦"}</span>
      </div>
    )
  }
  const safe = Math.max(0, Math.min(images.length - 1, index))
  return (
    <div className="gallery">
      <div className="gallery-main">
        <img src={images[safe]} alt={`${product.name} screenshot ${safe + 1}`} />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => onIndex(safe === 0 ? images.length - 1 : safe - 1)}
              className="gallery-nav gallery-prev"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => onIndex(safe === images.length - 1 ? 0 : safe + 1)}
              className="gallery-nav gallery-next"
              aria-label="Next"
            >
              ›
            </button>
            <span className="gallery-counter">
              {safe + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="gallery-strip">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => onIndex(i)}
              className={"thumb " + (i === safe ? "on" : "")}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function WhatsInside({ contents }: { contents: StoreContents }) {
  const { t } = useTranslation()
  const counts: { i18nKey: string; count: number; icon: string }[] = [
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

  return (
    <div className="inside-block">
      <h3>{t("product.whatsInside")}</h3>
      {counts.length === 0 ? (
        <p className="inside-empty">{t("product.stillFilling")}</p>
      ) : (
        <ul className="inside-list">
          {counts.map((c) => (
            <li key={c.i18nKey}>
              <span className="inside-ic">{c.icon}</span>
              <span>
                <b>{c.count}</b> {t(`product.contentLabels.${c.i18nKey}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {modules.length > 0 && (
        <div className="inside-modules">
          {modules.map((m) => (
            <span key={m.i18nKey} className="inside-mod">
              ✓ {t(`product.contentLabels.${m.i18nKey}`)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function priceLabel(p: StoreTemplateProduct): string {
  return p.currency === "USD" ? `$${p.price.toFixed(2)}` : `${p.price.toFixed(2)} ${p.currency}`
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
      .gallery-main {
        position: relative; aspect-ratio: 16/10;
        border: 1px solid var(--pub-line); border-radius: 12px; overflow: hidden;
        background: linear-gradient(135deg, rgba(155,107,255,.2), rgba(201,164,74,.1));
      }
      .gallery-main img { width: 100%; height: 100%; object-fit: cover; }
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
        display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px;
      }
      .buy-price .big {
        font-family: 'Cinzel'; font-size: 32px; color: var(--pub-gold-br);
        text-shadow: 0 0 24px rgba(201,164,74,.4);
      }
      .buy-price .hint {
        font-family: 'Cinzel'; font-size: 10px; letter-spacing: .2em;
        text-transform: uppercase; color: var(--pub-ink-mut);
      }
      .buy-btn { width: 100%; justify-content: center; }
      .buy-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }
      .buy-hint {
        margin-top: 12px; font-size: 12px; color: var(--pub-ink-mut); text-align: center;
        line-height: 1.5;
      }

      .success-banner {
        padding: 12px 16px; border-radius: 8px;
        background: rgba(110,200,140,.1); border: 1px solid rgba(110,200,140,.3);
        color: #98d6a8; font-size: 14px;
      }

      /* What's inside */
      .inside-block {
        margin-top: 4px; padding: 20px;
        background: var(--pub-panel); border: 1px solid var(--pub-line); border-radius: 12px;
      }
      .inside-block h3 {
        font-size: 13px; letter-spacing: .22em; text-transform: uppercase;
        color: var(--pub-gold); margin-bottom: 14px;
      }
      .inside-list {
        list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
      }
      .inside-list li {
        display: flex; align-items: center; gap: 8px;
        font-size: 13px; color: var(--pub-ink-soft);
      }
      .inside-list li b { color: #fff; font-family: 'Cinzel'; }
      .inside-ic {
        width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center;
        background: rgba(155,107,255,.15); border: 1px solid var(--pub-line-v);
        color: var(--pub-violet-br); font-size: 11px;
      }
      .inside-empty { color: var(--pub-ink-mut); font-size: 13px; }
      .inside-modules {
        margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--pub-line);
        display: flex; flex-wrap: wrap; gap: 8px;
      }
      .inside-mod {
        font-size: 12px; color: var(--pub-ink-soft);
        padding: 4px 10px; border-radius: 30px;
        background: rgba(110,200,140,.08); border: 1px solid rgba(110,200,140,.2);
      }

      /* Long description */
      .long-desc { margin-top: 60px; }
      .markdown-body {
        color: var(--pub-ink-soft); font-size: 15.5px; line-height: 1.75;
        max-width: 70ch; white-space: pre-wrap;
      }
      .markdown-body strong { color: #fff; }
      .markdown-body em { color: var(--pub-gold-br); font-style: italic; }
    `}</style>
  )
}
