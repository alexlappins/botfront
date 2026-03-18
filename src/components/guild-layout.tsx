import { Link, NavLink, Outlet, useParams } from "react-router-dom"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { GuildDataProvider, useGuildData } from "@/contexts/guild-data-context"
import { LOGOUT_URL } from "@/lib/api"
import {
  ArrowLeft,
  Send,
  FileStack,
  ScrollText,
  MessageSquare,
  ServerCog,
  LayoutTemplate,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: ".", end: true, label: "Отправить сообщение", icon: Send },
  { to: "templates", end: false, label: "Шаблоны", icon: FileStack },
  { to: "install-template", end: false, label: "Установить шаблон сервера", icon: ServerCog },
  { to: "logs", end: false, label: "Логи", icon: ScrollText },
  { to: "reaction-roles", end: false, label: "Роли по реакции", icon: MessageSquare },
] as const

/** Ссылка на глобальный редактор шаблонов (создать/редактировать шаблон сервера) */
const SERVER_TEMPLATES_LINK = { to: "/server-templates" as const, label: "Создать шаблон сервера", icon: LayoutTemplate }

function GuildLayoutInner() {
  const { guild, loading, error } = useGuildData()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Загрузка...</div>
      </div>
    )
  }

  if (error || !guild) {
    return (
      <div className="min-h-screen p-4 bg-[hsl(var(--background))]">
        <Link to="/" className="text-[hsl(var(--primary))] hover:underline">
          ← Назад к серверам
        </Link>
        <div className="mt-4 p-4 rounded-lg bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]">
          {error ?? "Сервер не найден или нет доступа."}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] lg:flex">
      {/* Мобильный верхний бар */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <div className="flex flex-col min-w-0">
            <Link
              to="/"
              className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              <ArrowLeft className="h-3 w-3" />
              Серверы
            </Link>
            <span className="text-sm font-semibold truncate" title={guild.name}>
              {guild.name}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 px-3" asChild>
          <a href={LOGOUT_URL}>Выйти</a>
        </Button>
      </div>

      {/* Оверлей: по тапу вне меню — закрыть (только мобиле) */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          className="fixed inset-0 z-[35] bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Левый сайдбар: постоянный на десктопе, выезжающий на мобиле */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col transform transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="hidden lg:block p-4 border-b border-[hsl(var(--border))]">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <ArrowLeft className="h-4 w-4" />
            Серверы
          </Link>
          <h1 className="mt-3 font-semibold truncate" title={guild.name}>
            {guild.name}
          </h1>
        </div>
        <nav className="flex-1 p-2 pt-6 lg:pt-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                )
              }
              onClick={() => setMobileOpen(false)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
          <div className="pt-2 mt-2 border-t border-[hsl(var(--border))]">
            <Link
              to={SERVER_TEMPLATES_LINK.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <SERVER_TEMPLATES_LINK.icon className="h-4 w-4 shrink-0" />
              {SERVER_TEMPLATES_LINK.label}
            </Link>
          </div>
        </nav>
        <div className="hidden lg:block p-2 border-t border-[hsl(var(--border))]">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={LOGOUT_URL}>Выйти</a>
          </Button>
        </div>
      </aside>

      {/* Основной контент: отступ сверху под мобильный бар */}
      <main className="flex-1 overflow-auto pt-[56px] lg:pt-0">
        <div className="container max-w-4xl mx-auto px-4 py-6 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export function GuildLayout() {
  const { guildId } = useParams<{ guildId: string }>()
  if (!guildId) return null
  return (
    <GuildDataProvider guildId={guildId}>
      <GuildLayoutInner />
    </GuildDataProvider>
  )
}
