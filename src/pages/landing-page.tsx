import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Trans, useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/auth-context"
import { getStoreFeatured, type StoreTemplateProduct } from "@/lib/api"
import { PublicShell } from "@/components/public-shell"

/**
 * Reveals every `[data-reveal]` element under document when it scrolls into
 * view by flipping the `.is-visible` class. Each element animates once and is
 * then unobserved — cheap, and feels right for a landing where users only
 * read top-to-bottom. Stagger on lists is done by setting `--reveal-delay`
 * inline on each item; the CSS reads it as `transition-delay`.
 */
function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)")
    if (!els.length) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible")
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/**
 * Thin scroll-progress bar across the top of the viewport. Acts as a
 * page-wide visual connector tying scroll position to the landing's blurple
 * accent. Uses transform:scaleX (compositor-only) so it's cheap.
 */
function ScrollProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    function update() {
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      setProgress(max > 0 ? doc.scrollTop / max : 0)
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])
  return <div className="lp-scroll-prog" style={{ transform: `scaleX(${progress})` }} />
}

/**
 * Public landing page at `/`. Browsable without login.
 *
 * Sections (top → bottom):
 *   1. Hero — headline + 2 CTAs (Add to Discord, Enter the Shop)
 *   2. Stats strip — social proof (placeholder figures, replace with real later)
 *   3. Features grid — 6 capability cards
 *   4. Featured products — pulled from the existing store (hero of /shop)
 *   5. Final CTA — go live
 *
 * Aesthetic ("dark fantasy / arcane") and most styles live in PublicShell.
 * Section-specific styles inlined below for self-containment.
 */
export function LandingPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [featured, setFeatured] = useState<StoreTemplateProduct[]>([])

  useEffect(() => {
    let alive = true
    getStoreFeatured()
      .then((items) => {
        if (alive) setFeatured(items)
      })
      .catch(() => {
        // Featured rail is optional — landing still works without it.
      })
    return () => {
      alive = false
    }
  }, [])

  // Re-run when `featured` lands so the shop-rail tiles get observed too.
  useScrollReveal([featured.length])

  const botInvite =
    (import.meta.env.VITE_BOT_INVITE_URL as string | undefined) ?? "https://discord.com/oauth2/authorize"
  const loginHref = "/api/auth/discord"
  const dashboardHref = user?.role === "admin" ? "/server-templates" : "/store"

  return (
    <PublicShell activeNav="home">
      <LandingStyles />
      <ScrollProgress />

      {/* Hero + Stats — neon "gamer" variant. Self-contained styles below
          (.lu-*) so the rest of the landing's fantasy aesthetic is unaffected. */}
      <NeonHeroStats botInvite={botInvite} />


      {/* Features */}
      <section id="features" className="public-section">
        <div className="public-wrap">
          <div className="public-head" data-reveal>
            <span className="eyebrow">{t("landing.features.eyebrow")}</span>
            <div className="row">
              <h2>{t("landing.features.title")}</h2>
              <span className="fl" />
              <span className="fl-end">✦</span>
            </div>
          </div>
          <div className="fgrid">
            {FEATURES.map((f, i) => (
              <div
                key={f.i18nKey}
                className={`fcard ${f.feat ? "feat" : ""}`}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${i * 70}ms` }}
              >
                <div className="thumb">
                  <FeatureIcon name={f.i18nKey} />
                </div>
                <div className="body">
                  <span className="cat">{t(`landing.features.${f.i18nKey}.cat`)}</span>
                  <h4>{t(`landing.features.${f.i18nKey}.title`)}</h4>
                  {f.feat && (
                    <p>{t(`landing.features.${f.i18nKey}.desc`)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="public-divider" />

      {/* Featured products from the store */}
      <section id="shop" className="public-section">
        <div className="public-wrap">
          <div className="public-head" data-reveal>
            <span className="eyebrow">{t("landing.shop.eyebrow")}</span>
            <div className="row">
              <h2>{t("landing.shop.title")}</h2>
              <span className="fl" />
              <span className="fl-end">✦</span>
            </div>
            <p className="public-sub">{t("landing.shop.sub")}</p>
          </div>

          {featured.length === 0 ? (
            <div className="empty-state" data-reveal>
              <p>{t("landing.shop.empty")}</p>
            </div>
          ) : (
            <div className="gal">
              {featured.map((p, i) => (
                <Link
                  key={p.id ?? p.templateId}
                  to={`/shop/${p.id}`}
                  className="gtile public-card"
                  data-reveal
                  style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}
                >
                  <div className="gtile-img">
                    {p.screenshots?.[0] || p.iconUrl ? (
                      <img src={p.screenshots?.[0] ?? p.iconUrl ?? ""} alt={p.name} />
                    ) : (
                      <span className="gtile-fallback">{p.name[0]?.toUpperCase() ?? "✦"}</span>
                    )}
                    <div className="play">▶</div>
                  </div>
                  <span className="cap">
                    {p.name}
                    {p.category ? ` · ${p.category}` : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 34 }} data-reveal>
            <Link to="/shop" className="public-btn public-btn-lg">
              {t("landing.shop.openShop")}
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final">
        <div className="public-wrap final-in">
          <h2 data-reveal>
            <Trans i18nKey="landing.final.title" components={{ em: <span className="hero-em" /> }} />
          </h2>
          <p data-reveal style={{ ["--reveal-delay" as string]: "100ms" }}>
            {t("landing.final.sub")}
          </p>
          <div
            className="hero-actions"
            data-reveal
            style={{ justifyContent: "center", ["--reveal-delay" as string]: "200ms" }}
          >
            <a href={botInvite} target="_blank" rel="noopener noreferrer" className="public-btn public-btn-lg">
              {t("common.addToDiscord")}
            </a>
            {user ? (
              <Link to={dashboardHref} className="public-btn public-btn-lg public-btn-fill">
                {t("common.openDashboard")}
              </Link>
            ) : (
              <a href={loginHref} className="public-btn public-btn-lg public-btn-fill">
                {t("common.signIn")}
              </a>
            )}
          </div>
        </div>
      </section>
    </PublicShell>
  )
}

/** Source of truth for the features grid layout. The `i18nKey` namespaces
 *  the {cat,title,desc} strings in the translation files; the icon is keyed
 *  off the same value via {@link FeatureIcon}. `feat: true` makes the card
 *  span 2×2 in the grid (visual hero of the section). */
const FEATURES: { i18nKey: string; feat?: boolean }[] = [
  { i18nKey: "ward" },
  { i18nKey: "streamerSuite", feat: true },
  { i18nKey: "moderation" },
  { i18nKey: "fellowship" },
  { i18nKey: "tickets" },
  { i18nKey: "giveaways" },
  { i18nKey: "xp" },
  { i18nKey: "analytics" },
]

/**
 * Stroke SVG line-icons for each feature. Matches the stats-strip aesthetic
 * — currentColor + 2px stroke + rounded caps. Sized via CSS on `.fcard .thumb svg`.
 */
function FeatureIcon({ name }: { name: string }) {
  const stroke = {
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  switch (name) {
    case "ward":
      return (
        <svg viewBox="0 0 24 24" {...stroke}>
          <path d="M12 3 4 6v5c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    case "streamerSuite":
      return (
        <svg viewBox="0 0 24 24" {...stroke}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      )
    case "moderation":
      return (
        <svg viewBox="0 0 24 24" {...stroke}>
          <path d="M12 3v18" />
          <path d="M5 7h14" />
          <path d="M7 7 4 14a3 3 0 0 0 6 0z" />
          <path d="m17 7-3 7a3 3 0 0 0 6 0z" />
        </svg>
      )
    case "fellowship":
      return (
        <svg viewBox="0 0 24 24" {...stroke}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 14c2.8 0 5 1.8 6 4" />
        </svg>
      )
    case "tickets":
      return (
        <svg viewBox="0 0 24 24" {...stroke}>
          <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
          <path d="M13 6v12" strokeDasharray="2 2" />
        </svg>
      )
    case "giveaways":
      return (
        <svg viewBox="0 0 24 24" {...stroke}>
          <rect x="3" y="8" width="18" height="5" rx="1" />
          <path d="M5 13v8h14v-8" />
          <path d="M12 8v13" />
          <path d="M12 8c-2 0-4-1-4-3s2-3 4 0c2-3 4-2 4 0s-2 3-4 3z" />
        </svg>
      )
    case "xp":
      return (
        <svg viewBox="0 0 24 24" {...stroke}>
          <circle cx="12" cy="9" r="6" />
          <path d="m8.5 14-1.5 7 5-3 5 3-1.5-7" />
        </svg>
      )
    case "analytics":
      return (
        <svg viewBox="0 0 24 24" {...stroke}>
          <path d="M3 21h18" />
          <rect x="5" y="13" width="3" height="6" />
          <rect x="10.5" y="9" width="3" height="10" />
          <rect x="16" y="5" width="3" height="14" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" {...stroke}>
          <circle cx="12" cy="12" r="6" />
        </svg>
      )
  }
}

function LandingStyles() {
  return (
    <style>{`
      /* Hero + Stats moved to <NeonHeroStats /> with its own scoped styles. */

      /* ── Scroll progress bar (top of viewport) ─────────────────────────── */
      .lp-scroll-prog {
        position: fixed; top: 0; left: 0; right: 0; height: 2px;
        background: linear-gradient(90deg, var(--pub-blurple-br), var(--pub-cyan));
        transform-origin: left center; transform: scaleX(0);
        z-index: 100; pointer-events: none;
        box-shadow: 0 0 12px rgba(86,230,255,0.4);
        transition: transform 80ms linear;
      }

      /* ── Scroll reveal ──────────────────────────────────────────────────
         JS adds .is-visible when the element enters the viewport. The
         transition-delay is read from --reveal-delay on the element itself
         (set inline) so stagger works without per-index CSS rules. */
      [data-reveal] {
        opacity: 0;
        transform: translateY(28px);
        transition:
          opacity 0.7s cubic-bezier(0.2, 0.7, 0.2, 1),
          transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
        transition-delay: var(--reveal-delay, 0ms);
        will-change: opacity, transform;
      }
      [data-reveal].is-visible {
        opacity: 1;
        transform: none;
      }
      @media (prefers-reduced-motion: reduce) {
        [data-reveal] { opacity: 1 !important; transform: none !important; transition: none !important; }
        .lp-scroll-prog { transition: none; }
      }

      /* ── Section connector — vertical neon thread between sections ─────
         Two visual pieces:
         (1) .public-divider gets a thin vertical line + a glowing diamond
             node centered horizontally. The line fades in via the same
             reveal mechanism if tagged. Always rendered, ambient.
         (2) Each .public-section grows a short connector stub from its top
             centre so adjacent sections feel stitched together. */
      .public-divider {
        height: 90px;
        background: none;
        max-width: none;
        position: relative;
      }
      .public-divider::before {
        content: "";
        position: absolute; left: 50%; top: 0; bottom: 0;
        width: 1px;
        background: linear-gradient(180deg, transparent, var(--pub-line-2) 22%, var(--pub-line-2) 78%, transparent);
        transform: translateX(-0.5px);
      }
      .public-divider::after {
        content: "";
        position: absolute; left: 50%; top: 50%;
        width: 8px; height: 8px; transform: translate(-50%, -50%) rotate(45deg);
        background: var(--pub-cyan);
        box-shadow: 0 0 12px var(--pub-cyan), 0 0 24px rgba(86,230,255,0.5);
        border-radius: 1px;
        animation: lp-node-pulse 2.6s ease-in-out infinite;
      }
      @keyframes lp-node-pulse {
        0%, 100% { box-shadow: 0 0 12px var(--pub-cyan), 0 0 24px rgba(86,230,255,0.5); }
        50% { box-shadow: 0 0 20px var(--pub-cyan), 0 0 40px rgba(86,230,255,0.75); }
      }

      /* Section-top connector stub: a short vertical line growing from the
         top centre of each .public-section (excluding hero which lives in
         NeonHeroStats). Tying section to whatever sits above it. */
      .public-section { position: relative; }
      .public-section::before {
        content: "";
        position: absolute; left: 50%; top: -40px;
        width: 1px; height: 40px;
        background: linear-gradient(180deg, transparent, var(--pub-line-2));
        transform: translateX(-0.5px);
        pointer-events: none;
      }
      /* Avoid stacking a stub on top of the dedicated .public-divider node. */
      .public-divider + .public-section::before { content: none; }
      /* Final CTA already provides its own connector via its top radial glow. */
      .final::before {
        content: "";
        position: absolute; left: 50%; top: -40px;
        width: 1px; height: 40px;
        background: linear-gradient(180deg, transparent, var(--pub-line-2));
        transform: translateX(-0.5px);
        pointer-events: none;
      }

      @media (prefers-reduced-motion: reduce) {
        .public-divider::after { animation: none; }
      }

      /* ── Features grid ── */
      .fgrid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 18px;
      }
      .fcard {
        background: linear-gradient(180deg, var(--pub-panel), var(--pub-bg-2));
        border: 1px solid var(--pub-line); border-radius: 16px;
        padding: 24px; transition: .25s; position: relative;
        display: flex; flex-direction: column;
      }
      .fcard:hover {
        border-color: var(--pub-line-2);
        box-shadow: 0 12px 40px rgba(88,101,242,0.18);
        transform: translateY(-3px);
      }
      /* "Feat" card spans 2×2 — visual hero of the section. Brighter glow,
         blurple-tinted background to read as the "main" offering. */
      .fcard.feat {
        grid-column: span 2; grid-row: span 2;
        background: linear-gradient(180deg, rgba(88,101,242,0.18), rgba(11,11,23,0.85));
        border-color: rgba(124,132,255,0.35);
        box-shadow: 0 0 0 1px rgba(255,255,255,0.04) inset, 0 18px 60px rgba(88,101,242,0.20);
      }
      .fcard .thumb {
        width: 56px; height: 56px; border-radius: 14px;
        background: rgba(124,132,255,0.08);
        border: 1px solid var(--pub-line-2);
        color: var(--pub-blurple-br);
        display: grid; place-items: center; margin-bottom: 20px;
      }
      .fcard .thumb svg { width: 24px; height: 24px; }
      .fcard.feat .thumb {
        width: 72px; height: 72px;
        background: linear-gradient(150deg, var(--pub-blurple-br), var(--pub-blurple));
        border: 1px solid rgba(255,255,255,0.12);
        color: #fff;
        box-shadow: 0 0 28px rgba(88,101,242,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset;
      }
      .fcard.feat .thumb svg { width: 32px; height: 32px; }
      .fcard .cat {
        display: inline-block;
        font-family: 'Manrope', sans-serif; font-weight: 700;
        font-size: 10.5px; letter-spacing: 0.18em;
        text-transform: uppercase; color: var(--pub-blurple-br);
        margin-bottom: 8px; opacity: .9;
      }
      .fcard h4 {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 18px; color: #fff; margin: 0; letter-spacing: -0.01em;
      }
      .fcard.feat h4 { font-size: 26px; line-height: 1.1; }
      .fcard p {
        color: var(--pub-ink-soft); font-size: 14.5px; line-height: 1.6;
        margin-top: 10px; font-family: 'Manrope', sans-serif; font-weight: 500;
      }
      @media (max-width: 980px) {
        .fgrid { grid-template-columns: repeat(2, 1fr); }
        .fcard.feat { grid-column: span 2; grid-row: auto; }
      }
      @media (max-width: 540px) {
        .fgrid { grid-template-columns: 1fr; }
        .fcard.feat { grid-column: auto; }
      }

      /* ── Featured gallery (shop preview) ── */
      .public-sub {
        color: var(--pub-ink-soft); font-size: 16px; max-width: 60ch; margin-top: 14px;
        font-family: 'Manrope', sans-serif; font-weight: 500;
      }
      .gal {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;
      }
      .gtile {
        display: block; aspect-ratio: 16/10; position: relative; overflow: hidden;
        border-radius: 16px;
      }
      .gtile-img {
        position: absolute; inset: 0; display: grid; place-items: center;
        background:
          linear-gradient(180deg, rgba(124,132,255,0.06), rgba(7,7,14,0.4)),
          repeating-linear-gradient(45deg, rgba(124,132,255,0.08) 0 10px, rgba(124,132,255,0.02) 10px 20px);
      }
      .gtile-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s; }
      .gtile:hover .gtile-img img { transform: scale(1.04); }
      .gtile-fallback {
        font-family: 'Space Grotesk', sans-serif; font-weight: 700;
        font-size: 64px; color: rgba(255,255,255,0.18);
        text-transform: uppercase;
      }
      .gtile .play {
        position: absolute; inset: 0; display: grid; place-items: center;
        color: rgba(255,255,255,0.85); font-size: 40px; pointer-events: none;
        text-shadow: 0 0 16px rgba(0,0,0,0.6); opacity: 0; transition: opacity .25s;
      }
      .gtile:hover .play { opacity: 1; }
      .gtile .cap {
        position: absolute; bottom: 0; left: 0; right: 0; padding: 14px 16px 12px;
        background: linear-gradient(180deg, transparent, rgba(0,0,0,0.78));
        font-family: 'Manrope', sans-serif; font-weight: 700;
        font-size: 13px; letter-spacing: 0.02em; color: #fff;
      }
      @media (max-width: 820px) { .gal { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 540px) { .gal { grid-template-columns: 1fr; } }

      .empty-state {
        padding: 60px 20px; text-align: center; color: var(--pub-ink-mut);
        border: 1px dashed var(--pub-line-2); border-radius: 16px;
        font-family: 'Manrope', sans-serif;
        background: rgba(124,132,255,0.03);
      }

      /* ── Final CTA ── */
      .final {
        padding: 100px 0;
        background:
          radial-gradient(700px 360px at 50% 0%, rgba(88,101,242,0.18), transparent 70%),
          linear-gradient(180deg, transparent, rgba(11,11,23,0.5));
        border-top: 1px solid var(--pub-line);
        text-align: center; position: relative; z-index: 2;
      }
      .final h2 {
        font-size: clamp(30px, 4vw, 52px); margin-bottom: 18px;
      }
      .final h2 .hero-em {
        background: linear-gradient(120deg, var(--pub-blurple-br), var(--pub-cyan));
        -webkit-background-clip: text; background-clip: text; color: transparent;
        filter: drop-shadow(0 0 22px rgba(88,101,242,0.55));
      }
      .final p {
        color: var(--pub-ink-soft); max-width: 52ch; margin: 0 auto 32px;
        font-family: 'Manrope', sans-serif; font-weight: 500;
        font-size: clamp(15px, 1.2vw, 17px); line-height: 1.6;
      }
      .hero-actions {
        display: flex; gap: 14px; flex-wrap: wrap;
      }
    `}</style>
  )
}

/**
 * Neon "gamer" hero — Discord blurple core with cyan accents, Space Grotesk +
 * Manrope typography. Ported from the standalone HTML spec; all class names
 * are `lu-*` so the styles can't bleed into the rest of the page or the shop.
 * Background is positioned absolutely inside this section (not fixed) so it
 * lives only above its own slice of the page.
 */
function NeonHeroStats({ botInvite }: { botInvite: string }) {
  const { t } = useTranslation()
  return (
    <div className="lu-neon">
      <NeonStyles />
      <div className="lu-bg" aria-hidden="true">
        <div className="lu-bg-grid" />
        <div className="lu-glow lu-glow-a" />
        <div className="lu-glow lu-glow-b" />
        <div className="lu-glow lu-glow-c" />
        <div className="lu-noise" />
      </div>

      <div className="lu-wrap">
        <header className="lu-hero">
          <div className="lu-hero-text">
            <span className="lu-eyebrow">
              <span className="lu-pulse" /> {t("landing.eyebrow")}
            </span>
            <h1 className="lu-h1">
              <Trans i18nKey="landing.title" components={{ em: <span className="lu-hl" /> }} />
            </h1>
            <p className="lu-sub">{t("landing.sub")}</p>
            <div className="lu-cta-row">
              <a
                href={botInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="lu-btn lu-btn-primary lu-btn-lg"
              >
                {t("common.addToDiscord")}
              </a>
              <Link to="/shop" className="lu-btn lu-btn-ghost lu-btn-lg">
                {t("landing.ctaShop")}
              </Link>
            </div>
            <div className="lu-trust">
              <span className="lu-free">{t("landing.freeToBeginShort")}</span>
              <span className="lu-tdot" /><span>Twitch</span>
              <span className="lu-tdot" /><span>YouTube</span>
              <span className="lu-tdot" /><span>Kick</span>
              <span className="lu-tdot" /><span>TikTok</span>
            </div>
          </div>

          <div className="lu-stage">
            <div className="lu-stage-glow" />

            <div className="lu-chip lu-chip-xp">
              <div className="lu-chip-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
                </svg>
              </div>
              <div>
                <div className="lu-chip-t">{t("landing.alert.xpLabel")}</div>
                <div className="lu-chip-v">{t("landing.alert.xpValue")}</div>
              </div>
            </div>

            <div className="lu-alert">
              <div className="lu-alert-top">
                <div className="lu-ava" />
                <div>
                  <div className="lu-alert-name">{t("landing.alert.streamer")}</div>
                  <div className="lu-alert-meta">{t("landing.alert.wentLive")}</div>
                </div>
                <span className="lu-live-badge">
                  <span className="lu-live-d" /> {t("landing.alert.liveBadge")}
                </span>
              </div>
              <div className="lu-thumb">
                <div className="lu-play" />
                <span>{t("landing.alert.preview")}</span>
              </div>
              <div className="lu-alert-title">{t("landing.alert.title")}</div>
              <div className="lu-alert-row">
                <span>
                  <Trans
                    i18nKey="landing.alert.watching"
                    values={{ count: "1,284" }}
                    components={{ b: <b /> }}
                  />
                </span>
                <span><b>{t("landing.alert.category")}</b></span>
                <button type="button" className="lu-alert-btn">{t("landing.alert.watch")}</button>
              </div>
            </div>

            <div className="lu-chip lu-chip-lvl">
              <div className="lu-chip-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 4 9l8 6 8-6z" />
                  <path d="M4 15l8 6 8-6" />
                </svg>
              </div>
              <div>
                <div className="lu-chip-t">{t("landing.alert.levelLabel")}</div>
                <div className="lu-chip-v">{t("landing.alert.levelValue")}</div>
              </div>
            </div>
          </div>
        </header>
      </div>

      <div className="lu-strip">
        <div className="lu-wrap lu-strip-in">
          <NeonStat
            label={t("landing.stats.forgedDaily")}
            caption={t("landing.stats.byStudio")}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 3.5 9 9l-5.5 1.5L8 14l-1 6.5L12 17l5 3.5L16 14l4.5-3.5L15 9z" />
              </svg>
            }
          />
          <NeonStat
            label={t("landing.stats.platforms")}
            caption={t("landing.stats.platformsList")}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="13" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            }
          />
          <NeonStat
            label={t("landing.stats.oneClick")}
            caption={t("landing.stats.templates")}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
              </svg>
            }
          />
          <NeonStat
            label={t("landing.stats.verified")}
            caption={t("landing.stats.byDiscord")}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 4 6v5c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  )
}

function NeonStat({ label, caption, icon }: { label: string; caption: string; icon: React.ReactNode }) {
  return (
    <div className="lu-stat">
      <div className="lu-stat-b">{icon}</div>
      <div>
        <h4>{label}</h4>
        <p>{caption}</p>
      </div>
    </div>
  )
}

function NeonStyles() {
  return (
    <style>{`
      .lu-neon {
        --lu-bg: #07070e;
        --lu-bg-2: #0b0b17;
        --lu-panel: #11111f;
        --lu-line: rgba(124,132,255,0.14);
        --lu-line-strong: rgba(124,132,255,0.30);
        --lu-blurple: #5865f2;
        --lu-blurple-bright: #8b92ff;
        --lu-indigo: #3a3da0;
        --lu-cyan: #56e6ff;
        --lu-text: #ededf7;
        --lu-muted: #9596b8;
        --lu-muted-2: #6f6f92;

        position: relative;
        background: var(--lu-bg);
        color: var(--lu-text);
        font-family: 'Manrope', system-ui, sans-serif;
        overflow: hidden;
        isolation: isolate;
      }

      /* Ambient bg — scoped to this section (not fixed) */
      .lu-neon .lu-bg {
        position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none;
      }
      .lu-neon .lu-bg-grid {
        position: absolute; inset: -2px;
        background-image:
          linear-gradient(to right, rgba(124,132,255,0.06) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(124,132,255,0.06) 1px, transparent 1px);
        background-size: 64px 64px;
        mask-image: radial-gradient(120% 90% at 70% 5%, #000 0%, transparent 70%);
        -webkit-mask-image: radial-gradient(120% 90% at 70% 5%, #000 0%, transparent 70%);
      }
      .lu-neon .lu-glow {
        position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.55;
      }
      .lu-neon .lu-glow-a {
        width: 720px; height: 720px; top: -260px; right: -120px;
        background: radial-gradient(circle, rgba(88,101,242,0.55), transparent 65%);
        animation: lu-drift 16s ease-in-out infinite alternate;
      }
      .lu-neon .lu-glow-b {
        width: 560px; height: 560px; bottom: -240px; left: -160px;
        background: radial-gradient(circle, rgba(86,230,255,0.18), transparent 65%);
        animation: lu-drift 20s ease-in-out infinite alternate-reverse;
      }
      .lu-neon .lu-glow-c {
        width: 480px; height: 480px; top: 30%; left: 38%;
        background: radial-gradient(circle, rgba(139,146,255,0.22), transparent 60%);
        animation: lu-drift 22s ease-in-out infinite alternate;
      }
      @keyframes lu-drift {
        from { transform: translate3d(0,0,0); }
        to { transform: translate3d(40px, 30px, 0); }
      }
      .lu-neon .lu-noise {
        position: absolute; inset: 0; opacity: 0.04;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      }

      .lu-neon .lu-wrap {
        max-width: 1240px; margin: 0 auto; padding: 0 40px;
        position: relative; z-index: 1;
      }

      /* Hero */
      .lu-neon .lu-hero {
        display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px;
        align-items: center; padding: 72px 0 40px;
      }
      .lu-neon .lu-eyebrow {
        display: inline-flex; align-items: center; gap: 10px;
        border: 1px solid var(--lu-line-strong);
        background: rgba(124,132,255,0.06);
        border-radius: 999px; padding: 7px 15px 7px 12px;
        font-size: 12px; font-weight: 700; letter-spacing: 0.14em;
        text-transform: uppercase; color: var(--lu-blurple-bright);
        margin-bottom: 26px; white-space: nowrap;
      }
      .lu-neon .lu-pulse {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--lu-cyan);
        box-shadow: 0 0 0 0 rgba(86,230,255,0.6);
        animation: lu-pulse 2s infinite;
      }
      @keyframes lu-pulse {
        0% { box-shadow: 0 0 0 0 rgba(86,230,255,0.55); }
        70% { box-shadow: 0 0 0 9px rgba(86,230,255,0); }
        100% { box-shadow: 0 0 0 0 rgba(86,230,255,0); }
      }
      .lu-neon .lu-h1 {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: clamp(38px, 4.4vw, 60px);
        line-height: 1.04;
        letter-spacing: -0.02em;
        text-transform: uppercase;
        color: var(--lu-text);
        margin: 0;
      }
      .lu-neon .lu-hl {
        background: linear-gradient(120deg, var(--lu-blurple-bright), var(--lu-cyan));
        -webkit-background-clip: text; background-clip: text; color: transparent;
        filter: drop-shadow(0 0 22px rgba(88,101,242,0.55));
      }
      .lu-neon .lu-sub {
        margin-top: 26px;
        font-size: clamp(16px, 1.3vw, 18.5px);
        line-height: 1.6;
        color: var(--lu-muted);
        max-width: 480px;
        font-weight: 500;
      }
      .lu-neon .lu-cta-row {
        display: flex; gap: 14px; margin-top: 38px; flex-wrap: wrap;
      }
      .lu-neon .lu-btn {
        font-family: 'Manrope', sans-serif;
        font-weight: 700;
        font-size: 13.5px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border-radius: 999px;
        padding: 12px 22px;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex; align-items: center; gap: 10px;
        border: 1px solid transparent;
        transition: transform .15s ease, box-shadow .25s ease, background .2s;
        white-space: nowrap;
      }
      .lu-neon .lu-btn:active { transform: translateY(1px); }
      .lu-neon .lu-btn-primary {
        background: linear-gradient(180deg, var(--lu-blurple-bright), var(--lu-blurple));
        color: #fff;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.14) inset, 0 10px 28px rgba(88,101,242,0.5);
      }
      .lu-neon .lu-btn-primary:hover {
        box-shadow: 0 0 0 1px rgba(255,255,255,0.2) inset, 0 14px 40px rgba(88,101,242,0.72);
        transform: translateY(-2px);
      }
      .lu-neon .lu-btn-ghost {
        background: rgba(255,255,255,0.03);
        color: var(--lu-text);
        border: 1px solid var(--lu-line-strong);
      }
      .lu-neon .lu-btn-ghost:hover {
        background: rgba(124,132,255,0.10);
        border-color: var(--lu-blurple-bright);
        transform: translateY(-2px);
      }
      .lu-neon .lu-btn-lg { padding: 16px 28px; font-size: 14px; }

      .lu-neon .lu-trust {
        margin-top: 32px;
        display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
        font-size: 12px; font-weight: 700; letter-spacing: 0.1em;
        text-transform: uppercase; color: var(--lu-muted-2);
      }
      .lu-neon .lu-free { color: var(--lu-cyan); }
      .lu-neon .lu-tdot {
        width: 3px; height: 3px; border-radius: 50%; background: var(--lu-muted-2);
      }

      /* Right column: stage + alert */
      .lu-neon .lu-stage {
        position: relative; height: 460px;
        display: grid; place-items: center;
      }
      .lu-neon .lu-stage-glow {
        position: absolute; width: 360px; height: 360px; border-radius: 50%;
        background: radial-gradient(circle, rgba(88,101,242,0.45), transparent 65%);
        filter: blur(50px);
      }
      .lu-neon .lu-alert {
        position: relative;
        width: 380px;
        background: linear-gradient(180deg, rgba(23,23,40,0.92), rgba(15,15,28,0.92));
        border: 1px solid var(--lu-line-strong);
        border-radius: 20px;
        padding: 18px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
        backdrop-filter: blur(10px);
        animation: lu-float 6s ease-in-out infinite;
      }
      @keyframes lu-float {
        0%, 100% { transform: translateY(0) rotate(-0.4deg); }
        50% { transform: translateY(-14px) rotate(0.4deg); }
      }
      .lu-neon .lu-alert-top {
        display: flex; align-items: center; gap: 12px;
      }
      .lu-neon .lu-ava {
        width: 44px; height: 44px; border-radius: 12px;
        background: linear-gradient(150deg, var(--lu-blurple-bright), var(--lu-indigo));
        display: grid; place-items: center; flex: 0 0 auto;
        box-shadow: 0 0 0 2px rgba(86,230,255,0.5), 0 0 18px rgba(86,230,255,0.35);
        position: relative;
      }
      .lu-neon .lu-ava::after {
        content: ""; width: 16px; height: 16px; background: #fff;
        clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
      }
      .lu-neon .lu-alert-name { font-weight: 800; font-size: 15px; color: var(--lu-text); }
      .lu-neon .lu-alert-meta { font-size: 12px; color: var(--lu-muted); margin-top: 2px; font-weight: 600; }
      .lu-neon .lu-live-badge {
        margin-left: auto;
        display: inline-flex; align-items: center; gap: 6px;
        background: #ff3860; color: #fff;
        font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
        padding: 5px 10px; border-radius: 7px;
        box-shadow: 0 6px 18px rgba(255,56,96,0.45);
      }
      .lu-neon .lu-live-d {
        width: 6px; height: 6px; border-radius: 50%; background: #fff;
        animation: lu-blink 1.4s infinite;
      }
      @keyframes lu-blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
      .lu-neon .lu-thumb {
        margin-top: 14px;
        height: 158px;
        border-radius: 12px;
        border: 1px solid var(--lu-line);
        background: repeating-linear-gradient(45deg, rgba(124,132,255,0.10) 0 10px, rgba(124,132,255,0.03) 10px 20px);
        display: grid; place-items: center;
        position: relative; overflow: hidden;
      }
      .lu-neon .lu-thumb span {
        font-family: 'Space Grotesk', monospace;
        font-size: 11px; letter-spacing: 0.18em; color: var(--lu-muted-2);
        text-transform: uppercase;
      }
      .lu-neon .lu-play {
        position: absolute; width: 52px; height: 52px; border-radius: 50%;
        background: rgba(88,101,242,0.9);
        display: grid; place-items: center;
        box-shadow: 0 8px 26px rgba(88,101,242,0.6);
      }
      .lu-neon .lu-play::after {
        content: ""; width: 0; height: 0;
        border-left: 14px solid #fff;
        border-top: 9px solid transparent;
        border-bottom: 9px solid transparent;
        margin-left: 4px;
      }
      .lu-neon .lu-alert-title { margin-top: 14px; font-weight: 700; font-size: 14.5px; color: var(--lu-text); }
      .lu-neon .lu-alert-row {
        margin-top: 12px;
        display: flex; align-items: center; gap: 14px;
        font-size: 12px; color: var(--lu-muted); font-weight: 600;
      }
      .lu-neon .lu-alert-row b { color: var(--lu-text); }
      .lu-neon .lu-alert-btn {
        margin-left: auto;
        background: linear-gradient(180deg, var(--lu-blurple-bright), var(--lu-blurple));
        color: #fff; border: none;
        font: inherit; font-weight: 700; font-size: 12px;
        letter-spacing: 0.03em; text-transform: uppercase;
        padding: 9px 16px; border-radius: 9px; cursor: pointer;
        box-shadow: 0 8px 22px rgba(88,101,242,0.45);
      }

      /* Chips */
      .lu-neon .lu-chip {
        position: absolute;
        display: flex; align-items: center; gap: 10px;
        background: linear-gradient(180deg, rgba(25,25,44,0.95), rgba(16,16,30,0.95));
        border: 1px solid var(--lu-line-strong);
        border-radius: 13px;
        padding: 10px 14px;
        box-shadow: 0 18px 44px rgba(0,0,0,0.5);
        backdrop-filter: blur(8px);
        z-index: 3;
      }
      .lu-neon .lu-chip-ic {
        width: 28px; height: 28px; border-radius: 8px;
        display: grid; place-items: center; flex: 0 0 auto;
      }
      .lu-neon .lu-chip-ic svg { width: 15px; height: 15px; }
      .lu-neon .lu-chip-t { font-size: 11px; color: var(--lu-muted); font-weight: 600; line-height: 1.2; }
      .lu-neon .lu-chip-v { font-size: 13.5px; font-weight: 800; color: var(--lu-text); }
      .lu-neon .lu-chip-xp { top: 112px; left: -52px; animation: lu-float 7s ease-in-out infinite; }
      .lu-neon .lu-chip-xp .lu-chip-ic {
        background: linear-gradient(150deg, #56e6ff, #2f9fff);
        box-shadow: 0 0 16px rgba(86,230,255,0.5);
      }
      .lu-neon .lu-chip-lvl { bottom: -46px; right: 14px; animation: lu-float 6.5s ease-in-out 0.5s infinite; }
      .lu-neon .lu-chip-lvl .lu-chip-ic {
        background: linear-gradient(150deg, var(--lu-blurple-bright), var(--lu-blurple));
        box-shadow: 0 0 16px rgba(88,101,242,0.5);
      }

      /* Stats strip */
      .lu-neon .lu-strip {
        border-top: 1px solid var(--lu-line);
        border-bottom: 1px solid var(--lu-line);
        position: relative; z-index: 1;
        background: linear-gradient(180deg, rgba(11,11,23,0.6), rgba(7,7,14,0.9));
      }
      .lu-neon .lu-strip-in {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
        padding-top: 26px; padding-bottom: 26px;
      }
      .lu-neon .lu-stat { display: flex; align-items: center; gap: 14px; }
      .lu-neon .lu-stat-b {
        width: 40px; height: 40px; border-radius: 11px;
        border: 1px solid var(--lu-line-strong);
        background: rgba(124,132,255,0.07);
        display: grid; place-items: center; flex: 0 0 auto;
        color: var(--lu-blurple-bright);
      }
      .lu-neon .lu-stat-b svg { width: 18px; height: 18px; }
      .lu-neon .lu-stat h4 {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 15px; font-weight: 600; letter-spacing: 0.02em;
        text-transform: uppercase; color: var(--lu-text); margin: 0;
      }
      .lu-neon .lu-stat p {
        font-size: 12px; color: var(--lu-muted-2); font-weight: 600;
        letter-spacing: 0.04em; text-transform: uppercase; margin-top: 3px;
      }

      /* Responsive */
      @media (max-width: 940px) {
        .lu-neon .lu-hero {
          grid-template-columns: 1fr; gap: 0; padding: 40px 0 36px;
        }
        .lu-neon .lu-stage { height: 440px; margin-top: 28px; transform: scale(0.95); }
        .lu-neon .lu-strip-in { grid-template-columns: repeat(2, 1fr); gap: 24px 18px; }
      }
      @media (max-width: 600px) {
        .lu-neon .lu-wrap { padding: 0 20px; }
        .lu-neon .lu-hero { padding: 26px 0 30px; }
        .lu-neon .lu-eyebrow {
          white-space: normal; font-size: 10.5px; letter-spacing: 0.1em; margin-bottom: 20px;
        }
        .lu-neon .lu-h1 { font-size: clamp(30px, 9.6vw, 42px); line-height: 1.05; }
        .lu-neon .lu-sub { margin-top: 18px; font-size: 15.5px; max-width: 100%; }
        .lu-neon .lu-cta-row { margin-top: 26px; gap: 12px; }
        .lu-neon .lu-cta-row .lu-btn { flex: 1; justify-content: center; min-width: 0; }
        .lu-neon .lu-trust { margin-top: 24px; gap: 8px 10px; font-size: 10.5px; letter-spacing: 0.06em; }

        .lu-neon .lu-stage {
          height: auto; margin-top: 40px; transform: none;
          display: block; padding: 24px 4px 30px;
        }
        .lu-neon .lu-stage-glow {
          width: 280px; height: 280px; top: 20px; left: 50%; transform: translateX(-50%);
        }
        .lu-neon .lu-alert { width: 100%; max-width: 380px; margin: 0 auto; }
        .lu-neon .lu-thumb { height: 150px; }
        .lu-neon .lu-chip-xp { top: -8px; left: -6px; }
        .lu-neon .lu-chip-lvl { bottom: -22px; right: -4px; }
        .lu-neon .lu-chip { padding: 9px 12px; }

        .lu-neon .lu-strip-in { grid-template-columns: 1fr 1fr; gap: 22px 16px; padding-top: 22px; padding-bottom: 22px; }
        .lu-neon .lu-stat-b { width: 36px; height: 36px; }
        .lu-neon .lu-stat h4 { font-size: 13.5px; }
        .lu-neon .lu-stat p { font-size: 10.5px; }
      }
      @media (max-width: 380px) {
        .lu-neon .lu-h1 { font-size: 30px; }
        .lu-neon .lu-strip-in { grid-template-columns: 1fr; }
      }
      @media (prefers-reduced-motion: reduce) {
        .lu-neon .lu-alert,
        .lu-neon .lu-chip,
        .lu-neon .lu-glow-a,
        .lu-neon .lu-glow-b,
        .lu-neon .lu-glow-c,
        .lu-neon .lu-pulse,
        .lu-neon .lu-live-d { animation: none !important; }
      }
    `}</style>
  )
}
