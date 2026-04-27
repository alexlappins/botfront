import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomerHeader } from "@/components/customer-header"
import { ApiError, getMyServerTemplates, type ServerTemplate } from "@/lib/api"

export function MyTemplatesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ServerTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyServerTemplates()
      .then(setItems)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
        if (e instanceof ApiError && e.status === 403) return setError("No access")
        setError(e instanceof Error ? e.message : "Loading error")
      })
      .finally(() => setLoading(false))
  }, [navigate])

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <CustomerHeader title="My Templates" />
      <main className="container mx-auto max-w-4xl px-4 py-8 space-y-4">
        {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
        {loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading...</p> : (
          <div className="space-y-3">
            {items.map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle>{t.name}</CardTitle>
                  {t.description && <CardDescription>{t.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    Available to install
                  </div>
                  <Button size="sm" asChild>
                    <Link to={`/install/${t.id}`}>Install</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
