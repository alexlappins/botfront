import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AdminHeader } from "@/components/admin-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, adminGrantTemplateAccess, adminRevokeTemplateAccess } from "@/lib/api"

export function AdminTemplateAccessPage() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function grant() {
    setError(null)
    setSuccess(null)
    try {
      await adminGrantTemplateAccess({ userId, templateId })
      setSuccess("Access granted.")
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      if (e instanceof ApiError && e.status === 403) return setError("No access")
      setError(e instanceof Error ? e.message : "Error")
    }
  }

  async function revoke() {
    setError(null)
    setSuccess(null)
    try {
      await adminRevokeTemplateAccess(userId, templateId)
      setSuccess("Access revoked.")
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      if (e instanceof ApiError && e.status === 403) return setError("No access")
      setError(e instanceof Error ? e.message : "Error")
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <AdminHeader title="Template Access" />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader><CardTitle>Grant / Revoke</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>User ID</Label>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Template ID</Label>
              <Input value={templateId} onChange={(e) => setTemplateId(e.target.value)} />
            </div>
            {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
            {success && <p className="text-sm text-[hsl(var(--primary))]">{success}</p>}
            <div className="flex gap-2">
              <Button onClick={grant} disabled={!userId || !templateId}>Grant</Button>
              <Button variant="outline" onClick={revoke} disabled={!userId || !templateId}>Revoke</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
