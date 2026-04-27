import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomerHeader } from "@/components/customer-header"
import { ApiError, getGuilds, type Guild } from "@/lib/api"
import { Server } from "lucide-react"

function GuildIcon({ guild }: { guild: Guild }) {
  if (guild.icon) {
    return (
      <img
        src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`}
        alt=""
        className="w-12 h-12 rounded-xl object-cover"
      />
    )
  }
  return (
    <div className="w-12 h-12 rounded-xl bg-[hsl(var(--muted))] flex items-center justify-center text-xl font-bold text-[hsl(var(--muted-foreground))]">
      {guild.name.charAt(0).toUpperCase()}
    </div>
  )
}

/** Список серверов Discord, где у пользователя есть доступ к боту — логи, автороли, сообщения и т.д. */
export function MyGuildsPage() {
  const navigate = useNavigate()
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGuilds()
      .then(setGuilds)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
        if (e instanceof ApiError && e.status === 403) return setError("No access")
        setError(e instanceof Error ? e.message : "Loading error")
      })
      .finally(() => setLoading(false))
  }, [navigate])

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <CustomerHeader title="My Servers" />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
          These are servers where the bot is installed and you have permissions. Configure logs, auto-roles and messages on your server.
        </p>
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]">
            {error}
          </div>
        )}
        {loading ? (
          <div className="text-[hsl(var(--muted-foreground))]">Loading servers...</div>
        ) : guilds.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-[hsl(var(--muted-foreground))]">
              <Server className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No available servers.</p>
              <p className="text-sm mt-2">Add the bot to a server where you have permissions.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {guilds.map((guild) => (
              <Link key={guild.id} to={`/guild/${guild.id}`}>
                <Card className="hover:border-[hsl(var(--primary))] transition-colors h-full">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <GuildIcon guild={guild} />
                    <CardTitle className="text-lg">{guild.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Messages, templates, logs, reaction roles
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
