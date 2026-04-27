import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ApiError,
  getMyServerTemplates,
  installServerTemplateWithResult,
  type InstallApplyResult,
  type ServerTemplate,
} from "@/lib/api"
import { ServerCog } from "lucide-react"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function GuildInstallTemplatePage() {
  const { guildId } = useParams<{ guildId: string }>()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<ServerTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [installResult, setInstallResult] = useState<InstallApplyResult | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const list = await getMyServerTemplates()
      setTemplates(list)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate("/login", { replace: true })
        return
      }
      if (e instanceof ApiError && e.status === 403) {
        setError("No access to templates list (buy a template or request access).")
        return
      }
      setError(e instanceof Error ? e.message : "Error loading templates")
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    load()
  }, [load])

  async function handleInstall(templateId: string) {
    if (!guildId) return
    setInstallError(null)
    setInstallResult(null)
    setInstallingId(templateId)
    try {
      const result = await installServerTemplateWithResult(guildId, templateId)
      setInstallResult(result)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate("/login", { replace: true })
        return
      }
      setInstallError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Installation error")
    } finally {
      setInstallingId(null)
    }
  }

  if (!guildId) return null

  return (
    <div className="space-y-6 sm:space-y-8">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ServerCog className="h-5 w-5" />
            Install Server Template
          </CardTitle>
          <CardDescription>
            The list shows only templates you have access to (purchased / granted). Full installation is performed by the bot via{" "}
            <code className="text-xs">POST /api/guilds/…/install-template</code> (messages, auto-roles, logs, etc. — on the
            server side). If something is missing, check the "Installation result" block below (skipped / warnings).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {installResult && (
            <Card className="border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--muted)/0.2)]">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Installation result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm pt-0">
                {installResult.summary && Object.keys(installResult.summary).length > 0 && (
                  <div>
                    <p className="font-medium">Summary</p>
                    <ul className="list-disc pl-5">
                      {Object.entries(installResult.summary).map(([k, v]) => (
                        <li key={k}>
                          {k}: {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {installResult.warnings && installResult.warnings.length > 0 && (
                  <div>
                    <p className="font-medium">Warnings</p>
                    <ul className="list-disc pl-5">
                      {installResult.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {installResult.skipped && Object.keys(installResult.skipped).length > 0 && (
                  <div>
                    <p className="font-medium">Skipped</p>
                    {Object.entries(installResult.skipped).map(([k, arr]) => (
                      <div key={k}>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{k}</p>
                        <ul className="list-disc pl-5">{arr.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" asChild>
                    <Link to={`/guild/${guildId}`}>Server settings</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/my-servers">My Servers</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {installError && <p className="text-sm text-[hsl(var(--destructive))]">{installError}</p>}
          {loading ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading templates…</p>
          ) : error ? (
            <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No available templates. Purchase one in the store or ask an administrator to grant access.
            </p>
          ) : (
            <ul className="space-y-4">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-[hsl(var(--border))] p-4 bg-[hsl(var(--muted)/0.3)] flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.name}</p>
                    {t.description && (
                      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{t.description}</p>
                    )}
                    {t.discordTemplateUrl && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 break-all">
                        Discord template:{" "}
                        <a
                          href={t.discordTemplateUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[hsl(var(--primary))] hover:underline"
                        >
                          open
                        </a>
                      </p>
                    )}
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">{formatDate(t.createdAt)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {t.discordTemplateUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={t.discordTemplateUrl} target="_blank" rel="noreferrer">
                          Open Discord template
                        </a>
                      </Button>
                    )}
                    <Button size="sm" onClick={() => void handleInstall(t.id)} disabled={!!installingId}>
                      {installingId === t.id ? "Installing…" : "Install on this server"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
