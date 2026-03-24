import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AdminHeader } from "@/components/admin-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ApiError, adminUpsertStoreTemplate, getServerTemplates, type ServerTemplate } from "@/lib/api"

export function AdminStorePage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<ServerTemplate[]>([])
  const [templateId, setTemplateId] = useState("")
  const [price, setPrice] = useState("10")
  const [currency, setCurrency] = useState("USD")
  const [isActive, setIsActive] = useState("true")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    getServerTemplates()
      .then(setTemplates)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
        if (e instanceof ApiError && e.status === 403) return setError("Нет доступа")
      })
  }, [navigate])

  async function submit() {
    setError(null)
    setSuccess(null)
    try {
      await adminUpsertStoreTemplate({
        templateId,
        price: Number(price),
        currency,
        isActive: isActive === "true",
      })
      setSuccess("Сохранено.")
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      if (e instanceof ApiError && e.status === 403) return setError("Нет доступа")
      setError(e instanceof Error ? e.message : "Ошибка")
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <AdminHeader title="Магазин" />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardHeader><CardTitle>Upsert карточки магазина</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Шаблон из списка</Label>
              <Select
                value={templateId || "__none__"}
                onValueChange={(v) => setTemplateId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите шаблон" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Не выбрано</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Template ID</Label>
              <Input value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="UUID шаблона" />
              <div className="text-xs text-[hsl(var(--muted-foreground))] break-all">
                Можно выбрать из списка выше или вставить UUID вручную.
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="grid gap-2"><Label>Price</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Currency</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
              <div className="grid gap-2"><Label>isActive</Label><Input value={isActive} onChange={(e) => setIsActive(e.target.value)} placeholder="true/false" /></div>
            </div>
            {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
            {success && <p className="text-sm text-[hsl(var(--primary))]">{success}</p>}
            <Button onClick={submit} disabled={!templateId.trim()}>Сохранить</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
