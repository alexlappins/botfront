import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/contexts/auth-context"
import { getStoreFeatured, type StoreTemplateProduct } from "@/lib/api"
import { PublicShell } from "@/components/public-shell"

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

  const botInvite =
    (import.meta.env.VITE_BOT_INVITE_URL as string | undefined) ?? "https://discord.com/oauth2/authorize"
  const loginHref = "/api/auth/discord"
  const dashboardHref = user?.role === "admin" ? "/server-templates" : "/store"

  return (
    <PublicShell activeNav="home">
      <LandingStyles />

      {/* Hero */}
      <header className="hero">
        <div className="hero-scrim" />
        <div className="public-wrap hero-in">
          <span className="hero-eyebrow">The Streamer's Companion</span>
          <h1>
            Summon the bot that <span className="hero-em">levels up</span> your realm.
          </h1>
          <p className="hero-sub">
            Live alerts, guardian moderation, and ready-forged servers — one companion for streamers,
            VTubers, and the communities they raise.
          </p>
          <div className="hero-actions">
            <a href={botInvite} target="_blank" rel="noopener noreferrer" className="public-btn public-btn-lg">
              Add to Discord
            </a>
            <Link to="/shop" className="public-btn public-btn-lg public-btn-fill">
              Enter the Shop
            </Link>
          </div>
          <div className="hero-foot">
            Free to begin · Twitch · YouTube · Kick · TikTok
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="stats">
        <div className="public-wrap stats-in">
          <div className="stat">
            <span className="ic">⚔</span>
            <div>
              <b>Forged daily</b>
              <span>By a small studio</span>
            </div>
          </div>
          <div className="stat">
            <span className="ic">◈</span>
            <div>
              <b>4 platforms</b>
              <span>Twitch · YT · Kick · TikTok</span>
            </div>
          </div>
          <div className="stat">
            <span className="ic">★</span>
            <div>
              <b>One-click</b>
              <span>Server templates</span>
            </div>
          </div>
          <div className="stat">
            <span className="ic">✦</span>
            <div>
              <b>Verified</b>
              <span>by Discord</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <section id="features" className="public-section">
        <div className="public-wrap">
          <div className="public-head">
            <span className="eyebrow">Unique Features</span>
            <div className="row">
              <h2>The Companion</h2>
              <span className="fl" />
              <span className="fl-end">✦</span>
            </div>
          </div>
          <div className="fgrid">
            {FEATURES.map((f) => (
              <div key={f.title} className={`fcard ${f.feat ? "feat" : ""}`}>
                <div className="thumb">
                  <span className="emoji">{f.emoji}</span>
                </div>
                <div className="body">
                  <span className="cat">{f.cat}</span>
                  <h4>{f.title}</h4>
                  {f.feat && f.desc && <p>{f.desc}</p>}
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
          <div className="public-head">
            <span className="eyebrow">The Merchant</span>
            <div className="row">
              <h2>Featured Realms</h2>
              <span className="fl" />
              <span className="fl-end">✦</span>
            </div>
            <p className="public-sub">
              Ready-forged Discord servers — channels, roles, welcome flow, leveling and live alerts pre-wired.
              Install in one click after purchase.
            </p>
          </div>

          {featured.length === 0 ? (
            <div className="empty-state">
              <p>Скоро здесь появятся первые шаблоны. Загляните позже.</p>
            </div>
          ) : (
            <div className="gal">
              {featured.map((p) => (
                <Link key={p.id ?? p.templateId} to={`/shop/${p.id}`} className="gtile public-card">
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

          <div style={{ textAlign: "center", marginTop: 34 }}>
            <Link to="/shop" className="public-btn public-btn-lg">
              Enter the full Shop
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final">
        <div className="public-wrap final-in">
          <h2>
            Light the candle. <span className="hero-em">Go live.</span>
          </h2>
          <p>Plant the companion on your server. Forge channels, summon alerts, raise your guild.</p>
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <a href={botInvite} target="_blank" rel="noopener noreferrer" className="public-btn public-btn-lg">
              Add to Discord
            </a>
            {user ? (
              <Link to={dashboardHref} className="public-btn public-btn-lg public-btn-fill">
                Open dashboard
              </Link>
            ) : (
              <a href={loginHref} className="public-btn public-btn-lg public-btn-fill">
                Sign in
              </a>
            )}
          </div>
        </div>
      </section>
    </PublicShell>
  )
}

const FEATURES: { emoji: string; cat: string; title: string; feat?: boolean; desc?: string }[] = [
  { emoji: "🛡️", cat: "Security", title: "The Ward" },
  {
    emoji: "✦",
    cat: "Legendary",
    title: "Streamer Suite",
    feat: true,
    desc: "The signature power no rival bot wields — live alerts across Twitch, YouTube, Kick & TikTok, native VTuber tools and analytics.",
  },
  { emoji: "⚖️", cat: "Moderation", title: "Keep Order" },
  { emoji: "🤝", cat: "Community", title: "Fellowship" },
  { emoji: "🎫", cat: "Support", title: "Tickets" },
  { emoji: "🎁", cat: "Engage", title: "Giveaways" },
  { emoji: "⭐", cat: "Reward", title: "XP & Levels" },
  { emoji: "📊", cat: "Insight", title: "Analytics" },
]

function LandingStyles() {
  return (
    <style>{`
      /* ── Hero ── */
      .hero {
        position: relative;
        padding: 100px 0 60px;
        overflow: hidden;
        text-align: center;
      }
      .hero-scrim {
        position: absolute; inset: 0; pointer-events: none;
        background:
          radial-gradient(800px 400px at 50% 30%, rgba(155,107,255,.25), transparent 60%),
          radial-gradient(600px 300px at 50% 80%, rgba(201,164,74,.08), transparent 60%);
      }
      .hero-in { position: relative; z-index: 2; }
      .hero-eyebrow {
        display: inline-block;
        font-family: 'Cinzel'; font-size: 12px; letter-spacing: .32em;
        text-transform: uppercase; color: var(--pub-gold); margin-bottom: 18px;
      }
      .hero h1 {
        font-size: clamp(34px, 5.4vw, 64px); line-height: 1.1; margin-bottom: 22px;
      }
      .hero-em {
        background: linear-gradient(180deg, var(--pub-gold-br), var(--pub-gold));
        -webkit-background-clip: text; background-clip: text; color: transparent;
        text-shadow: 0 0 28px rgba(201,164,74,.5);
      }
      .hero-sub {
        max-width: 620px; margin: 0 auto 32px; color: var(--pub-ink-soft);
        font-size: clamp(15px, 1.8vw, 19px);
      }
      .hero-actions {
        display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
      }
      .hero-foot {
        margin-top: 28px; font-family: 'Cinzel'; font-size: 11px;
        letter-spacing: .22em; text-transform: uppercase; color: var(--pub-ink-mut);
      }

      /* ── Stats ── */
      .stats {
        padding: 36px 0;
        border-top: 1px solid var(--pub-line);
        border-bottom: 1px solid var(--pub-line);
        background: linear-gradient(180deg, rgba(33,25,52,.4), rgba(19,14,29,.6));
        position: relative; z-index: 2;
      }
      .stats-in {
        display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;
      }
      .stat {
        display: flex; align-items: center; gap: 14px;
      }
      .stat .ic {
        width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--pub-gold-deep);
        display: grid; place-items: center; color: var(--pub-gold-br); font-size: 18px;
        background: radial-gradient(circle at 40% 30%, rgba(155,107,255,.3), rgba(20,15,30,.7));
      }
      .stat b {
        display: block; font-family: 'Cinzel'; font-size: 18px; color: #fff; letter-spacing: .06em;
      }
      .stat span:not(.ic) {
        color: var(--pub-ink-mut); font-size: 12px;
        font-family: 'Cinzel'; letter-spacing: .14em; text-transform: uppercase;
      }

      /* ── Features grid ── */
      .fgrid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 18px;
      }
      .fcard {
        background: linear-gradient(180deg, var(--pub-panel), var(--pub-bg-2));
        border: 1px solid var(--pub-line); border-radius: 12px;
        padding: 22px; transition: .25s; position: relative;
      }
      .fcard:hover {
        border-color: var(--pub-line-2);
        box-shadow: 0 12px 40px rgba(155,107,255,.12);
        transform: translateY(-3px);
      }
      .fcard.feat {
        grid-column: span 2; grid-row: span 2;
        background: linear-gradient(180deg, rgba(155,107,255,.12), rgba(20,15,30,.85));
        border-color: rgba(155,107,255,.35);
      }
      .fcard .thumb {
        width: 64px; height: 64px; border-radius: 12px;
        background: radial-gradient(circle at 35% 30%, var(--pub-violet-br), var(--pub-violet-deep));
        display: grid; place-items: center; margin-bottom: 18px;
        box-shadow: 0 0 24px rgba(155,107,255,.4);
        border: 1px solid rgba(255,255,255,.08);
      }
      .fcard.feat .thumb {
        width: 88px; height: 88px;
        background: radial-gradient(circle at 35% 30%, var(--pub-gold-br), var(--pub-gold-deep));
        box-shadow: 0 0 28px rgba(201,164,74,.4);
      }
      .fcard .thumb .emoji { font-size: 28px; }
      .fcard.feat .thumb .emoji { font-size: 38px; }
      .fcard .cat {
        display: inline-block; font-family: 'Cinzel'; font-size: 9.5px;
        letter-spacing: .2em; text-transform: uppercase; color: var(--pub-gold);
        margin-bottom: 6px;
      }
      .fcard h4 {
        font-size: 18px; color: #fff; margin-bottom: 6px;
      }
      .fcard.feat h4 { font-size: 24px; }
      .fcard p {
        color: var(--pub-ink-soft); font-size: 14px; line-height: 1.55; margin-top: 6px;
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
        color: var(--pub-ink-soft); font-size: 16px; max-width: 60ch; margin-top: 12px;
      }
      .gal {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;
      }
      .gtile {
        display: block; aspect-ratio: 16/10; position: relative; overflow: hidden;
      }
      .gtile-img {
        position: absolute; inset: 0; display: grid; place-items: center;
        background: linear-gradient(135deg, rgba(155,107,255,.25), rgba(201,164,74,.12));
      }
      .gtile-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s; }
      .gtile:hover .gtile-img img { transform: scale(1.04); }
      .gtile-fallback {
        font-family: 'Cinzel'; font-size: 64px; color: rgba(255,255,255,.2);
      }
      .gtile .play {
        position: absolute; inset: 0; display: grid; place-items: center;
        color: rgba(255,255,255,.85); font-size: 40px; pointer-events: none;
        text-shadow: 0 0 16px rgba(0,0,0,.6); opacity: 0; transition: opacity .25s;
      }
      .gtile:hover .play { opacity: 1; }
      .gtile .cap {
        position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 16px;
        background: linear-gradient(180deg, transparent, rgba(0,0,0,.7));
        font-family: 'Cinzel'; font-size: 13px; letter-spacing: .08em;
        color: var(--pub-gold-br);
      }
      @media (max-width: 820px) { .gal { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 540px) { .gal { grid-template-columns: 1fr; } }

      .empty-state {
        padding: 60px 20px; text-align: center; color: var(--pub-ink-mut);
        border: 1px dashed var(--pub-line-2); border-radius: 12px;
      }

      /* ── Final CTA ── */
      .final {
        padding: 90px 0;
        background: linear-gradient(180deg, transparent, rgba(33,25,52,.5));
        border-top: 1px solid var(--pub-line);
        text-align: center; position: relative; z-index: 2;
      }
      .final h2 {
        font-size: clamp(28px, 4vw, 48px); margin-bottom: 16px;
      }
      .final p {
        color: var(--pub-ink-soft); max-width: 50ch; margin: 0 auto 30px;
      }
    `}</style>
  )
}
