import { useState, type ReactNode } from "react"
import { Link, NavLink, Outlet } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  Bot,
  ChevronDown,
  HandHeart,
  Loader2,
  LogOut,
  Menu,
  MessageSquareText,
  ShoppingBag,
  ScrollText,
  Server,
  Smile,
  Sparkles,
  TrendingUp,
  Twitch,
  X,
} from "lucide-react"
import { LOGOUT_URL } from "@/lib/api"
import { ActiveGuildProvider, useActiveGuild } from "@/contexts/active-guild-context"
import { PremiumProvider, usePremium } from "@/contexts/premium-context"
import { PremiumBadge, PremiumModalProvider } from "@/components/premium"
import { useAuth } from "@/contexts/auth-context"
import { LanguageSwitcher } from "@/components/language-switcher"
import { cn } from "@/lib/utils"

type NavItem = {
  to: string
  /** i18n leaf under `nav.*` — resolved at render time so language switching
   *  doesn't need a re-import. Icons stay static. */
  labelKey: string
  icon: typeof ShoppingBag
  end?: boolean
}

const NAV: NavItem[] = [
  // The shop shipped (TZ-1) — purchases live in the sidebar again (§5).
  { to: "/my-purchases", labelKey: "nav.purchases", icon: ShoppingBag },
  { to: "/server-messages", labelKey: "nav.serverMessages", icon: MessageSquareText },
  { to: "/welcome", labelKey: "nav.welcome", icon: HandHeart },
  { to: "/leveling", labelKey: "nav.leveling", icon: TrendingUp },
  { to: "/twitch", labelKey: "nav.twitch", icon: Twitch },
  { to: "/reaction-roles", labelKey: "nav.reactionRoles", icon: Smile },
  { to: "/server-logs", labelKey: "nav.serverLogs", icon: ScrollText },
  { to: "/personalization", labelKey: "nav.personalization", icon: Bot },
]

export function AdminLayout({ children }: { children?: ReactNode }) {
  return (
    <ActiveGuildProvider>
      <PremiumProvider>
        <PremiumModalProvider>
          <AdminLayoutInner>{children}</AdminLayoutInner>
        </PremiumModalProvider>
      </PremiumProvider>
    </ActiveGuildProvider>
  )
}

function AdminLayoutInner({ children }: { children?: ReactNode }) {
  // Layout strategy:
  // - Wrapper is `h-screen overflow-hidden flex` so the page never scrolls as a whole.
  // - Desktop (lg+): sidebar is a static 260px column, exactly as before.
  // - Mobile: sidebar becomes an off-canvas drawer toggled from the TopBar
  //   burger; a backdrop closes it, as does tapping any nav link.
  // - Right column has its own scroll inside `<main>`.
  const [navOpen, setNavOpen] = useState(false)
  return (
    <div className="h-screen overflow-hidden bg-[#0b0b14] text-[#e7e7f0] flex">
      {navOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <TopBar onMenu={() => setNavOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Full-height column. Top: server selector (sticky-feel because column is fixed height).
  // Middle: scrollable nav. Bottom: pinned premium block via mt-auto wrapper.
  const { t } = useTranslation()
  return (
    <aside
      className={cn(
        "w-[260px] shrink-0 border-r border-white/5 bg-[#0e0e18] flex flex-col h-screen",
        // Mobile: fixed drawer sliding in from the left; desktop: back to static.
        "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="px-5 pt-6 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-white/40 uppercase">
            {t("nav.myServers")}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2">
          <ServerSelector />
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto min-h-0">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gradient-to-r from-violet-600/30 to-purple-600/10 text-white border border-violet-500/40"
                  : "text-white/65 hover:bg-white/5 hover:text-white",
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Language selector moved to the TopBar (TZ §10). */}
      <SidebarPremiumBlock />
    </aside>
  )
}

/** Bottom sidebar CTA: upgrade link for free guilds, plan status for premium ones. */
function SidebarPremiumBlock() {
  const { t } = useTranslation()
  const { premium } = usePremium()
  return (
    <div className="px-5 py-4 border-t border-white/5 shrink-0">
      {premium ? (
        <Link
          to="/pricing"
          className="block w-full text-center rounded-xl border border-amber-400/30 bg-amber-400/[0.06] py-2 text-sm text-amber-300 hover:bg-amber-400/10"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t("premium.badgePremium")}
          </span>
        </Link>
      ) : (
        <Link
          to="/pricing"
          className="block w-full text-center rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-2 text-sm font-medium text-white hover:from-violet-500 hover:to-purple-500"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t("premium.sidebarCta")}
          </span>
        </Link>
      )}
    </div>
  )
}

/**
 * Build a Discord CDN icon URL for a guild from its hash.
 * Returns null if the guild has no custom icon (caller falls back to the default avatar tile).
 */
function discordGuildIconUrl(guildId: string, iconHash: string | null): string | null {
  if (!iconHash) return null
  const ext = iconHash.startsWith("a_") ? "gif" : "png"
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=64`
}

/** Avatar tile for a guild — real Discord icon if available, otherwise initials on gradient. */
function GuildAvatar({
  guild,
  size,
}: {
  guild: { id: string; name: string; icon: string | null } | null | undefined
  size: number
}) {
  const url = guild ? discordGuildIconUrl(guild.id, guild.icon) : null
  const initial = guild?.name?.[0]?.toUpperCase() ?? "?"
  const fontSize = Math.max(10, Math.round(size / 2.6))
  if (url) {
    return (
      <img
        src={url}
        alt={guild?.name ?? ""}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, fontSize }}
    >
      {initial}
    </div>
  )
}

function ServerSelector() {
  const { t } = useTranslation()
  const { guilds, activeGuild, activeGuildId, setActiveGuildId, loading } = useActiveGuild()
  const [open, setOpen] = useState(false)

  if (loading && guilds.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-white/40" />
        <span className="text-sm text-white/50">{t("guildSelector.loading")}</span>
      </div>
    )
  }

  if (guilds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-3 text-xs text-white/50 leading-tight">
        {t("guildSelector.noServers")}
        <br />
        {t("guildSelector.noServersHint")}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left hover:bg-white/[0.06] transition-colors"
      >
        {activeGuild ? (
          <GuildAvatar guild={activeGuild} size={36} />
        ) : (
          <div className="w-9 h-9 rounded-full bg-white/[0.06] grid place-items-center text-white/50">
            <Server className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {activeGuild?.name ?? t("guildSelector.noneSelected")}
          </p>
          <p className="text-[11px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {t("guildSelector.active")}
          </p>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-white/40 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#15151f] shadow-2xl py-1 max-h-72 overflow-y-auto">
            {guilds.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setActiveGuildId(g.id)
                  setOpen(false)
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5",
                  g.id === activeGuildId && "bg-white/[0.04]",
                )}
              >
                <GuildAvatar guild={g} size={28} />
                <span className="text-sm text-white/85 truncate">{g.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user } = useAuth()
  // Search input and notification bell are intentionally not rendered until
  // they actually do something. Both are coming back as real working features
  // (store search + news feed). Stub UI now would just confuse users.
  return (
    <header className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 lg:px-8 h-14 lg:h-16 border-b border-white/5 bg-[#0b0b14]/60 backdrop-blur">
      {/* Mobile burger — opens the sidebar drawer. */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      {/* Language selector lives up here next to the user avatar (TZ §10). */}
      <LanguageSwitcher />
      {/* Premium status indicator for the active server (TZ §1.3). */}
      <PremiumBadge />
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center text-sm font-semibold shrink-0">
          {user?.username?.[0]?.toUpperCase() ?? "U"}
        </div>
        {/* Name + role hidden on phones — the avatar carries identity. */}
        <div className="leading-tight hidden sm:block">
          <p className="text-sm font-semibold text-white">{user?.username ?? "User"}</p>
          {user?.role && <p className="text-[11px] text-white/40">{user.role}</p>}
        </div>
        <a
          href={LOGOUT_URL}
          title="Sign out"
          className="sm:ml-2 grid place-items-center w-9 h-9 rounded-full hover:bg-white/5 text-white/50 hover:text-white shrink-0"
        >
          <LogOut className="h-4 w-4" />
        </a>
      </div>
    </header>
  )
}
