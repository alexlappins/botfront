import { useEffect, useMemo, useState } from "react"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Smile, Trash2 } from "lucide-react"
import {
  TemplateSelfRoleButtonsEditor,
  parseGuildSelfRoleComponents,
  serializeGuildSelfRoleComponents,
  type SelfRoleButtonDraft,
} from "@/components/template-self-role-buttons"
import {
  getGuildMessages,
  getGuildReactionRoles,
  addGuildReactionRole,
  deleteGuildReactionRole,
  getGuildRoles,
  updateGuildMessage,
  type GuildMessage,
  type GuildReactionRole,
  type GuildRole,
} from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * User Admin Panel: full-featured "Roles by reaction" page — same structure as
 * the admin template editor's "Auto-roles" section: two tabs (Reactions / Buttons).
 *
 * Reactions tab — emoji-reaction → role bindings on per-guild messages.
 * Buttons tab — list of all per-guild messages, each with its own collapsible
 *               buttons editor mirroring real Discord component edits.
 */
export function GuildAutoRolesPage() {
  const guildId = useCurrentGuildId()
  // Buttons is the most-used sub-section, so it's the default tab.
  const [tab, setTab] = useState<"reactions" | "buttons">("buttons")
  const [messages, setMessages] = useState<GuildMessage[]>([])
  const [bindings, setBindings] = useState<GuildReactionRole[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!guildId) return
    setLoading(true)
    setError(null)
    try {
      const [m, b, r] = await Promise.all([
        getGuildMessages(guildId),
        getGuildReactionRoles(guildId),
        getGuildRoles(guildId),
      ])
      setMessages(m)
      setBindings(b)
      setRoles(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Loading error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId])

  if (!guildId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <p className="text-white/60">Выберите сервер в селекторе слева вверху.</p>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    )
  }
  if (error) return <p className="text-sm text-red-400">{error}</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Smile className="h-7 w-7 text-violet-400" />
          Роли по реакции
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Управление реакциями и кнопками, которые выдают роли участникам.
        </p>
      </div>

      <div className="flex gap-2 border-b border-white/5">
        <TabBtn active={tab === "buttons"} onClick={() => setTab("buttons")}>
          Кнопки
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
            {messages.length}
          </span>
        </TabBtn>
        <TabBtn active={tab === "reactions"} onClick={() => setTab("reactions")}>
          Реакции
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
            {bindings.length}
          </span>
        </TabBtn>
      </div>

      {tab === "reactions" && (
        <ReactionsTab
          guildId={guildId}
          messages={messages}
          bindings={bindings}
          roles={roles}
          onChanged={() => void load()}
        />
      )}

      {tab === "buttons" && (
        <ButtonsTab
          guildId={guildId}
          messages={messages}
          roles={roles}
          onChanged={() => void load()}
        />
      )}
    </div>
  )
}

function TabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative px-5 py-3 text-sm font-medium transition-colors",
        active ? "text-white" : "text-white/50 hover:text-white/80",
      )}
    >
      <span className="inline-flex items-center">{children}</span>
      {active && (
        <span className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
      )}
    </button>
  )
}

// ─── Reactions tab ──────────────────────────────────────────────────────────

function ReactionsTab({
  guildId,
  messages,
  bindings,
  roles,
  onChanged,
}: {
  guildId: string
  messages: GuildMessage[]
  bindings: GuildReactionRole[]
  roles: GuildRole[]
  onChanged: () => void
}) {
  const [msgId, setMsgId] = useState("")
  const [emoji, setEmoji] = useState("")
  const [roleId, setRoleId] = useState("")
  const [adding, setAdding] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)

  function roleLabel(id: string): string {
    return roles.find((r) => r.id === id)?.name ?? id
  }

  function msgLabel(b: GuildReactionRole): string {
    const m = messages.find(
      (x) => x.discordMessageId === b.discordMessageId && x.discordChannelId === b.discordChannelId,
    )
    return m ? `#${m.channelName}` : `(channel ${b.discordChannelId})`
  }

  async function handleAdd() {
    if (!msgId || !emoji.trim() || !roleId) {
      setAddErr("Pick message, emoji and role")
      return
    }
    const msg = messages.find((m) => m.id === msgId)
    if (!msg) return
    setAdding(true)
    setAddErr(null)
    try {
      await addGuildReactionRole(guildId, {
        discordChannelId: msg.discordChannelId,
        discordMessageId: msg.discordMessageId,
        emojiKey: emoji.trim(),
        discordRoleId: roleId,
      })
      setEmoji("")
      setRoleId("")
      onChanged()
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : "Failed to add")
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(rrId: string) {
    if (!confirm("Remove this binding?")) return
    try {
      await deleteGuildReactionRole(guildId, rrId)
      onChanged()
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Активные привязки</CardTitle>
          <CardDescription>
            Все привязки эмодзи → роль на этом сервере. Удаление снимает реакцию бота с сообщения.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bindings.length === 0 ? (
            <p className="text-sm text-white/50">Привязок пока нет.</p>
          ) : (
            <div className="space-y-2">
              {bindings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03]"
                >
                  <span className="text-base">{b.emojiKey}</span>
                  <span className="text-sm text-white/40">→</span>
                  <span className="text-sm font-medium">{roleLabel(b.discordRoleId)}</span>
                  <span className="text-xs text-white/40 ml-auto">{msgLabel(b)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleRemove(b.id)}
                    className="text-red-400 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Добавить привязку
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <Label className="text-xs">Сообщение</Label>
              {messages.length === 0 ? (
                <p className="text-xs text-white/50">Нет сообщений — установите шаблон.</p>
              ) : (
                <Select
                  value={msgId || "__none__"}
                  onValueChange={(v) => setMsgId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите сообщение" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Не выбрано</SelectItem>
                    {messages.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        #{m.channelName} · {m.content?.slice(0, 30) || "(embed)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Эмодзи</Label>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="✅ или ID кастомного эмодзи"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Роль</Label>
              <Select
                value={roleId || "__none__"}
                onValueChange={(v) => setRoleId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите роль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Не выбрано</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {addErr && <p className="text-sm text-red-400">{addErr}</p>}

          <Button
            size="sm"
            onClick={() => void handleAdd()}
            disabled={adding || !msgId || !emoji.trim() || !roleId}
          >
            {adding ? "Добавление…" : "Добавить"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Buttons tab ────────────────────────────────────────────────────────────

function ButtonsTab({
  guildId,
  messages,
  roles,
  onChanged,
}: {
  guildId: string
  messages: GuildMessage[]
  roles: GuildRole[]
  onChanged: () => void
}) {
  // Local per-message buttons state — like in admin template editor
  const [buttonsByMsg, setButtonsByMsg] = useState<Record<string, SelfRoleButtonDraft[]>>(() => {
    const initial: Record<string, SelfRoleButtonDraft[]> = {}
    for (const m of messages) {
      initial[m.id] = parseGuildSelfRoleComponents(m.componentsJson)
    }
    return initial
  })
  const [savingMsgId, setSavingMsgId] = useState<string | null>(null)
  const [errByMsg, setErrByMsg] = useState<Record<string, string | null>>({})
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set())

  // Re-sync when messages change (after onChanged() reloads)
  useEffect(() => {
    setButtonsByMsg((prev) => {
      const next: Record<string, SelfRoleButtonDraft[]> = {}
      for (const m of messages) {
        next[m.id] = prev[m.id] ?? parseGuildSelfRoleComponents(m.componentsJson)
      }
      return next
    })
  }, [messages])

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.name })),
    [roles],
  )

  function toggleExpanded(msgId: string) {
    setExpandedMsgs((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  async function handleSave(msgId: string) {
    const btns = buttonsByMsg[msgId] ?? []
    setErrByMsg((p) => ({ ...p, [msgId]: null }))
    setSavingMsgId(msgId)
    try {
      const componentsArr = serializeGuildSelfRoleComponents(btns) ?? null
      await updateGuildMessage(guildId, msgId, { componentsJson: componentsArr })
      onChanged()
    } catch (e) {
      setErrByMsg((p) => ({
        ...p,
        [msgId]: e instanceof Error ? e.message : "Failed to save",
      }))
    } finally {
      setSavingMsgId(null)
    }
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-white/50">
          Нет сообщений на этом сервере. Установите шаблон, чтобы здесь появились сообщения.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">
        У каждого сообщения свои кнопки — добавляются и сохраняются независимо. Клик по сообщению
        раскрывает редактор.
      </p>
      {messages.map((m) => {
        const btns = buttonsByMsg[m.id] ?? []
        const isOpen = expandedMsgs.has(m.id)
        const isSaving = savingMsgId === m.id
        const err = errByMsg[m.id]
        return (
          <div
            key={m.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleExpanded(m.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-white truncate">
                  #{m.channelName}
                </span>
                <span className="text-xs text-white/40 truncate">
                  {m.content?.slice(0, 50) || "(embed)"}
                </span>
                {btns.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 ml-2">
                    {btns.length} {btns.length === 1 ? "кнопка" : "кнопок"}
                  </span>
                )}
              </div>
              <span className="text-xs text-white/40 shrink-0">
                {isOpen ? "▲ скрыть" : "▼ редактировать"}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-white/5 p-4 space-y-3">
                <TemplateSelfRoleButtonsEditor
                  buttons={btns}
                  onChange={(next) => setButtonsByMsg((prev) => ({ ...prev, [m.id]: next }))}
                  roleOptions={roleOptions.length > 0 ? roleOptions : undefined}
                />
                {err && <p className="text-sm text-red-400">{err}</p>}
                <Button size="sm" onClick={() => void handleSave(m.id)} disabled={isSaving}>
                  {isSaving ? "Сохранение…" : "Сохранить кнопки этого сообщения"}
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
