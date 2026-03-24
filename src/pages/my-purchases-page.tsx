import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomerHeader } from "@/components/customer-header"
import { ApiError, getMyPurchases, type Purchase } from "@/lib/api"

export function MyPurchasesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyPurchases()
      .then(setItems)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
        if (e instanceof ApiError && e.status === 403) return setError("Нет доступа")
        setError(e instanceof Error ? e.message : "Ошибка загрузки")
      })
      .finally(() => setLoading(false))
  }, [navigate])

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <CustomerHeader title="История покупок" />
      <main className="container mx-auto max-w-3xl px-4 py-8 space-y-3">
        {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
        {loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Загрузка...</p> : (
          items.map((p) => (
            <Card key={p.id}>
              <CardHeader><CardTitle className="text-base">{p.templateName ?? p.templateId}</CardTitle></CardHeader>
              <CardContent className="text-sm text-[hsl(var(--muted-foreground))]">
                {p.amount != null ? `${p.amount} ${p.currency ?? ""}` : "Оплачено"} · {new Date(p.createdAt).toLocaleString("ru-RU")}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  )
}
