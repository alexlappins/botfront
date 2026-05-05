import { useState, type ReactNode } from "react"
import { Link, NavLink, Outlet } from "react-router-dom"
import {
  Bell,
  ChevronDown,
  Loader2,
  LogOut,
  MessageSquareText,
  Search,
  ShoppingBag,
  ScrollText,
  Server,
  Smile,
  Sparkles,
} from "lucide-react"
import { LOGOUT_URL } from "@/lib/api"
import { ActiveGuildProvider, useActiveGuild } from "@/contexts/active-guild-context"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

type NavItem = {
  to: string
  label: string
  icon: typeof ShoppingBag
  end?: boolean
}

const NAV: NavItem[] = [
  { to: "/store", label: "Магазин", icon: ShoppingBag },
  { to: "/my-purchases", label: "Список покупок", icon: ScrollText },
  { to: "/server-messages", label: "Шаблоны сообщений", icon: MessageSquareText },
  { to: "/reaction-roles", label: "Роли по реакции", icon: Smile },
  { to: "/server-logs", label: "Логи сервера", icon: ScrollText },
]

export function AdminLayout({ children }: { children?: ReactNode }) {
  return (
    <ActiveGuildProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </ActiveGuildProvider>
  )
}

function AdminLayoutInner({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0b14] text-[#e7e7f0] flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="w-[260px] shrink-0 border-r border-white/5 bg-[#0e0e18] flex flex-col">
      <div className="px-5 pt-6 pb-3">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-white/40 uppercase">
          Мои сервера
        </p>
        <div className="mt-2">
          <ServerSelector />
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
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
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/5">
        <Link
          to="#"
          className="block w-full text-center rounded-xl border border-white/10 bg-white/[0.03] py-2 text-sm text-white/60 hover:bg-white/5"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Скоро: премиум
          </span>
        </Link>
      </div>
    </aside>
  )
}

function ServerSelector() {
  const { guilds, activeGuild, activeGuildId, setActiveGuildId, loading } = useActiveGuild()
  const [open, setOpen] = useState(false)

  if (loading && guilds.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-white/40" />
        <span className="text-sm text-white/50">Загрузка серверов…</span>
      </div>
    )
  }

  if (guilds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-3 text-xs text-white/50 leading-tight">
        Нет серверов с ботом.
        <br />
        Установите шаблон → бот появится на сервере → выберите его здесь.
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
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center text-white font-semibold">
          {activeGuild?.name?.[0]?.toUpperCase() ?? <Server className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {activeGuild?.name ?? "Сервер не выбран"}
          </p>
          <p className="text-[11px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Сервер активен
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
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center text-white text-xs font-semibold">
                  {g.name[0]?.toUpperCase() ?? "?"}
                </div>
                <span className="text-sm text-white/85 truncate">{g.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function TopBar() {
  const { user } = useAuth()
  return (
    <header className="flex items-center gap-4 px-8 h-16 border-b border-white/5 bg-[#0b0b14]/60 backdrop-blur">
      {/* Search — takes available space but capped, then flex-spacer pushes the right cluster to the edge */}
      <div className="flex-1 max-w-2xl relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input
          type="text"
          placeholder="Поиск шаблонов, категорий, функций…"
          className="w-full pl-11 pr-4 h-10 rounded-full bg-white/[0.04] border border-white/10 text-sm placeholder:text-white/30 outline-none focus:border-violet-500/60"
          disabled
        />
      </div>

      {/* Right cluster: notifications + user — pinned to the right edge */}
      <div className="ml-auto flex items-center gap-4">
        <button
          type="button"
          className="relative w-10 h-10 grid place-items-center rounded-full bg-white/[0.04] border border-white/10 text-white/60 hover:text-white"
          title="Notifications (placeholder)"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center text-[10px] font-bold rounded-full bg-red-500 text-white">
            3
          </span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center text-sm font-semibold">
            {user?.username?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">{user?.username ?? "User"}</p>
            {user?.role && <p className="text-[11px] text-white/40">{user.role}</p>}
          </div>
          <a
            href={LOGOUT_URL}
            title="Sign out"
            className="ml-2 grid place-items-center w-9 h-9 rounded-full hover:bg-white/5 text-white/50 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  )
}
