import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Bot, CheckCircle2, ExternalLink, Loader2, PartyPopper, RefreshCw, Sparkles } from "lucide-react"
import {
  ApiError,
  getPurchaseInstall,
  startPurchaseInstall,
  triggerPurchaseInstall,
  type PendingInstallInfo,
} from "@/lib/api"
import { cn } from "@/lib/utils"

/** Deploy stage order for the progress bar (TZ-2 §2 step 4). */
const STAGES: { code: string; label: string }[] = [
  { code: "preparing", label: "Preparing" },
  { code: "roles", label: "Setting permissions" },
  { code: "channels", label: "Creating channels" },
  { code: "messages", label: "Posting messages" },
  { code: "emojis", label: "Uploading emojis" },
  { code: "features", label: "Configuring bot features" },
  { code: "finishing", label: "Finishing up" },
]

/**
 * Install Flow for a purchased server (TZ-2 v2): /install/[purchase_id].
 * Step 1 — create a new server from the product's Discord template;
 * Step 2 — add the bot to it; Step 3 — autodetect (guildCreate) or the manual
 * trigger starts the deploy; Step 4 — live progress, then "server ready".
 * The deploy runs server-side: closing this tab doesn't stop it.
 */
export function PurchaseInstallPage() {
  const { purchaseId } = useParams<{ purchaseId: string }>()
  const navigate = useNavigate()
  const [info, setInfo] = useState<PendingInstallInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const begin = useCallback(async () => {
    if (!purchaseId) return
    setStarting(true)
    setError(null)
    try {
      const p = await startPurchaseInstall(purchaseId)
      setInfo(p)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      setError(e instanceof Error ? e.message : "Failed to start installation")
    } finally {
      setStarting(false)
    }
  }, [purchaseId, navigate])

  useEffect(() => {
    void begin()
  }, [begin])

  // Poll while the install is live — autodetect can flip the state at any time.
  useEffect(() => {
    if (!info || info.status === "completed" || info.status === "failed") {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      return
    }
    if (pollRef.current) return
    pollRef.current = setInterval(() => {
      getPurchaseInstall(info.id)
        .then(setInfo)
        .catch(() => null)
    }, 2500)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [info])

  async function manualTrigger() {
    if (!info || triggering) return
    setTriggering(true)
    setError(null)
    try {
      setInfo(await triggerPurchaseInstall(info.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trigger failed")
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b14] text-white">
      <div className="mx-auto max-w-2xl px-5 py-10 space-y-8">
        <Link to="/my-purchases" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to My Purchases
        </Link>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-violet-400" />
            {info?.productName ? `Install "${info.productName}"` : "Install your server"}
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Your purchase installs onto a brand-new server. Three quick steps — the bot does the rest.
          </p>
        </div>

        {starting && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-white/40" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!starting && info && (
          <>
            {info.status === "waiting_server" && (
              <div className="space-y-4">
                {/* Step 1 */}
                <StepCard n={1} title="Create your new server" active>
                  <p className="text-sm text-white/60 mb-4">
                    Open the server template — Discord will create a new server with all the channels
                    and roles. You only type a name.
                  </p>
                  {info.discordTemplateUrl ? (
                    <a
                      href={info.discordTemplateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-sm font-medium"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Create Server
                    </a>
                  ) : (
                    <p className="text-sm text-amber-300">
                      This product has no Discord template link yet — contact support.
                    </p>
                  )}
                </StepCard>

                {/* Step 2 */}
                <StepCard n={2} title="Add Level Up to your new server" active>
                  <p className="text-sm text-white/60 mb-4">
                    Select the server you just created and press Authorize.
                  </p>
                  {info.botInviteUrl && (
                    <a
                      href={info.botInviteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-violet-500/50 bg-violet-500/10 hover:bg-violet-500/20 px-5 py-2.5 text-sm font-medium"
                    >
                      <Bot className="h-4 w-4" />
                      Add Level Up to your new server
                    </a>
                  )}
                  <p className="text-xs text-white/40 mt-2">Select the server you just created.</p>
                </StepCard>

                {/* Step 3 */}
                <StepCard n={3} title="Installation starts automatically" active>
                  <p className="text-sm text-white/60 mb-4">
                    As soon as the bot lands on your new server, we detect it and start setting
                    everything up. If nothing happens within a minute:
                  </p>
                  <button
                    type="button"
                    onClick={() => void manualTrigger()}
                    disabled={triggering}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm hover:bg-white/5 disabled:opacity-50"
                  >
                    {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    I've added the bot — start installation
                  </button>
                </StepCard>
              </div>
            )}

            {info.status === "deploying" && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
                <p className="font-medium flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                  Setting up {info.guildName ?? "your server"}…
                </p>
                <DeployProgress current={info.progress} />
                <p className="text-xs text-white/40">
                  You can close this tab — installation continues in the background and the status
                  stays visible in My Purchases.
                </p>
              </div>
            )}

            {info.status === "completed" && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-8 text-center space-y-4">
                <PartyPopper className="h-10 w-10 text-emerald-400 mx-auto" />
                <h2 className="text-xl font-semibold">🎉 Your server is ready!</h2>
                <p className="text-sm text-white/60">
                  {info.guildName ?? "Your new server"} is fully set up.
                </p>
                {info.guildId && (
                  <a
                    href={`https://discord.com/channels/${info.guildId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Discord
                  </a>
                )}
              </div>
            )}

            {info.status === "failed" && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-6 space-y-4">
                <p className="font-medium text-red-300">Installation failed</p>
                {info.error && <p className="text-sm text-white/60">{info.error}</p>}
                <p className="text-sm text-white/50">
                  No worries — attempts are unlimited. Press the button to start over.
                </p>
                <button
                  type="button"
                  onClick={() => void begin()}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-sm font-medium"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StepCard({
  n,
  title,
  active,
  children,
}: {
  n: number
  title: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        active ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-white/[0.01] opacity-60",
      )}
    >
      <p className="mb-3 flex items-center gap-3 font-medium">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-violet-600/30 text-sm text-violet-300">
          {n}
        </span>
        {title}
      </p>
      {children}
    </div>
  )
}

function DeployProgress({ current }: { current: string | null }) {
  const idx = Math.max(
    0,
    STAGES.findIndex((s) => s.code === (current ?? "preparing")),
  )
  return (
    <div className="space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-700"
          style={{ width: `${Math.round(((idx + 1) / STAGES.length) * 100)}%` }}
        />
      </div>
      <div className="space-y-1">
        {STAGES.map((s, i) => (
          <p
            key={s.code}
            className={cn(
              "flex items-center gap-2 text-sm",
              i < idx ? "text-emerald-400" : i === idx ? "text-white" : "text-white/30",
            )}
          >
            {i < idx ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : i === idx ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span className="inline-block h-3.5 w-3.5 rounded-full border border-white/20" />
            )}
            {s.label}
          </p>
        ))}
      </div>
    </div>
  )
}
