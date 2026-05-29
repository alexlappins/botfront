import { useState, type ReactNode } from "react"
import { Link, NavLink } from "react-router-dom"
import { useAuth } from "@/contexts/auth-context"

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
  const [open, setOpen] = useState(false)

  // Discord bot install URL — same env var the existing dashboard uses. Static
  // string + window.location.host fallback so the landing works in any env
  // without configuration.
  const botInvite =
    (import.meta.env.VITE_BOT_INVITE_URL as string | undefined) ?? "https://discord.com/oauth2/authorize"

  // OAuth login is started by hitting /api/auth/discord — let the browser do
  // the redirect dance rather than calling fetch (server returns a 302).
  const loginHref = `/api/auth/discord`
  // Where logged-in users want to land. Customers go to their dashboard root,
  // admins to the template management area. Mirrors HomeRedirect in App.tsx.
  const dashboardHref = user?.role === "admin" ? "/server-templates" : "/store"

  return (
    <div className="public-shell">
      <PublicTheme />

      <nav className={"public-nav " + (open ? "open" : "")}>
        <div className="public-wrap public-nav-in">
          <Link to="/" className="public-logo" onClick={() => setOpen(false)}>
            <span className="public-crest">
              <span>✦</span>
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
              Companion
            </NavLink>
            <NavLink
              to="/shop"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                "public-nav-link public-nav-shop " + (isActive || activeNav === "shop" ? "on" : "")
              }
            >
              Shop
            </NavLink>
            <a href="#features" className="public-nav-link" onClick={() => setOpen(false)}>
              Features
            </a>
            <a href="#packs" className="public-nav-link" onClick={() => setOpen(false)}>
              Packs
            </a>
            <a href="#faq" className="public-nav-link" onClick={() => setOpen(false)}>
              FAQ
            </a>
          </div>

          <div className="public-nav-cta">
            {user ? (
              <Link to={dashboardHref} className="public-btn public-btn-sm public-btn-fill">
                Open dashboard
              </Link>
            ) : (
              <>
                <a href={loginHref} className="public-ghost">
                  Sign in
                </a>
                <a href={botInvite} target="_blank" rel="noopener noreferrer" className="public-btn public-btn-sm">
                  Add to Discord
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
                <span>✦</span>
              </span>
              <span>Level Up</span>
            </Link>
            <p className="public-footer-tag">
              A Discord companion forged for streamers — live alerts, guardian moderation, ready-made realms.
            </p>
          </div>
          <div className="public-footer-col">
            <h5>Companion</h5>
            <Link to="/">Features</Link>
            <Link to="/shop">Shop</Link>
            <a href="#packs">Packs</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="public-footer-col">
            <h5>Account</h5>
            {user ? (
              <Link to={dashboardHref}>Dashboard</Link>
            ) : (
              <a href={loginHref}>Sign in</a>
            )}
            <a href={botInvite} target="_blank" rel="noopener noreferrer">
              Add to Discord
            </a>
          </div>
          <div className="public-footer-col">
            <h5>Legal</h5>
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
          </div>
        </div>
        <div className="public-wrap public-footer-bottom">
          <span>© Level Up · forged by a small moonlit studio</span>
          <span>✦ Verified by Discord</span>
        </div>
      </footer>
    </div>
  )
}

/**
 * Single-file palette + base styles for the public surface. Loaded via a
 * <style> tag rather than imported CSS to avoid stepping on tailwind's reset
 * — these classes are namespaced under `public-*` so they never collide.
 */
function PublicTheme() {
  return (
    <style>{`
      :root {
        --pub-bg: #130e1d;
        --pub-bg-2: #181222;
        --pub-panel: #211934;
        --pub-panel-2: #291f40;
        --pub-panel-hi: #332650;
        --pub-gold: #c9a44a;
        --pub-gold-br: #edcd82;
        --pub-gold-deep: #6f5a2a;
        --pub-violet: #9b6bff;
        --pub-violet-br: #c6a0ff;
        --pub-violet-deep: #5a2db0;
        --pub-rose: #e0708f;
        --pub-blue: #5aa0ff;
        --pub-ink: #ece6f5;
        --pub-ink-soft: #bcb2cf;
        --pub-ink-mut: #857c99;
        --pub-ink-faint: #5c5570;
        --pub-line: rgba(201,164,74,.16);
        --pub-line-2: rgba(201,164,74,.34);
        --pub-line-v: rgba(155,107,255,.18);
        --pub-maxw: 1180px;
      }

      .public-shell {
        background: var(--pub-bg);
        color: var(--pub-ink);
        font-family: 'Hanken Grotesk', system-ui, sans-serif;
        font-size: 17px;
        line-height: 1.65;
        min-height: 100vh;
        overflow-x: hidden;
        -webkit-font-smoothing: antialiased;
        position: relative;
      }
      .public-shell::before {
        content: "";
        position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background:
          radial-gradient(1100px 700px at 70% -10%, rgba(155,107,255,.2), transparent 60%),
          radial-gradient(900px 600px at 10% 20%, rgba(90,45,176,.14), transparent 55%),
          radial-gradient(1000px 700px at 90% 70%, rgba(155,107,255,.1), transparent 55%),
          radial-gradient(1200px 700px at 50% 116%, rgba(201,164,74,.08), transparent 60%),
          radial-gradient(1.3px 1.3px at 16% 22%, rgba(237,205,130,.45), transparent),
          radial-gradient(1.3px 1.3px at 38% 64%, rgba(198,160,255,.4), transparent),
          radial-gradient(1px 1px at 60% 18%, rgba(237,205,130,.4), transparent),
          radial-gradient(1.3px 1.3px at 84% 46%, rgba(198,160,255,.4), transparent),
          radial-gradient(1px 1px at 90% 72%, rgba(237,205,130,.35), transparent);
      }
      .public-shell main { position: relative; z-index: 2; }

      .public-wrap { max-width: var(--pub-maxw); margin: 0 auto; padding: 0 28px; position: relative; z-index: 2; }
      .public-shell h1, .public-shell h2, .public-shell h3, .public-shell h4 {
        font-family: 'Cinzel', serif; font-weight: 700; line-height: 1.16; letter-spacing: .03em; color: #fff;
      }
      .public-shell a { color: inherit; text-decoration: none; }

      /* Pill buttons */
      .public-btn {
        font-family: 'Cinzel', serif; font-weight: 600; letter-spacing: .12em; text-transform: uppercase;
        cursor: pointer; border: 1px solid var(--pub-gold-deep); border-radius: 40px;
        background: linear-gradient(180deg, rgba(51,38,80,.7), rgba(20,15,30,.7));
        color: var(--pub-gold-br); padding: 14px 34px; transition: .22s;
        position: relative; display: inline-flex; align-items: center; gap: 9px; text-align: center;
      }
      .public-btn::before {
        content: ""; position: absolute; inset: 3px; border: 1px solid rgba(201,164,74,.2);
        border-radius: 40px; pointer-events: none;
      }
      .public-btn:hover {
        border-color: var(--pub-gold); color: #fff; box-shadow: 0 0 24px rgba(201,164,74,.3); transform: translateY(-2px);
      }
      .public-btn-lg { padding: 17px 46px; font-size: 15px; }
      .public-btn-sm { padding: 9px 22px; font-size: 11px; border-radius: 30px; }
      .public-btn-sm::before { border-radius: 30px; }
      .public-btn-fill {
        background: linear-gradient(180deg, var(--pub-violet), var(--pub-violet-deep));
        border-color: var(--pub-violet-br); color: #fff;
      }
      .public-btn-fill:hover { box-shadow: 0 0 26px rgba(155,107,255,.45); }

      /* Nav */
      .public-nav {
        position: sticky; top: 0; z-index: 50; backdrop-filter: blur(14px);
        background: linear-gradient(180deg, rgba(19,14,29,.94), rgba(19,14,29,.5));
        border-bottom: 1px solid var(--pub-line);
      }
      .public-nav-in { display: flex; align-items: center; justify-content: space-between; height: 70px; }
      .public-logo {
        display: flex; align-items: center; gap: 12px; font-family: 'Cinzel';
        font-size: 21px; font-weight: 700; letter-spacing: .06em; color: #fff;
      }
      .public-crest {
        width: 34px; height: 34px; transform: rotate(45deg); display: grid; place-items: center;
        border: 1px solid var(--pub-gold);
        background: radial-gradient(circle at 38% 30%, var(--pub-violet-br), var(--pub-violet) 55%, var(--pub-violet-deep));
        box-shadow: 0 0 16px rgba(155,107,255,.5);
      }
      .public-crest span { transform: rotate(-45deg); font-size: 14px; color: #fff; }
      .public-nav-links {
        display: flex; align-items: center; gap: 24px; font-family: 'Cinzel';
        font-size: 12px; font-weight: 600; letter-spacing: .13em; text-transform: uppercase;
        color: var(--pub-ink-mut);
      }
      .public-nav-link { transition: color .2s; }
      .public-nav-link:hover, .public-nav-link.on { color: var(--pub-gold-br); }
      .public-nav-link.public-nav-shop { color: var(--pub-gold-br); }
      .public-nav-link.public-nav-shop::before {
        content: "✦"; font-size: 8px; margin-right: 7px; color: var(--pub-gold);
      }
      .public-nav-cta { display: flex; align-items: center; gap: 14px; }
      .public-ghost {
        font-family: 'Cinzel'; font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
        color: var(--pub-ink-mut); cursor: pointer;
      }
      .public-ghost:hover { color: #fff; }
      .public-nav-toggle {
        display: none; background: rgba(155,107,255,.07); border: 1px solid var(--pub-line-2);
        width: 44px; height: 38px; cursor: pointer; color: var(--pub-ink);
        align-items: center; justify-content: center; border-radius: 6px;
      }
      .public-nav-toggle span {
        position: relative; display: block; width: 18px; height: 2px; background: currentColor; transition: .25s;
      }
      .public-nav-toggle span::before, .public-nav-toggle span::after {
        content: ""; position: absolute; left: 0; width: 18px; height: 2px; background: currentColor; transition: .25s;
      }
      .public-nav-toggle span::before { transform: translateY(-6px); }
      .public-nav-toggle span::after { transform: translateY(6px); }
      .public-nav.open .public-nav-toggle span { background: transparent; }
      .public-nav.open .public-nav-toggle span::before { transform: rotate(45deg); }
      .public-nav.open .public-nav-toggle span::after { transform: rotate(-45deg); }

      /* Section headers */
      .public-section { padding: 100px 0; position: relative; }
      .public-head { margin-bottom: 46px; }
      .public-head .eyebrow {
        font-family: 'Cinzel'; font-size: 11px; letter-spacing: .32em;
        text-transform: uppercase; color: var(--pub-gold); opacity: .85;
      }
      .public-head .row { display: flex; align-items: center; gap: 22px; margin-top: 8px; }
      .public-head h2 {
        font-size: clamp(28px, 3.7vw, 44px); white-space: nowrap;
        text-shadow: 0 0 28px rgba(155,107,255,.2);
      }
      .public-head .fl { flex: 1; height: 1px; background: linear-gradient(90deg, var(--pub-gold-deep), transparent); }
      .public-head .fl-end { color: var(--pub-gold); font-size: 13px; }
      .public-head.center { text-align: center; }
      .public-head.center .row { justify-content: center; }
      .public-head.center .fl:first-of-type { background: linear-gradient(90deg, transparent, var(--pub-gold-deep)); }
      .public-divider { height: 1px; background: var(--pub-line); position: relative; max-width: var(--pub-maxw); margin: 0 auto; }
      .public-divider::after {
        content: "✦"; position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
        background: var(--pub-bg); padding: 0 16px; color: var(--pub-gold); font-size: 12px;
      }

      /* Footer */
      .public-footer {
        position: relative; z-index: 2; padding: 60px 0 24px; margin-top: 80px;
        border-top: 1px solid var(--pub-line);
        background: linear-gradient(180deg, transparent, rgba(19,14,29,.6));
      }
      .public-footer-in {
        display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 32px; padding-bottom: 32px;
      }
      .public-footer-brand .public-footer-tag {
        color: var(--pub-ink-mut); font-size: 14px; line-height: 1.55; margin-top: 12px; max-width: 36ch;
      }
      .public-footer-col h5 {
        font-family: 'Cinzel'; font-size: 11px; letter-spacing: .24em;
        text-transform: uppercase; color: var(--pub-gold); margin-bottom: 14px;
      }
      .public-footer-col a {
        display: block; font-size: 14px; color: var(--pub-ink-soft); padding: 4px 0;
        transition: color .2s; font-family: 'Hanken Grotesk', sans-serif;
      }
      .public-footer-col a:hover { color: #fff; }
      .public-footer-bottom {
        display: flex; justify-content: space-between; padding-top: 24px;
        border-top: 1px solid var(--pub-line); font-size: 12px; color: var(--pub-ink-faint);
        font-family: 'Cinzel'; letter-spacing: .1em;
      }

      /* Cards / grids — shared by landing + shop */
      .public-card {
        background: linear-gradient(180deg, var(--pub-panel), var(--pub-bg-2));
        border: 1px solid var(--pub-line); border-radius: 12px;
        overflow: hidden; transition: .25s; position: relative;
      }
      .public-card:hover {
        border-color: var(--pub-line-2);
        box-shadow: 0 12px 40px rgba(155,107,255,.12), 0 0 24px rgba(201,164,74,.08);
        transform: translateY(-3px);
      }

      /* Responsive */
      @media (max-width: 900px) {
        .public-footer-in { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 720px) {
        .public-nav-toggle { display: inline-flex; }
        .public-nav-links {
          position: absolute; top: 70px; left: 0; right: 0; z-index: 40;
          flex-direction: column; align-items: stretch; gap: 0;
          background: linear-gradient(180deg, rgba(19,14,29,.98), rgba(19,14,29,.92));
          border-bottom: 1px solid var(--pub-line); max-height: 0; overflow: hidden;
          opacity: 0; pointer-events: none; transition: .25s;
        }
        .public-nav.open .public-nav-links {
          max-height: 520px; opacity: 1; pointer-events: auto;
        }
        .public-nav-links .public-nav-link {
          padding: 15px 28px; border-bottom: 1px solid var(--pub-line);
        }
        .public-nav-links .public-nav-link:last-child { border-bottom: 0; }
        .public-nav-cta .public-ghost { display: none; }
        .public-section { padding: 72px 0; }
        .public-wrap { padding: 0 18px; }
        .public-head h2 { white-space: normal; }
        .public-head .row { flex-wrap: wrap; }
        .public-footer-in { grid-template-columns: 1fr 1fr; gap: 24px; }
        .public-footer-bottom { flex-direction: column; gap: 8px; }
      }
      @media (max-width: 440px) {
        .public-footer-in { grid-template-columns: 1fr; }
      }
    `}</style>
  )
}
