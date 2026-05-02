import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
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
import { Loader2, Plus, Trash2 } from "lucide-react"
import {
  getGuildMessages,
  getGuildReactionRoles,
  addGuildReactionRole,
  deleteGuildReactionRole,
  getGuildRoles,
  type GuildMessage,
  type GuildReactionRole,
  type GuildRole,
} from "@/lib/api"

/**
 * User Admin Panel: reaction-role bindings on the user's guild.
 * Users see all per-guild messages from their installed templates and can attach
 * emoji-reaction → role bindings to any of them.
 */
export function GuildAutoRolesPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const [messages, setMessages] = useState<GuildMessage[]>([])
  const [bindings, setBindings] = useState<GuildReactionRole[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [msgId, setMsgId] = useState("")
  const [emoji, setEmoji] = useState("")
  const [roleId, setRoleId] = useState("")
  const [adding, setAdding] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)

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

  async function handleAdd() {
    if (!guildId || !msgId || !emoji.trim() || !roleId) {
      setAddErr("Pick message, emoji and role")
      return
    }
    const msg = messages.find((m) => m.id === msgId)
    if (!msg) {
      setAddErr("Message not found")
      return
    }
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
      await load()
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : "Failed to add")
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(rrId: string) {
    if (!guildId) return
    if (!confirm("Remove this binding?")) return
    try {
      await deleteGuildReactionRole(guildId, rrId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }
  if (error) return <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>

  function msgLabel(b: GuildReactionRole): string {
    const m = messages.find(
      (x) => x.discordMessageId === b.discordMessageId && x.discordChannelId === b.discordChannelId,
    )
    return m ? `#${m.channelName}` : `(channel ${b.discordChannelId})`
  }

  function roleLabel(id: string): string {
    return roles.find((r) => r.id === id)?.name ?? id
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Auto-roles</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Attach emoji reactions to your server messages — adding the reaction grants the role.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current bindings</CardTitle>
          <CardDescription>
            All emoji-reaction bindings on this server. Removing a binding deletes the bot's
            reaction from the message.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bindings.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No bindings yet.</p>
          ) : (
            <div className="space-y-2">
              {bindings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-[hsl(var(--muted)/0.2)]"
                >
                  <span className="text-base">{b.emojiKey}</span>
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">→</span>
                  <span className="text-sm font-medium">{roleLabel(b.discordRoleId)}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">
                    {msgLabel(b)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleRemove(b.id)}
                    className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
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
            Add binding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <Label className="text-xs">Message</Label>
              {messages.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  No messages yet — install a template first.
                </p>
              ) : (
                <Select value={msgId || "__none__"} onValueChange={(v) => setMsgId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a message" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not selected</SelectItem>
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
              <Label className="text-xs">Emoji</Label>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="✅ or custom emoji id"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Role</Label>
              <Select value={roleId || "__none__"} onValueChange={(v) => setRoleId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not selected</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {addErr && <p className="text-sm text-[hsl(var(--destructive))]">{addErr}</p>}

          <Button
            size="sm"
            onClick={() => void handleAdd()}
            disabled={adding || !msgId || !emoji.trim() || !roleId}
          >
            {adding ? "Adding…" : "Add binding"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
