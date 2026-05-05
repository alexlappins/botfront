import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { ApiError, getGuilds, type Guild } from "@/lib/api"

const STORAGE_KEY = "activeGuildId"

type State = {
  guilds: Guild[]
  activeGuildId: string | null
  activeGuild: Guild | null
  loading: boolean
  error: string | null
  setActiveGuildId: (id: string | null) => void
  refreshGuilds: (opts?: { force?: boolean }) => Promise<void>
}

const ActiveGuildContext = createContext<State | null>(null)

/**
 * Holds the currently selected guild for User Admin Panel pages.
 * The selection persists in localStorage between sessions and is auto-restored on load.
 * Pages call useActiveGuild() to get { activeGuildId, activeGuild } and react to changes.
 */
export function ActiveGuildProvider({ children }: { children: ReactNode }) {
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [activeGuildId, setActiveGuildIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const setActiveGuildId = useCallback((id: string | null) => {
    setActiveGuildIdState(id)
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // localStorage unavailable
    }
  }, [])

  const refreshGuilds = useCallback(
    async (opts?: { force?: boolean }) => {
      setLoading(true)
      setError(null)
      try {
        const list = await getGuilds({ forceRefresh: opts?.force })
        setGuilds(list)
        // If previous selection no longer exists or never set — pick first
        setActiveGuildIdState((prev) => {
          if (prev && list.some((g) => g.id === prev)) return prev
          if (list.length > 0) {
            try {
              localStorage.setItem(STORAGE_KEY, list[0].id)
            } catch {
              // ignore
            }
            return list[0].id
          }
          return null
        })
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return
        setError(e instanceof Error ? e.message : "Failed to load guilds")
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void refreshGuilds()
  }, [refreshGuilds])

  const activeGuild = guilds.find((g) => g.id === activeGuildId) ?? null

  return (
    <ActiveGuildContext.Provider
      value={{
        guilds,
        activeGuildId,
        activeGuild,
        loading,
        error,
        setActiveGuildId,
        refreshGuilds,
      }}
    >
      {children}
    </ActiveGuildContext.Provider>
  )
}

export function useActiveGuild(): State {
  const ctx = useContext(ActiveGuildContext)
  if (!ctx) throw new Error("useActiveGuild must be used inside <ActiveGuildProvider>")
  return ctx
}

/** Same as useActiveGuild but returns null if no provider above (for legacy routes). */
export function useActiveGuildOptional(): State | null {
  return useContext(ActiveGuildContext)
}
