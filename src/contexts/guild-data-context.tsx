import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  getChannels,
  getGuilds,
  getTemplates,
  getLogs,
  getReactionRoles,
  getGuildRoles,
  type Channel,
  type Template,
  type Guild,
  type GuildLogs,
  type GuildRole,
  type ReactionRoleBinding,
} from "@/lib/api"

type GuildDataValue = {
  guild: Guild | null
  channels: Channel[]
  roles: GuildRole[]
  templates: Template[]
  logs: GuildLogs | null
  reactionRoles: ReactionRoleBinding[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  setTemplates: (t: Template[] | ((prev: Template[]) => Template[])) => void
  setLogs: (l: GuildLogs | null | ((prev: GuildLogs | null) => GuildLogs | null)) => void
  setReactionRoles: (r: ReactionRoleBinding[] | ((prev: ReactionRoleBinding[]) => ReactionRoleBinding[])) => void
}

const GuildDataContext = createContext<GuildDataValue | null>(null)

export function GuildDataProvider({
  guildId,
  children,
}: {
  guildId: string
  children: ReactNode
}) {
  const [guild, setGuild] = useState<Guild | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [logs, setLogs] = useState<GuildLogs | null>(null)
  const [reactionRoles, setReactionRoles] = useState<ReactionRoleBinding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [guildsRes, chRes, rolesRes, tplRes, logsRes, rrRes] = await Promise.all([
        getGuilds(),
        getChannels(guildId),
        getGuildRoles(guildId),
        getTemplates(guildId),
        getLogs(guildId),
        getReactionRoles(guildId),
      ])
      const g = guildsRes.find((x) => x.id === guildId) ?? null
      setGuild(g)
      setChannels(chRes)
      setRoles(rolesRes)
      setTemplates(tplRes)
      setLogs(logsRes)
      setReactionRoles(rrRes.bindings ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Loading error")
    } finally {
      setLoading(false)
    }
  }, [guildId])

  useEffect(() => {
    load()
  }, [load])

  const value: GuildDataValue = {
    guild,
    channels,
    roles,
    templates,
    logs,
    reactionRoles,
    loading,
    error,
    load,
    setTemplates,
    setLogs,
    setReactionRoles,
  }

  return (
    <GuildDataContext.Provider value={value}>
      {children}
    </GuildDataContext.Provider>
  )
}

export function useGuildData() {
  const ctx = useContext(GuildDataContext)
  if (!ctx) throw new Error("useGuildData must be used within GuildDataProvider")
  return ctx
}
