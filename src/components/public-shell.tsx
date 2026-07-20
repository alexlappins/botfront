import { useState, type ReactNode } from "react"
import { Link, NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/auth-context"
import { LanguageSwitcher } from "@/components/language-switcher"

/**
 * Public site shell — sticky nav with conditional auth CTA + scrollable content +
 * footer. Used by the landing, public shop, and product detail pages.
 *
 * Style is "dark fantasy / arcane" per Misha's mockup: deep violet background,
 * golden accents, Cinzel headers. The colours / tokens live in styles below
 * so individual pages can reach in for accent classes (`shell-gold-btn`, etc.)
 * without each redefining the palette.
 *
 * Auth-aware nav:
 *   - guests see "Sign in" + "Add to Discord"
 *   - logged-in users see "Open dashboard" pointing at their home
 */
export function PublicShell({
  children,
  activeNav,
}: {
  children: ReactNode
  /** Which nav link should be highlighted as current section. Falls back to none. */
  activeNav?: "home" | "shop"
}) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  // Discord bot install URL — same env var the existing dashboard uses. Static
  // string + window.location.host fallback so the landing works in any env
  // without configuration.
  const botInvite =
    (import.meta.env.VITE_BOT_INVITE_URL as string | undefined) ?? "https://discord.com/oauth2/authorize"

  // OAuth login is started by hitting /api/auth/discord — let the browser do
  // the redirect dance rather than calling fetch (server returns a 302).
  const loginHref = `/api/auth/discord`
  // Where logged-in users want to land. Admins → template management area.
  // Customers → message templates page (the shop is hidden until launch per
  // Misha's TZ; landing on /store would show an empty/inert area).
  const dashboardHref = user?.role === "admin" ? "/server-templates" : "/server-messages"

  return (
    <div className="public-shell">
      <PublicTheme />

      <nav className={"public-nav " + (open ? "open" : "")}>
        <div className="public-wrap public-nav-in">
          <Link to="/" className="public-logo" onClick={() => setOpen(false)}>
            <span className="public-crest">
              <img className="public-crest-img" src="/mascot.webp" alt="" />
            </span>
            <span>Level Up</span>
          </Link>

          <div className="public-nav-links">
            <NavLink
              to="/"
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                "public-nav-link " + (isActive || activeNav === "home" ? "on" : "")
              }
            >
              {t("landing.features.title")}
            </NavLink>
            <NavLink
              to="/shop"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                "public-nav-link public-nav-shop " + (isActive || activeNav === "shop" ? "on" : "")
              }
            >
              {t("nav.store")}
            </NavLink>
          </div>

          <div className="public-nav-cta">
            <LanguageSwitcher variant="publicNav" />
            {user ? (
              <Link to={dashboardHref} className="public-btn public-btn-sm public-btn-fill">
                {t("common.openDashboard")}
              </Link>
            ) : (
              <>
                <a href={loginHref} className="public-ghost">
                  {t("common.signIn")}
                </a>
                <a href={botInvite} target="_blank" rel="noopener noreferrer" className="public-btn public-btn-sm">
                  {t("common.addToDiscord")}
                </a>
              </>
            )}
          </div>

          <button
            type="button"
            className="public-nav-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span />
          </button>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="public-footer">
        <div className="public-wrap public-footer-in">
          <div className="public-footer-col public-footer-brand">
            <Link to="/" className="public-logo">
              <span className="public-crest">
                <img className="public-crest-img" src="/mascot.webp" alt="" />
              </span>
              <span>Level Up</span>
            </Link>
            <p className="public-footer-tag">{t("footer.tag")}</p>
          </div>
          <div className="public-footer-col">
            <h5>{t("footer.companion")}</h5>
            <Link to="/">{t("landing.features.title")}</Link>
            <Link to="/shop">{t("nav.store")}</Link>
          </div>
          <div className="public-footer-col">
            <h5>{t("footer.account")}</h5>
            {user ? (
              <Link to={dashboardHref}>{t("common.openDashboard")}</Link>
            ) : (
              <a href={loginHref}>{t("common.signIn")}</a>
            )}
            <a href={botInvite} target="_blank" rel="noopener noreferrer">
              {t("common.addToDiscord")}
            </a>
          </div>
          <div className="public-footer-col">
            <h5>{t("footer.legal")}</h5>
            <Link to="/terms">{t("footer.terms")}</Link>
            <Link to="/privacy">{t("footer.privacy")}</Link>
            <Link to="/refund">{t("footer.refund")}</Link>
          </div>
        </div>
        <div className="public-wrap public-footer-bottom">
          <span>{t("footer.bottom")}</span>
        </div>
      </footer>
    </div>
  )
}

/**
 * Single-file palette + base styles for the public surface. Loaded via a
 * <style> tag rather than imported CSS to avoid stepping on tailwind's reset
 * — these classes are namespaced under `public-*` so they never collide.
 *
 * Neon "gamer" aesthetic: near-black background, Discord blurple core with
 * cyan accents, Space Grotesk display + Manrope body. The legacy --pub-gold
 * tokens are kept as aliases so any leftover consumers keep rendering.
 */
function PublicTheme() {
  return (
    <style>{`
      :root {
        --pub-bg: #07070e;
        --pub-bg-2: #0b0b17;
        --pub-panel: #11111f;
        --pub-panel-2: #14142a;
        --pub-panel-hi: #1a1a30;
        --pub-blurple: #5865f2;
        --pub-blurple-br: #8b92ff;
        --pub-blurple-deep: #3a3da0;
        --pub-cyan: #56e6ff;
        --pub-ink: #ededf7;
        --pub-ink-soft: #b9b9d3;
        --pub-ink-mut: #9596b8;
        --pub-ink-faint: #6f6f92;
        --pub-line: rgba(124,132,255,0.14);
        --pub-line-2: rgba(124,132,255,0.30);
        --pub-line-v: rgba(124,132,255,0.18);
        /* Legacy aliases — preserved so any older selectors keep resolving. */
        --pub-gold: var(--pub-cyan);
        --pub-gold-br: var(--pub-blurple-br);
        --pub-gold-deep: var(--pub-blurple-deep);
        --pub-violet: var(--pub-blurple);
        --pub-violet-br: var(--pub-blurple-br);
        --pub-violet-deep: var(--pub-blurple-deep);
        --pub-maxw: 1240px;
      }

      .public-shell {
        background: var(--pub-bg);
        color: var(--pub-ink);
        font-family: 'Manrope', system-ui, sans-serif;
        font-size: 17px;
        line-height: 1.65;
        min-height: 100vh;
        overflow-x: hidden;
        -webkit-font-smoothing: antialiased;
        position: relative;
      }
      /* Ambient neon background: faint grid + three drifting glow blobs + noise.
         Calmer than the hero's bg so it reads as page-wide atmosphere, not focal. */
      .public-shell::before {
        content: "";
        position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background:
          linear-gradient(to right, rgba(124,132,255,0.045) 1px, transparent 1px) 0 0 / 64px 64px,
          linear-gradient(to bottom, rgba(124,132,255,0.045) 1px, transparent 1px) 0 0 / 64px 64px,
          radial-gradient(900px 600px at 85% -5%, rgba(88,101,242,0.18), transparent 60%),
          radial-gradient(800px 500px at 5% 80%, rgba(86,230,255,0.10), transparent 55%),
          radial-gradient(1000px 700px at 50% 50%, rgba(124,132,255,0.05), transparent 60%);
      }
      .public-shell main { position: relative; z-index: 2; }

      .public-wrap { max-width: var(--pub-maxw); margin: 0 auto; padding: 0 40px; position: relative; z-index: 2; }
      .public-shell h1, .public-shell h2, .public-shell h3, .public-shell h4 {
        font-family: 'Space Grotesk', sans-serif; font-weight: 700;
        line-height: 1.1; letter-spacing: -0.01em; color: #fff;
        text-transform: uppercase;
      }
      .public-shell a { color: inherit; text-decoration: none; }

      /* Pill buttons — ghost is default, "-fill" is the blurple primary. */
      .public-btn {
        font-family: 'Manrope', sans-serif; font-weight: 700;
        letter-spacing: 0.04em; text-transform: uppercase;
        cursor: pointer;
        border: 1px solid var(--pub-line-2);
        border-radius: 999px;
        background: rgba(255,255,255,0.03);
        color: var(--pub-ink);
        padding: 12px 22px; font-size: 13.5px;
        transition: transform .15s ease, box-shadow .25s ease, background .2s, border-color .2s, color .2s;
        position: relative; display: inline-flex; align-items: center; gap: 10px;
        text-align: center; white-space: nowrap;
      }
      .public-btn:hover {
        background: rgba(124,132,255,0.10);
        border-color: var(--pub-blurple-br);
        transform: translateY(-2px);
      }
      .public-btn:active { transform: translateY(1px); }
      .public-btn-lg { padding: 16px 28px; font-size: 14px; }
      .public-btn-sm { padding: 9px 18px; font-size: 12px; }
      .public-btn-fill {
        background: linear-gradient(180deg, var(--pub-blurple-br), var(--pub-blurple));
        color: #fff;
        border-color: transparent;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.14) inset, 0 10px 28px rgba(88,101,242,0.5);
      }
      .public-btn-fill:hover {
        background: linear-gradient(180deg, var(--pub-blurple-br), var(--pub-blurple));
        border-color: transparent;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.2) inset, 0 14px 40px rgba(88,101,242,0.72);
      }

      /* Nav */
      .public-nav {
        position: sticky; top: 0; z-index: 50; backdrop-filter: blur(10px);
        background: linear-gradient(180deg, rgba(7,7,14,0.92), rgba(7,7,14,0.55));
        border-bottom: 1px solid var(--pub-line);
      }
      .public-nav-in {
        display: flex; align-items: center; justify-content: space-between; height: 76px;
      }
      .public-logo {
        display: flex; align-items: center; gap: 12px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 19px; font-weight: 700; letter-spacing: 0.06em;
        text-transform: uppercase; color: #fff; white-space: nowrap;
      }
      /* Brand mark — scaled-down animated mascot (/mascot.webp): the robot
         raises/lowers the "LEVEL UP" banner, same loop as the hero. Taller box
         so the overhead banner frames aren't clipped; the robot self-animates. */
      .public-crest {
        display: inline-flex; align-items: center; justify-content: center;
        transform: none; border: 0; background: none; box-shadow: none;
      }
      .public-crest-img {
        height: 52px; width: auto; display: block;
        filter: drop-shadow(0 2px 8px rgba(88,101,242,0.5));
      }
      .public-nav-links {
        display: flex; align-items: center; gap: 30px;
        font-family: 'Manrope', sans-serif;
        font-size: 13.5px; font-weight: 600; letter-spacing: 0.04em;
        text-transform: uppercase; color: var(--pub-ink-mut);
      }
      .public-nav-link { transition: color .2s; white-space: nowrap; }
      .public-nav-link:hover, .public-nav-link.on { color: var(--pub-ink); }
      /* Drop the legacy gold dagger before "Shop" — neon nav doesn't need an icon. */
      .public-nav-link.public-nav-shop { color: var(--pub-ink-mut); }
      .public-nav-link.public-nav-shop::before { content: none; }
      .public-nav-link.public-nav-shop:hover,
      .public-nav-link.public-nav-shop.on { color: var(--pub-ink); }

      .public-nav-cta { display: flex; align-items: center; gap: 14px; }
      .public-ghost {
        font-family: 'Manrope', sans-serif; font-size: 13px;
        letter-spacing: 0.04em; text-transform: uppercase; font-weight: 600;
        color: var(--pub-ink-mut); cursor: pointer; transition: color .2s;
      }
      .public-ghost:hover { color: var(--pub-ink); }
      .public-nav-toggle {
        display: none; background: rgba(124,132,255,0.06);
        border: 1px solid var(--pub-line-2);
        width: 42px; height: 42px; cursor: pointer; color: var(--pub-ink);
        align-items: center; justify-content: center; border-radius: 11px;
      }
      .public-nav-toggle span {
        position: relative; display: block; width: 18px; height: 2px;
        background: currentColor; transition: .25s;
      }
      .public-nav-toggle span::before, .public-nav-toggle span::after {
        content: ""; position: absolute; left: 0; width: 18px; height: 2px;
        background: currentColor; transition: .25s;
      }
      .public-nav-toggle span::before { transform: translateY(-6px); }
      .public-nav-toggle span::after { transform: translateY(6px); }
      .public-nav.open .public-nav-toggle span { background: transparent; }
      .public-nav.open .public-nav-toggle span::before { transform: rotate(45deg); }
      .public-nav.open .public-nav-toggle span::after { transform: rotate(-45deg); }

      /* Lang switcher (publicNav variant) — palette retuned to neon via tokens
         in language-switcher.tsx (uses --pub-line, --pub-ink-mut, --pub-gold-br
         which now alias to blurple values). */

      /* Section headers */
      .public-section { padding: 100px 0; position: relative; }
      .public-head { margin-bottom: 46px; }
      .public-head .eyebrow {
        font-family: 'Manrope', sans-serif; font-weight: 700;
        font-size: 12px; letter-spacing: 0.18em;
        text-transform: uppercase; color: var(--pub-blurple-br); opacity: .9;
      }
      .public-head .row { display: flex; align-items: center; gap: 22px; margin-top: 10px; }
      .public-head h2 {
        font-size: clamp(28px, 3.7vw, 44px); white-space: nowrap;
        text-shadow: 0 0 28px rgba(88,101,242,0.25);
      }
      .public-head .fl {
        flex: 1; height: 1px;
        background: linear-gradient(90deg, var(--pub-line-2), transparent);
      }
      /* The "✦" sparkle in markup reads as a tiny chevron in the neon palette. */
      .public-head .fl-end { color: var(--pub-blurple-br); font-size: 13px; opacity: .7; }
      .public-head.center { text-align: center; }
      .public-head.center .row { justify-content: center; }
      .public-head.center .fl:first-of-type {
        background: linear-gradient(90deg, transparent, var(--pub-line-2));
      }
      .public-divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--pub-line-2), transparent);
        position: relative; max-width: var(--pub-maxw); margin: 0 auto;
      }
      .public-divider::after { content: none; }

      /* Footer */
      .public-footer {
        position: relative; z-index: 2; padding: 60px 0 24px; margin-top: 80px;
        border-top: 1px solid var(--pub-line);
        background: linear-gradient(180deg, transparent, rgba(11,11,23,0.7));
      }
      .public-footer-in {
        display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 32px; padding-bottom: 32px;
      }
      .public-footer-brand .public-footer-tag {
        color: var(--pub-ink-mut); font-size: 14px; line-height: 1.55;
        margin-top: 12px; max-width: 36ch; font-family: 'Manrope', sans-serif;
      }
      .public-footer-col h5 {
        font-family: 'Space Grotesk', sans-serif; font-size: 12px;
        font-weight: 600; letter-spacing: 0.18em;
        text-transform: uppercase; color: var(--pub-blurple-br); margin-bottom: 14px;
      }
      .public-footer-col a {
        display: block; font-size: 14px; color: var(--pub-ink-soft); padding: 4px 0;
        transition: color .2s; font-family: 'Manrope', sans-serif;
      }
      .public-footer-col a:hover { color: #fff; }
      .public-footer-bottom {
        display: flex; justify-content: space-between; padding-top: 24px;
        border-top: 1px solid var(--pub-line);
        font-size: 12px; color: var(--pub-ink-faint);
        font-family: 'Manrope', sans-serif; letter-spacing: 0.06em;
      }

      /* Glass cards — shared by landing features grid + /shop product cards. */
      .public-card {
        background: linear-gradient(180deg, var(--pub-panel), var(--pub-bg-2));
        border: 1px solid var(--pub-line); border-radius: 16px;
        overflow: hidden; transition: .25s; position: relative;
      }
      .public-card:hover {
        border-color: var(--pub-line-2);
        box-shadow: 0 12px 40px rgba(88,101,242,0.15);
        transform: translateY(-3px);
      }

      /* Responsive */
      @media (max-width: 940px) {
        .public-nav-in { height: 70px; }
        .public-footer-in { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 720px) {
        .public-nav-toggle { display: inline-flex; flex-shrink: 0; width: 38px; height: 38px; }
        /* Compact header row: smaller mascot + wordmark, tighter gaps, and a
           CTA that doesn't shove the burger off the edge. */
        .public-nav-in { height: 60px; gap: 8px; }
        .public-logo { gap: 8px; font-size: 15px; }
        .public-crest-img { height: 34px; }
        .public-nav-cta { gap: 8px; min-width: 0; }
        .public-nav-cta .public-btn {
          padding: 9px 14px; font-size: 10.5px; letter-spacing: 0.08em;
          white-space: nowrap;
        }
        .public-nav-cta .public-lang-trigger { padding: 7px 10px; }
        .public-nav-links { top: 60px; }
        .public-nav-links {
          position: absolute; top: 70px; left: 0; right: 0; z-index: 40;
          flex-direction: column; align-items: stretch; gap: 0;
          background: linear-gradient(180deg, rgba(7,7,14,0.98), rgba(7,7,14,0.94));
          border-bottom: 1px solid var(--pub-line); max-height: 0; overflow: hidden;
          opacity: 0; pointer-events: none; transition: .25s;
        }
        .public-nav.open .public-nav-links {
          max-height: 520px; opacity: 1; pointer-events: auto;
        }
        .public-nav-links .public-nav-link {
          padding: 15px 28px; border-bottom: 1px solid var(--pub-line);
          font-size: 14px;
        }
        .public-nav-links .public-nav-link:last-child { border-bottom: 0; }
        .public-nav-cta .public-ghost { display: none; }
        .public-section { padding: 72px 0; }
        .public-wrap { padding: 0 20px; }
        .public-head h2 { white-space: normal; }
        .public-head .row { flex-wrap: wrap; }
        .public-footer-in { grid-template-columns: 1fr 1fr; gap: 24px; }
        .public-footer-bottom { flex-direction: column; gap: 8px; }
      }
      @media (max-width: 440px) {
        .public-footer-in { grid-template-columns: 1fr; }
        /* Ultra-narrow: drop the wordmark (mascot stays), slim the controls. */
        .public-logo > span:last-child { display: none; }
        .public-nav-cta .public-btn { padding: 8px 11px; font-size: 10px; }
        .public-nav-cta .public-lang-trigger .lang-globe { display: none; }
      }
    `}</style>
  )
}
