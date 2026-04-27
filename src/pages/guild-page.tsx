import { useParams, Link, Outlet } from "react-router-dom"
import { useAuth } from "@/contexts/auth-context"

export function GuildPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Link to="/login">Sign in</Link>
      </div>
    )
  }

  if (!guildId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[hsl(var(--muted-foreground))]">No server selected</p>
      </div>
    )
  }

  return <Outlet />
}
