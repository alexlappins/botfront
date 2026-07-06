import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AdminHeader } from "@/components/admin-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Search, Gem, XCircle } from "lucide-react"
import {
  ApiError,
  adminCancelSubscription,
  adminGrantSubscription,
  adminListSubscriptions,
  adminSearchGuilds,
  adminSearchUserGuilds,
  adminSubscriptionHistory,
  type AdminGuildHit,
  type AdminSubscriptionAuditRow,
  type AdminSubscriptionRow,
} from "@/lib/api"
import { cn } from "@/lib/utils"

const DURATION_PRESETS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "180 days" },
  { days: 365, label: "365 days" },
] as const

/**
 * Owner admin — Manage Subscriptions (Misha's TZ §15).
 * Per-server grants (§15.1): search by user or by guild, grant for a fixed
 * term with a reason, cancel immediately (Stripe subs are cancelled via the
 * Stripe API too), full audit history.
 */
export function AdminSubscriptionsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<"manage" | "history">("manage")

  function onApiError(e: unknown): string {
    if (e instanceof ApiError && e.status === 401) {
      navigate("/login", { replace: true })
      return ""
    }
    if (e instanceof ApiError && e.status === 403) return "No access"
    return e instanceof Error ? e.message : "Error"
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <AdminHeader title="Manage Subscriptions" />
      <main className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex gap-2">
          {(
            [
              { v: "manage" as const, label: "Subscriptions" },
              { v: "history" as const, label: "History" },
            ]
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setTab(o.v)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === o.v
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {tab === "manage" ? <ManageTab onApiError={onApiError} /> : <HistoryTab onApiError={onApiError} />}
      </main>
    </div>
  )
}

function ManageTab({ onApiError }: { onApiError: (e: unknown) => string }) {
  const [mode, setMode] = useState<"user" | "guild">("user")
  const [q, setQ] = useState("")
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<AdminGuildHit[] | null>(null)
  const [selected, setSelected] = useState<AdminGuildHit | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [subs, setSubs] = useState<AdminSubscriptionRow[]>([])
  const [subsLoading, setSubsLoading] = useState(true)

  async function loadSubs() {
    setSubsLoading(true)
    try {
      setSubs(await adminListSubscriptions())
    } catch (e) {
      setError(onApiError(e))
    } finally {
      setSubsLoading(false)
    }
  }

  useEffect(() => {
    void loadSubs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function search() {
    if (!q.trim()) return
    setSearching(true)
    setError(null)
    setSelected(null)
    try {
      const res = mode === "user" ? await adminSearchUserGuilds(q.trim()) : await adminSearchGuilds(q.trim())
      setHits(res)
    } catch (e) {
      setError(onApiError(e))
      setHits(null)
    } finally {
      setSearching(false)
    }
  }

  const subByGuild = new Map(subs.map((s) => [s.guildId, s]))

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Find a server</CardTitle>
          <CardDescription>
            Subscriptions are per-server. To gift premium to a person with several servers, grant it
            to each of their servers separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(
              [
                { v: "user" as const, label: "By user (ID / username)" },
                { v: "guild" as const, label: "By server (ID / name)" },
              ]
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setMode(o.v)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  mode === o.v
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.15)] text-white"
                    : "border-white/10 text-white/60 hover:bg-white/[0.04]",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void search()}
              placeholder={mode === "user" ? "Discord user ID or username" : "Guild ID or server name"}
            />
            <Button onClick={() => void search()} disabled={searching || !q.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {hits && hits.length === 0 && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {mode === "user"
                ? "No servers found where this user is owner/admin and the bot is installed."
                : "No matching servers with the bot installed."}
            </p>
          )}

          {hits && hits.length > 0 && (
            <div className="space-y-2">
              {hits.map((h) => {
                const sub = subByGuild.get(h.guildId)
                return (
                  <button
                    key={h.guildId}
                    type="button"
                    onClick={() => setSelected(h)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors",
                      selected?.guildId === h.guildId
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]"
                        : "border-white/10 hover:bg-white/[0.04]",
                    )}
                  >
                    {h.iconUrl ? (
                      <img src={h.iconUrl} alt="" className="h-8 w-8 rounded-full" />
                    ) : (
                      <span className="h-8 w-8 rounded-full bg-white/10 grid place-items-center text-xs">
                        {h.name[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-white truncate">{h.name}</span>
                      <span className="block text-xs text-white/40">
                        {h.guildId}
                        {h.userRole ? ` · user is ${h.userRole}` : ""}
                        {h.memberCount != null ? ` · ${h.memberCount} members` : ""}
                      </span>
                    </span>
                    <span className="ml-auto text-xs shrink-0">
                      {sub?.active ? (
                        <span className="text-amber-300">
                          {sub.source === "stripe" ? "💳 Stripe" : "🎁 Manual"}
                        </span>
                      ) : (
                        <span className="text-white/40">Free</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
        </CardContent>
      </Card>

      {selected && (
        <GrantPanel
          hit={selected}
          sub={subByGuild.get(selected.guildId) ?? null}
          onApiError={onApiError}
          onChanged={() => void loadSubs()}
        />
      )}

      {/* All subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>All subscriptions</CardTitle>
          <CardDescription>💳 paid via Stripe · 🎁 granted manually</CardDescription>
        </CardHeader>
        <CardContent>
          {subsLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          ) : subs.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No subscriptions yet.</p>
          ) : (
            <div className="space-y-2">
              {subs.map((s) => (
                <div
                  key={s.guildId}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/10 text-sm"
                >
                  <span>{s.source === "stripe" ? "💳" : "🎁"}</span>
                  <span className="font-medium text-white truncate">
                    {s.guildName ?? s.guildId}
                    {!s.botOnGuild && <span className="text-white/40 text-xs"> (bot removed)</span>}
                  </span>
                  <span className="ml-auto text-xs text-white/50 shrink-0">
                    {s.active ? (
                      <span className="text-emerald-400">
                        active{s.until ? ` until ${new Date(s.until).toLocaleDateString()}` : " (open-ended)"}
                      </span>
                    ) : (
                      "inactive"
                    )}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-white/40 hover:text-white shrink-0"
                    onClick={() =>
                      setSelected({
                        guildId: s.guildId,
                        name: s.guildName ?? s.guildId,
                        iconUrl: null,
                        memberCount: null,
                      })
                    }
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function GrantPanel({
  hit,
  sub,
  onApiError,
  onChanged,
}: {
  hit: AdminGuildHit
  sub: AdminSubscriptionRow | null
  onApiError: (e: unknown) => string
  onChanged: () => void
}) {
  const [days, setDays] = useState<number>(30)
  const [customDays, setCustomDays] = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const effectiveDays = useCustom ? parseInt(customDays, 10) || 0 : days

  async function grant() {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await adminGrantSubscription({ guildId: hit.guildId, days: effectiveDays, reason: reason.trim() || undefined })
      setMsg(`Premium activated for ${effectiveDays} days.`)
      onChanged()
    } catch (e) {
      setError(onApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!confirm(`Cancel the subscription for "${hit.name}"? Premium is revoked immediately.`)) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await adminCancelSubscription({ guildId: hit.guildId, reason: reason.trim() || undefined })
      setMsg("Subscription cancelled. Configs are preserved and will reactivate on a new subscription.")
      onChanged()
    } catch (e) {
      setError(onApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gem className="h-4 w-4 text-amber-400" />
          {hit.name}
        </CardTitle>
        <CardDescription>
          {sub?.active
            ? `Active ${sub.source === "stripe" ? "💳 Stripe" : "🎁 manual"} subscription${
                sub.until ? ` until ${new Date(sub.until).toLocaleString()}` : " (open-ended)"
              }`
            : "No active subscription"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Duration</Label>
          <div className="flex gap-2 flex-wrap">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => {
                  setUseCustom(false)
                  setDays(p.days)
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  !useCustom && days === p.days
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.15)] text-white"
                    : "border-white/10 text-white/60 hover:bg-white/[0.04]",
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUseCustom(true)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                useCustom
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.15)] text-white"
                  : "border-white/10 text-white/60 hover:bg-white/[0.04]",
              )}
            >
              Custom
            </button>
            {useCustom && (
              <Input
                type="number"
                min={1}
                max={3650}
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                placeholder="days"
                className="w-24 h-8"
              />
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Reason (optional)</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='e.g. "Giveaway winner gift", "Downtime compensation"'
          />
        </div>

        {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
        {msg && <p className="text-sm text-emerald-400">{msg}</p>}

        <div className="flex gap-2">
          <Button onClick={() => void grant()} disabled={busy || effectiveDays < 1}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Gem className="h-4 w-4 mr-1" />}
            Activate Premium
          </Button>
          {sub?.active && (
            <Button
              variant="outline"
              onClick={() => void cancel()}
              disabled={busy}
              className="text-[hsl(var(--destructive))]"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancel Subscription
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function HistoryTab({ onApiError }: { onApiError: (e: unknown) => string }) {
  const [rows, setRows] = useState<AdminSubscriptionAuditRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminSubscriptionHistory()
      .then(setRows)
      .catch((e) => setError(onApiError(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-white/40" />

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operation history</CardTitle>
        <CardDescription>Every manual grant/cancel — who, whom, term, reason.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No operations yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="px-3 py-2 rounded-lg border border-white/10 text-sm space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={r.action === "grant" ? "text-emerald-400" : "text-red-400"}>
                    {r.action === "grant" ? "▲ Grant" : "■ Cancel"}
                  </span>
                  <span className="font-medium text-white truncate">{r.guildName ?? r.guildId}</span>
                  {r.source && <span className="text-xs">{r.source === "stripe" ? "💳" : "🎁"}</span>}
                  <span className="ml-auto text-xs text-white/40 shrink-0">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-white/50">
                  by {r.adminName ?? r.adminId}
                  {r.durationDays ? ` · ${r.durationDays} days` : ""}
                  {r.reason ? ` · ${r.reason}` : ""}
                  {` · guild ${r.guildId}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
