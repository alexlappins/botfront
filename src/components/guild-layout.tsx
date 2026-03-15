import { Link, NavLink, Outlet, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { GuildDataProvider, useGuildData } from "@/contexts/guild-data-context"
import { LOGOUT_URL } from "@/lib/api"
import { ArrowLeft, Send, FileStack, ScrollText, MessageSquare, ServerCog, LayoutTemplate } from "lucide-react"
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
    <div className="min-h-screen flex bg-[hsl(var(--background))]">
      <aside className="w-64 shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col">
        <div className="p-4 border-b border-[hsl(var(--border))]">
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
        <nav className="flex-1 p-2 space-y-0.5">
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
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
          <div className="pt-2 mt-2 border-t border-[hsl(var(--border))]">
            <Link
              to={SERVER_TEMPLATES_LINK.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <SERVER_TEMPLATES_LINK.icon className="h-4 w-4 shrink-0" />
              {SERVER_TEMPLATES_LINK.label}
            </Link>
          </div>
        </nav>
        <div className="p-2 border-t border-[hsl(var(--border))]">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={LOGOUT_URL}>Выйти</a>
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="container max-w-4xl mx-auto px-4 py-8">
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
