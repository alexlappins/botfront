import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  AlertTriangle,
  Ban,
  Bell,
  Check,
  Crown,
  Link2,
  LogOut,
  Rocket,
  Shield,
  ShieldAlert,
  Smile,
  Sparkles,
  Star,
  UserPlus,
  X,
  Zap,
} from "lucide-react"
import {
  ApiError,
  getGuildLive,
  getGuildOverview,
  setPanicMode,
  setupQuarantine,
  type GuildOverview,
  type OverviewEvent,
} from "@/lib/api"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { usePremiumModal } from "@/components/premium"
import { cn } from "@/lib/utils"

const OVERVIEW_POLL_MS = 30_000
const LIVE_POLL_MS = 10_000

/** 1000+ → 1K / 2.5K / 10K, below that as-is. */
function fmtRank(n: number): string {
  if (n < 1000) return String(n)
  const k = n / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US")
}

/** Minimal formatDistanceToNow — not worth a date-fns dependency for one string. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/**
 * Server dashboard Overview. Desktop (1280+) fits without page scroll: hero /
 * milestones / security row are fixed-height, the three-column grid takes the
 * rest. Tablet collapses to 2 columns, mobile to a single stack.
 *
 * Data: one /overview payload polled every 30s plus a tiny /live poll every
 * 10s. Both sit behind loadOverview/loadLive, so switching to SSE later only
 * touches those two functions.
 */
export function DashboardOverviewPage() {
  const guildId = useCurrentGuildId()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [data, setData] = useState<GuildOverview | null>(null)
  const [live, setLive] = useState<{ online: number; voice: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<"month" | "all">(
    () => (localStorage.getItem("overview.period") as "month" | "all") ?? "month",
  )
  const firstLoad = useRef(true)

  const loadOverview = useCallback(async () => {
    if (!guildId) return
    try {
      setData(await getGuildOverview(guildId, period))
      setError(null)
    } catch (e) {
      // Only a failed FIRST load blanks the page; poll failures keep old data.
      if (firstLoad.current) setError(e instanceof ApiError ? e.message : "load")
    } finally {
      firstLoad.current = false
    }
  }, [guildId, period])

  const loadLive = useCallback(async () => {
    if (!guildId) return
    await getGuildLive(guildId).then(setLive).catch(() => null)
  }, [guildId])

  useEffect(() => {
    firstLoad.current = true
    setData(null)
    void loadOverview()
    const timer = setInterval(() => void loadOverview(), OVERVIEW_POLL_MS)
    return () => clearInterval(timer)
  }, [loadOverview])

  useEffect(() => {
    void loadLive()
    const timer = setInterval(() => void loadLive(), LIVE_POLL_MS)
    return () => clearInterval(timer)
  }, [loadLive])

  function switchPeriod(next: "month" | "all") {
    localStorage.setItem("overview.period", next)
    setPeriod(next)
  }

  if (!guildId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <p className="text-white/60">{t("common.selectServer")}</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="grid h-full place-items-center">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-5 text-center">
          <p className="text-sm text-red-300">{t("overview.loadError")}</p>
          <button
            type="button"
            onClick={() => {
              firstLoad.current = true
              void loadOverview()
            }}
            className="mt-3 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
          >
            {t("overview.retry")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <OverviewStyles />
      {!data ? (
        <OverviewSkeleton />
      ) : (
        <>
          <ServerHero data={data} live={live} />
          <MilestoneStrip data={data} />
          <SecurityRow data={data} guildId={guildId} onNavigate={(tab) => navigate(`/security?tab=${tab}`)} />
          <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <InvitesCard data={data} />
            <div className="flex min-h-0 flex-col gap-3">
              <EmojisCard data={data} />
              <MembersCard data={data} period={period} onPeriod={switchPeriod} />
            </div>
            <EventsCard data={data} />
          </div>
        </>
      )}
    </div>
  )
}

// ── Shared shell ──────────────────────────────────────────

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("ov-panel rounded-2xl border border-white/10 bg-white/[0.03] p-4", className)}>
      {children}
    </section>
  )
}

function PanelHead({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{title}</p>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  )
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center px-2 py-6 text-center">
      <div>
        <p className="text-xs text-white/40">{text}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  )
}

/** Premium-gated figure: blurred with a PRO chip, click opens the upsell. */
function ProLock({ children }: { children: React.ReactNode }) {
  const openPremium = usePremiumModal()
  return (
    <button type="button" onClick={openPremium} className="relative block w-full text-left">
      <div className="pointer-events-none select-none opacity-60 blur-[3px]">{children}</div>
      <span className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
        PRO
      </span>
    </button>
  )
}

// ── §1 Server hero ────────────────────────────────────────

function ServerHero({
  data,
  live,
}: {
  data: GuildOverview
  live: { online: number; voice: number } | null
}) {
  const { t } = useTranslation()
  const s = data.server
  const online = live?.online ?? s.online
  const voice = live?.voice ?? s.voice

  const metrics = [
    {
      value: fmtNum(s.members),
      label: t("overview.hero.members"),
      sub: s.joinedToday > 0 ? `+${s.joinedToday} ${t("overview.hero.today")}` : "—",
      subClass: "text-cyan-300",
    },
    {
      value: fmtNum(online),
      label: t("overview.hero.online"),
      sub: `${voice} ${t("overview.hero.inVoice")}`,
      dot: true,
    },
    {
      value: fmtNum(s.messages7d),
      label: t("overview.hero.messages"),
      sub:
        s.messagesTrendPercent === null
          ? "—"
          : `${s.messagesTrendPercent >= 0 ? "↑" : "↓"} ${Math.abs(s.messagesTrendPercent)}%`,
      subClass:
        s.messagesTrendPercent === null
          ? undefined
          : s.messagesTrendPercent >= 0
            ? "text-emerald-400"
            : "text-red-400",
    },
    {
      value: `${s.ageYears}y ${s.ageMonths}m`,
      label: t("overview.hero.age"),
      sub: `${t("overview.hero.since")} ${new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}`,
    },
  ]

  return (
    <Panel className="ov-hero shrink-0 p-5">
      <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
        <div className="ov-logo grid h-16 w-16 shrink-0 place-items-center rounded-2xl md:h-24 md:w-24">
          {s.iconUrl ? (
            <img src={s.iconUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <span className="text-xl font-bold text-white md:text-2xl">{s.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-white md:text-3xl">{s.name}</h1>
          <p className="mt-0.5 text-xs text-white/45">
            {s.ownerTag ? `${t("overview.hero.communityFor")} @${s.ownerTag} · ` : ""}
            {t("overview.hero.founded")}{" "}
            {new Date(s.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 md:justify-start">
            {s.boostLevel > 0 && (
              <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2.5 py-1 text-[11px] text-fuchsia-200">
                <Rocket className="mr-1 inline h-3 w-3" />
                {t("overview.hero.boostLevel", { level: s.boostLevel })}
              </span>
            )}
            {s.partnered && (
              <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-[11px] text-violet-200">
                {t("overview.hero.partnered")}
              </span>
            )}
            {s.verified && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-300">
                <Check className="mr-1 inline h-3 w-3" />
                {t("overview.hero.verified")}
              </span>
            )}
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-4 md:w-auto md:grid-cols-4 md:gap-6">
          {metrics.map((m) => (
            <div key={m.label} className="text-center md:text-right">
              <p className="ov-metric flex items-center justify-center gap-1.5 text-[26px] font-bold leading-none text-white md:justify-end">
                {m.dot && <span className="ov-dot h-2 w-2 rounded-full bg-emerald-400" />}
                {m.value}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-white/40">{m.label}</p>
              <p className={cn("text-[10px]", m.subClass ?? "text-white/35")}>{m.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

// ── §2 Milestones ─────────────────────────────────────────

function MilestoneStrip({ data }: { data: GuildOverview }) {
  const { t } = useTranslation()
  const m = data.milestone
  const reached = m.submilestones.filter((v) => v <= m.members).length
  const activeIdx = m.submilestones.findIndex((v) => v > m.members)

  return (
    <Panel className="shrink-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Star className="h-4 w-4 text-amber-400" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
          {t("overview.milestone.title")}
        </p>
        <span className="text-[11px] text-violet-300">
          · {t("overview.milestone.rankOf", { index: m.rankIndex, total: m.ranksTotal })}
        </span>
        <div className="ov-scroll-x ml-auto flex max-w-full gap-1 overflow-x-auto">
          {m.ranks.map((r) => {
            const done = r <= m.members
            const current = r === m.currentRank
            return (
              <span
                key={r}
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]",
                  current
                    ? "border border-amber-400/40 bg-gradient-to-r from-amber-400/25 to-amber-500/15 text-amber-200"
                    : done
                      ? "bg-violet-500/15 text-violet-300"
                      : "border border-white/10 text-white/30",
                )}
              >
                {current ? "⚡ " : done ? "" : "🔒 "}
                {fmtRank(r)}
              </span>
            )
          })}
        </div>
      </div>

      <div className="ov-scroll-x overflow-x-auto pb-1">
        <div className="grid min-w-[520px] grid-cols-11 gap-1">
          {m.submilestones.map((v, i) => {
            const done = v <= m.members
            const isActive = i === activeIdx
            const isFinal = i === 10
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "grid place-items-center rounded-full",
                    isActive ? "ov-pulse h-7 w-7 border-2 border-violet-400" : "h-6 w-6",
                    done && !isActive ? "bg-violet-500" : "",
                    !done && !isActive && !isFinal ? "border border-white/10" : "",
                    isFinal && !done ? "border-2 border-dashed border-amber-400/60" : "",
                  )}
                >
                  {done && !isActive && <Check className="h-3.5 w-3.5 text-white" />}
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />}
                  {isFinal && !done && !isActive && <Zap className="h-3 w-3 text-amber-400" />}
                </span>
                <span className="font-mono text-[9px] text-white/35">{fmtRank(v)}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-2 h-0.5 min-w-[520px] rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-700"
            style={{ width: `${(reached / 10) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1 border-t border-white/5 pt-2 text-[11px] text-white/45 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {t("overview.milestone.progress")}: {fmtRank(m.previousRank)} →{" "}
          <span className="text-amber-300">{fmtRank(m.currentRank)}</span>
        </span>
        <span>
          {fmtNum(m.members)} / {fmtNum(m.currentRank)} · {m.progressPercent}% {t("overview.milestone.ofRank")}
        </span>
        <span>
          {fmtNum(m.remaining)} {t("overview.milestone.more")}
          {data.premium && m.estDays !== null ? ` · ${t("overview.milestone.est", { days: m.estDays })}` : ""}
        </span>
      </div>
    </Panel>
  )
}

// ── §3 Security + Emergency ───────────────────────────────

function SecurityRow({
  data,
  guildId,
  onNavigate,
}: {
  data: GuildOverview
  guildId: string
  onNavigate: (tab: string) => void
}) {
  const { t } = useTranslation()
  const [showIssues, setShowIssues] = useState(false)
  const [confirm, setConfirm] = useState<null | "panic" | "quarantine">(null)
  const [busy, setBusy] = useState(false)
  const [panicActive, setPanicActive] = useState(false)
  const score = data.security.score
  const ring = score <= 40 ? "#ef4444" : score <= 70 ? "#fbbf24" : "#7c83f7"
  const failed = data.security.checks.filter((c) => !c.ok)

  async function act() {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm === "panic") {
        const res = await setPanicMode(guildId, !panicActive)
        setPanicActive(res.active)
      } else {
        await setupQuarantine(guildId).catch(() => null)
        onNavigate("quarantine")
      }
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid shrink-0 gap-3 lg:grid-cols-[3fr_2fr]">
      <Panel>
        <PanelHead
          icon={<Shield className="h-4 w-4 text-cyan-300" />}
          title={t("overview.security.title")}
          right={
            failed.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowIssues((v) => !v)}
                className="text-[11px] text-white/45 hover:text-white"
              >
                {t("overview.security.fix")} →
              </button>
            ) : null
          }
        />
        <div className="flex items-center gap-4">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke={ring}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 97.4} 97.4`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="text-center leading-none">
              <p className="text-xl font-bold text-white">{score}</p>
              <p className="text-[8px] text-white/35">/ 100</p>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-5">
            {data.security.checks.map((c) => (
              <button key={c.key} type="button" onClick={() => onNavigate(c.tab)} className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-lg",
                    c.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
                  )}
                >
                  {c.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </span>
                <span className="text-center text-[9px] leading-tight text-white/40">
                  {t(`overview.security.checks.${c.key}`)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {showIssues && failed.length > 0 && (
          <div className="ov-fade mt-3 space-y-1 border-t border-white/5 pt-2">
            {failed.map((c) => (
              <div key={c.key} className="flex items-center gap-2 text-[11px]">
                <span className="text-red-400">✕</span>
                <span className="text-white/60">{t(`overview.security.checks.${c.key}`)}</span>
                <button
                  type="button"
                  onClick={() => onNavigate(c.tab)}
                  className="ml-auto rounded border border-white/15 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/5"
                >
                  {t("overview.security.goFix")}
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHead icon={<ShieldAlert className="h-4 w-4 text-red-400" />} title={t("overview.emergency.title")} />
        <button
          type="button"
          onClick={() => setConfirm("panic")}
          className={cn(
            "ov-panic flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white",
            panicActive
              ? "bg-gradient-to-r from-emerald-600 to-emerald-500"
              : "bg-gradient-to-r from-red-600 to-red-500",
          )}
        >
          <Shield className="h-4 w-4" />
          {panicActive ? t("overview.emergency.deactivate") : t("overview.emergency.activate")}
        </button>
        <button
          type="button"
          onClick={() => setConfirm("quarantine")}
          className="mt-2 w-full rounded-xl border border-amber-400/40 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/10"
        >
          {t("overview.emergency.quarantine")}
        </button>
        <p className="mt-2 text-[10px] leading-relaxed text-white/35">{t("security.mod.panic")}</p>

        {confirm && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e0e18] p-5">
              <p className="text-base font-semibold text-white">
                {confirm === "panic"
                  ? panicActive
                    ? t("overview.emergency.confirmPanicOff")
                    : t("overview.emergency.confirmPanicOn")
                  : t("overview.emergency.confirmQuarantine")}
              </p>
              <p className="mt-1 text-xs text-white/45">
                {confirm === "panic" ? t("security.mod.panic") : t("security.mod.quarantine")}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
                >
                  {t("overview.emergency.cancel")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {t("overview.emergency.confirm")}
                </button>
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}

// ── §4.1 Invites ──────────────────────────────────────────

function InvitesCard({ data }: { data: GuildOverview }) {
  const { t } = useTranslation()
  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PanelHead
        icon={<Link2 className="h-4 w-4 text-cyan-300" />}
        title={t("overview.invites.title")}
        right={<span className="text-[10px] text-white/30">top 5</span>}
      />
      {data.invites.length === 0 ? (
        <Empty text={t("overview.invites.empty")} />
      ) : (
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto">
          {data.invites.map((inv) => (
            <div key={inv.code}>
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-violet-300">
                  {inv.code}
                </span>
                <span className="truncate text-[11px] text-white/40">
                  {inv.inviterTag ? `by ${inv.inviterTag}` : "—"}
                </span>
                <span className="ml-auto font-mono text-xs font-bold text-white">{fmtNum(inv.joined)}</span>
              </div>
              {inv.retention === null ? (
                data.premium ? (
                  <p className="mt-1 text-[10px] text-white/25">{t("overview.invites.pending")}</p>
                ) : (
                  <ProLock>
                    <div className="mt-1 h-1 rounded-full bg-white/10">
                      <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
                    </div>
                  </ProLock>
                )
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 flex-1 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                      style={{ width: `${inv.retention}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-white/35">{inv.retention}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 border-t border-white/5 pt-2 text-[10px] text-white/25">{t("overview.invites.legend")}</p>
    </Panel>
  )
}

// ── §4.2.1 Emojis ─────────────────────────────────────────

function EmojisCard({ data }: { data: GuildOverview }) {
  const { t } = useTranslation()
  return (
    <Panel className="shrink-0">
      <PanelHead icon={<Smile className="h-4 w-4 text-cyan-300" />} title={t("overview.emojis.title")} />
      {data.emojis.length === 0 ? (
        <p className="py-3 text-center text-xs text-white/40">{t("overview.emojis.empty")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {data.emojis.map((e) => (
            <div
              key={e.key}
              className={cn(
                "rounded-xl px-2 py-2 text-center",
                e.isCustom
                  ? "border border-violet-500/30 bg-violet-500/[0.06]"
                  : "border border-white/10 bg-black/20",
              )}
            >
              {e.isCustom ? (
                <img
                  src={`https://cdn.discordapp.com/emojis/${e.key}.webp?size=44`}
                  alt={e.name}
                  className="mx-auto h-7 w-7"
                />
              ) : (
                <p className="text-2xl leading-none">{e.display}</p>
              )}
              <p
                className={cn(
                  "mt-1 truncate font-mono text-[9px]",
                  e.isCustom ? "text-violet-300" : "text-white/35",
                )}
              >
                :{e.name}:
              </p>
              <p className="font-mono text-xs font-bold text-white">{fmtNum(e.count)}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

// ── §4.2.2 Top members ────────────────────────────────────

const RANK_STYLES = [
  { border: "#fbbf24", text: "text-amber-300", grad: "from-amber-400 to-amber-600" },
  { border: "#cbd5e1", text: "text-slate-200", grad: "from-slate-300 to-slate-500" },
  { border: "#d97706", text: "text-orange-400", grad: "from-orange-400 to-orange-700" },
]

function MembersCard({
  data,
  period,
  onPeriod,
}: {
  data: GuildOverview
  period: "month" | "all"
  onPeriod: (p: "month" | "all") => void
}) {
  const { t } = useTranslation()
  const openPremium = usePremiumModal()

  return (
    <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PanelHead
        icon={<Star className="h-4 w-4 text-amber-400" />}
        title={t("overview.members.title")}
        right={
          <div className="flex gap-1">
            {(["month", "all"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  if (p === "all" && !data.premium) return openPremium()
                  onPeriod(p)
                }}
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] font-medium",
                  period === p
                    ? "border border-violet-500/50 bg-violet-500/20 text-white"
                    : "border border-white/10 text-white/40 hover:text-white/70",
                )}
              >
                {t(`overview.members.${p}`)}
                {p === "all" && !data.premium ? " 🔒" : ""}
              </button>
            ))}
          </div>
        }
      />
      {data.members.length === 0 ? (
        <Empty text={t("overview.members.empty")} />
      ) : (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {data.members.map((m, i) => {
            const rank = RANK_STYLES[i]
            return (
              <div
                key={m.discordId}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                style={
                  rank
                    ? {
                        borderLeft: `3px solid ${rank.border}`,
                        background: `linear-gradient(90deg, ${rank.border}14, transparent 60%)`,
                      }
                    : undefined
                }
              >
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                    rank ? `bg-gradient-to-br ${rank.grad} text-black` : "border border-white/10 text-white/40",
                  )}
                >
                  {i + 1}
                </span>
                {m.avatarUrl ? (
                  <img
                    src={m.avatarUrl}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full"
                    style={rank ? { boxShadow: `0 0 0 2px ${rank.border}, 0 0 10px ${rank.border}66` } : undefined}
                  />
                ) : (
                  <span className="h-7 w-7 shrink-0 rounded-full bg-white/10" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-xs text-white", i < 3 ? "font-semibold" : "font-medium")}>
                    {m.tag}
                  </p>
                  <p className="text-[9px] text-white/35">
                    {m.badge} · Level {m.level}
                  </p>
                </div>
                <span className={cn("shrink-0 font-mono text-xs", rank ? `${rank.text} font-bold` : "text-white")}>
                  +{fmtNum(m.xp)} XP
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

// ── §4.3 Recent events ────────────────────────────────────

const EVENT_STYLE: Record<string, { cls: string; icon: React.ReactNode }> = {
  member_join: { cls: "bg-emerald-500/15 text-emerald-400", icon: <UserPlus className="h-3.5 w-3.5" /> },
  member_leave: { cls: "bg-white/10 text-white/50", icon: <LogOut className="h-3.5 w-3.5" /> },
  member_kick: { cls: "bg-red-500/15 text-red-400", icon: <LogOut className="h-3.5 w-3.5" /> },
  ban_add: { cls: "bg-red-500/15 text-red-400", icon: <Ban className="h-3.5 w-3.5" /> },
  timeout: { cls: "bg-amber-500/15 text-amber-400", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  timeout_remove: { cls: "bg-emerald-500/15 text-emerald-400", icon: <Check className="h-3.5 w-3.5" /> },
  message_delete: { cls: "bg-cyan-500/15 text-cyan-300", icon: <Zap className="h-3.5 w-3.5" /> },
  level_up: { cls: "bg-violet-500/15 text-violet-300", icon: <Sparkles className="h-3.5 w-3.5" /> },
  boost: { cls: "bg-fuchsia-500/15 text-fuchsia-300", icon: <Crown className="h-3.5 w-3.5" /> },
}

function EventsCard({ data }: { data: GuildOverview }) {
  const { t } = useTranslation()

  function label(e: OverviewEvent): string {
    const p = (e.payload ?? {}) as Record<string, string>
    const who = p.userTag ?? p.authorTag ?? "someone"
    const by = p.executorTag ?? "—"
    switch (e.kind) {
      case "member_join":
        return t("overview.events.join", { user: who })
      case "member_leave":
        return t("overview.events.leave", { user: who })
      case "member_kick":
        return t("overview.events.kick", { user: who, by })
      case "ban_add":
        return t("overview.events.ban", { user: who, by })
      case "timeout":
        return t("overview.events.timeout", { user: who })
      default:
        return t("overview.events.generic", { kind: e.kind.replace(/_/g, " ") })
    }
  }

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PanelHead icon={<Bell className="h-4 w-4 text-violet-300" />} title={t("overview.events.title")} />
      {data.events.length === 0 ? (
        <Empty text={t("overview.events.empty")} />
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {data.events.map((e) => {
            const style = EVENT_STYLE[e.kind] ?? EVENT_STYLE.message_delete
            return (
              <div key={e.id} className="flex items-start gap-2">
                <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg", style.cls)}>
                  {style.icon}
                </span>
                <p className="min-w-0 flex-1 text-[11px] leading-snug text-white/70">{label(e)}</p>
                <span className="shrink-0 text-[10px] text-white/30">{timeAgo(e.createdAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

// ── Skeletons + styles ────────────────────────────────────

function OverviewSkeleton() {
  const bar = "animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
  return (
    <>
      <div className={cn(bar, "h-[130px] shrink-0")} />
      <div className={cn(bar, "h-[120px] shrink-0")} />
      <div className="grid shrink-0 gap-3 lg:grid-cols-[3fr_2fr]">
        <div className={cn(bar, "h-[130px]")} />
        <div className={cn(bar, "h-[130px]")} />
      </div>
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className={cn(bar, "min-h-[160px]")} />
        <div className={cn(bar, "min-h-[160px]")} />
        <div className={cn(bar, "min-h-[160px]")} />
      </div>
    </>
  )
}

function OverviewStyles() {
  return (
    <style>{`
      .ov-hero {
        background:
          radial-gradient(600px 200px at 10% 0%, rgba(124,131,247,.08), transparent 70%),
          radial-gradient(500px 200px at 90% 100%, rgba(34,211,238,.07), transparent 70%),
          rgba(255,255,255,.03);
      }
      .ov-logo {
        background: linear-gradient(135deg, rgba(124,131,247,.9), rgba(34,211,238,.75));
        box-shadow: inset 0 0 12px rgba(124,131,247,.6), 0 0 22px rgba(34,211,238,.28);
        border: 2px solid rgba(255,255,255,.14);
      }
      .ov-dot { box-shadow: 0 0 8px rgba(52,211,153,.9); }
      .ov-panel { transition: border-color .2s ease, box-shadow .2s ease; }
      .ov-panel:hover { border-color: rgba(124,131,247,.28); box-shadow: 0 6px 22px rgba(124,131,247,.10); }
      .ov-metric { transition: opacity .25s ease; }
      .ov-scroll-x { scrollbar-width: thin; }
      .ov-scroll-x::-webkit-scrollbar { height: 4px; }
      .ov-scroll-x::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 4px; }
      .ov-fade { animation: ovFade .25s ease; }
      @keyframes ovFade { from { opacity: 0; transform: translateY(-3px);} to { opacity: 1; transform: none;} }
      @keyframes ovPulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(124,131,247,.5); transform: scale(1); }
        50% { box-shadow: 0 0 0 7px rgba(124,131,247,0); transform: scale(1.08); }
      }
      .ov-pulse { animation: ovPulse 2.2s ease-in-out infinite; }
      .ov-panic { box-shadow: 0 8px 26px rgba(239,68,68,.32); }
      /* Mobile: nothing hover-only, and tap targets stay ≥44px. */
      @media (pointer: coarse) {
        .ov-panel button, .ov-panel a { min-height: 44px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ov-pulse, .ov-fade, .animate-pulse { animation: none !important; }
        .ov-panel, .ov-metric { transition: none !important; }
      }
    `}</style>
  )
}
