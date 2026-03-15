import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { getGuilds, LOGOUT_URL, type Guild } from "@/lib/api"
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

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getGuilds()
      .then(setGuilds)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true })
    }
  }, [authLoading, user, navigate])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Загрузка...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Мои серверы</h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to="/server-templates">Редактор шаблонов</Link>
            </Button>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">{user.username}</span>
            <Button variant="outline" size="sm" asChild>
              <a href={LOGOUT_URL}>Выйти</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]">
            {error}
          </div>
        )}
        {loading ? (
          <div className="text-[hsl(var(--muted-foreground))]">Загрузка серверов...</div>
        ) : guilds.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-[hsl(var(--muted-foreground))]">
              <Server className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Нет доступных серверов.</p>
              <p className="text-sm mt-2">Добавьте бота на сервер, где у вас есть права.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guilds.map((guild) => (
              <Link key={guild.id} to={`/guild/${guild.id}`}>
                <Card className="hover:border-[hsl(var(--primary))] transition-colors h-full">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <GuildIcon guild={guild} />
                    <CardTitle className="text-lg">{guild.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Управление шаблонами и отправка сообщений
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
