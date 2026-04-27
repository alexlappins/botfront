import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomerHeader } from "@/components/customer-header"
import { ApiError, checkoutTemplate, getStoreTemplates, type StoreTemplateProduct } from "@/lib/api"

export function StorePage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<StoreTemplateProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await getStoreTemplates())
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      if (e instanceof ApiError && e.status === 403) return setError("No access")
      setError(e instanceof Error ? e.message : "Loading error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleBuy(templateId: string) {
    setBuyingId(templateId)
    setError(null)
    setSuccess(null)
    try {
      await checkoutTemplate(templateId)
      setSuccess("Purchase completed successfully.")
      await load()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      if (e instanceof ApiError && e.status === 403) return setError("No access")
      setError(e instanceof Error ? e.message : "Purchase error")
    } finally {
      setBuyingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <CustomerHeader title="Server Store" />
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        {success && <p className="text-sm text-[hsl(var(--primary))]">{success}</p>}
        {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
        {loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading...</p> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <Card key={item.templateId}>
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                  {item.description && <CardDescription>{item.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{item.price} {item.currency}</p>
                  {item.discordTemplateUrl && (
                    <a className="text-xs text-[hsl(var(--primary))] hover:underline break-all" href={item.discordTemplateUrl} target="_blank" rel="noreferrer">
                      Discord template
                    </a>
                  )}
                  <Button size="sm" onClick={() => handleBuy(item.templateId)} disabled={buyingId === item.templateId}>
                    {buyingId === item.templateId ? "Purchasing..." : "Buy"}
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
