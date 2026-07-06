import { useEffect, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import {
  ApiError,
  getChannels,
  getLogs,
  updateLogsChannel,
  type Channel,
  type GuildLogs,
  type LogsType,
} from "@/lib/api"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, ScrollText } from "lucide-react"

const LOG_TYPES: LogsType[] = ["joinLeave", "messages", "moderation", "channel", "banKick"]

/**
 * User Admin Panel: log channel configuration only (no Event Feed — was removed per spec).
 * Loads channels & current log mapping for the active guild.
 */
export function ServerLogsPage() {
  const guildId = useCurrentGuildId()
  const { t } = useTranslation()
  const [channels, setChannels] = useState<Channel[]>([])
  const [logs, setLogs] = useState<GuildLogs>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [savingType, setSavingType] = useState<LogsType | null>(null)

  useEffect(() => {
    if (!guildId) return
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([getChannels(guildId), getLogs(guildId)])
      .then(([c, l]) => {
        if (!alive) return
        setChannels(c)
        setLogs(l)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setError(t("common.noAccess"))
        } else {
          setError(e instanceof Error ? e.message : t("serverLogs.loadingError"))
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [guildId])

  async function handleChange(type: LogsType, channelId: string | null) {
    if (!guildId) return
    setSavingType(type)
    try {
      const next = await updateLogsChannel(guildId, { type, channelId })
      setLogs(next)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("serverLogs.saveError"))
    } finally {
      setSavingType(null)
    }
  }

  if (!guildId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <p className="text-white/60">{t("common.selectServer")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ScrollText className="h-7 w-7 text-violet-400" />
          {t("serverLogs.title")}
        </h1>
        <p className="text-sm text-white/50 mt-1">
          {/* Inline <code> stays in JSX, the Trans replaces the slot. */}
          <Trans
            i18nKey="serverLogs.sub"
            components={{ code: <code className="text-violet-300" /> }}
          />
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="rounded-2xl bg-[#11111c] border border-white/5 p-5 space-y-3">
          {savedAt != null && (
            <div className="text-xs text-emerald-400">{t("common.saved")}</div>
          )}
          {LOG_TYPES.map((type) => {
            const currentId = logs[type] ?? null
            const ch = channels.find((c) => c.id === currentId)
            return (
              <div key={type} className="flex flex-wrap items-center gap-3">
                <span className="w-32 shrink-0 text-sm font-medium text-white/80">
                  {t(`serverLogs.types.${type}`)}
                </span>
                <Select
                  value={currentId ?? "none"}
                  disabled={savingType === type}
                  onValueChange={(val) => handleChange(type, val === "none" ? null : val)}
                >
                  <SelectTrigger className="min-w-[260px] w-auto rounded-lg bg-white/[0.04] border-white/10">
                    <SelectValue placeholder={t("serverLogs.disable")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("serverLogs.disable")}</SelectItem>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        # {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ch && (
                  <span className="text-xs text-white/40">→ #{ch.name}</span>
                )}
                {savingType === type && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
