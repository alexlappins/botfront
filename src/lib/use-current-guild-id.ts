import { useParams } from "react-router-dom"
import { useActiveGuildOptional } from "@/contexts/active-guild-context"

/**
 * Returns the current guild id for User Admin Panel pages.
 * Prefers the URL param `:guildId` (legacy /guild/:guildId routes) if present,
 * otherwise falls back to the active guild from the global context selector.
 *
 * Returns null if neither is available — pages should handle that case.
 */
export function useCurrentGuildId(): string | null {
  const params = useParams<{ guildId?: string }>()
  const ctx = useActiveGuildOptional()
  return params.guildId ?? ctx?.activeGuildId ?? null
}
