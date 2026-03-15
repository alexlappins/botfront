import { useParams, Link, Outlet } from "react-router-dom"
import { useAuth } from "@/contexts/auth-context"

export function GuildPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Загрузка...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Link to="/login">Войти</Link>
      </div>
    )
  }

  if (!guildId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[hsl(var(--muted-foreground))]">Сервер не выбран</p>
      </div>
    )
  }

  return <Outlet />
}
