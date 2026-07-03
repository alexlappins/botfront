import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { getPremiumStatus, type PremiumStatus } from "@/lib/api"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"

/**
 * Per-guild premium status for the dashboard — the single client-side source
 * for the header badge and every feature gate (Misha TZ v2.1). Fetched once per
 * active guild and shared via context, so feature pages just call usePremium()
 * instead of each re-fetching.
 *
 * Default = free (premium:false). Anything that can't load is treated as free
 * so a failed lookup never accidentally unlocks a paid feature.
 */
type PremiumState = PremiumStatus & {
  loading: boolean
  refresh: () => Promise<void>
}

const FREE: PremiumStatus = { premium: false, plan: "free", until: null }

const PremiumContext = createContext<PremiumState | null>(null)

export function PremiumProvider({ children }: { children: ReactNode }) {
  const guildId = useCurrentGuildId()
  const [status, setStatus] = useState<PremiumStatus>(FREE)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!guildId) {
      setStatus(FREE)
      return
    }
    setLoading(true)
    try {
      setStatus(await getPremiumStatus(guildId))
    } catch {
      setStatus(FREE) // fail closed — never unlock on error
    } finally {
      setLoading(false)
    }
  }, [guildId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <PremiumContext.Provider value={{ ...status, loading, refresh }}>{children}</PremiumContext.Provider>
  )
}

/** Premium status for the current guild. Safe outside the provider (returns free). */
export function usePremium(): PremiumState {
  const ctx = useContext(PremiumContext)
  if (ctx) return ctx
  return { ...FREE, loading: false, refresh: async () => {} }
}
