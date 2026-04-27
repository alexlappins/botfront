import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGuildData } from "@/contexts/guild-data-context"
import { updateLogsChannel, getLogEvents, type LogsType, type LogEvent } from "@/lib/api"
import { ScrollText, ListChecks } from "lucide-react"

const LOG_TYPE_LABELS: Record<LogsType, string> = {
  joinLeave: "Join/Leave",
  messages: "Messages",
  moderation: "Moderation",
  channel: "Channel",
  banKick: "Ban/Kick",
}
const LOG_TYPES: LogsType[] = ["joinLeave", "messages", "moderation", "channel", "banKick"]

const LIMIT = 50

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function EventRow({ event }: { event: LogEvent }) {
  const payloadStr =
    Object.keys(event.payload).length > 0
      ? JSON.stringify(event.payload)
      : "—"
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-[hsl(var(--muted-foreground))]">{LOG_TYPE_LABELS[event.type] ?? event.type}</span>
        <span className="text-[hsl(var(--muted-foreground))]">·</span>
        <span className="font-mono text-xs">{event.kind}</span>
        <span className="text-[hsl(var(--muted-foreground))] ml-auto">{formatDate(event.createdAt)}</span>
      </div>
      {payloadStr !== "—" && (
        <pre className="mt-1 overflow-x-auto rounded bg-[hsl(var(--background))] p-2 text-xs text-[hsl(var(--muted-foreground))]">
          {payloadStr}
        </pre>
      )}
    </li>
  )
}

export function GuildLogsPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const { channels, logs, setLogs } = useGuildData()
  const [events, setEvents] = useState<LogEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsMore, setEventsMore] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const loadEvents = useCallback(
    async (before?: string) => {
      if (!guildId) return
      setEventsLoading(true)
      setEventsError(null)
      try {
        const { events: next } = await getLogEvents(guildId, { limit: LIMIT, before })
        if (before) {
          setEvents((prev) => [...prev, ...next])
        } else {
          setEvents(next)
        }
        setEventsMore(next.length === LIMIT)
      } catch (e) {
        setEventsError(e instanceof Error ? e.message : "Loading error")
      } finally {
        setEventsLoading(false)
      }
    },
    [guildId]
  )

  useEffect(() => {
    if (guildId) loadEvents()
  }, [guildId, loadEvents])

  async function loadMore() {
    if (events.length === 0 || !eventsMore || eventsLoading) return
    const lastId = events[events.length - 1].id
    await loadEvents(lastId)
  }

  if (!guildId) return null

  async function handleChange(type: LogsType, channelId: string | null) {
    try {
      const next = await updateLogsChannel(guildId!, { type, channelId })
      setLogs(next)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2500)
    } catch {
      // error in context
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Log Channels
          </CardTitle>
          <CardDescription>
            Select a channel for each log type. You can configure them here, via the API, or with the /logs set command in Discord.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {savedAt != null && (
            <p className="text-sm text-[hsl(var(--primary))]">Saved.</p>
          )}
          {LOG_TYPES.map((type) => (
            <div key={type} className="flex flex-wrap items-center gap-3">
              <Label className="w-32 shrink-0">{LOG_TYPE_LABELS[type]}</Label>
              <Select
                value={logs?.[type] ?? "none"}
                onValueChange={(val) => handleChange(type, val === "none" ? null : val)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Disable</SelectItem>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      # {ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Event Feed
          </CardTitle>
          <CardDescription>
            Log events from the last 3 months. Stored in the database independently of Discord channel configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {eventsError && (
            <p className="text-sm text-[hsl(var(--destructive))]">{eventsError}</p>
          )}
          {eventsLoading && events.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No events.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
              {eventsMore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={eventsLoading}
                >
                  {eventsLoading ? "Loading…" : "Load more"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
