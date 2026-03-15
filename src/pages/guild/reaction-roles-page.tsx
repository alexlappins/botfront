import { useState } from "react"
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
import { useGuildData } from "@/contexts/guild-data-context"
import { getReactionRoles, removeReactionRole, addReactionRoleBinding } from "@/lib/api"
import { MessageSquare, Plus } from "lucide-react"

export function GuildReactionRolesPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const { channels, roles, reactionRoles, setReactionRoles } = useGuildData()
  const [channelId, setChannelId] = useState("")
  const [messageId, setMessageId] = useState("")
  const [emoji, setEmoji] = useState("")
  const [roleId, setRoleId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  if (!guildId) return null

  async function handleAdd() {
    setAddError(null)
    const ch = channelId.trim()
    const msg = messageId.trim()
    const em = emoji.trim()
    const r = roleId.trim()
    if (!ch || !msg || !em || !r) {
      setAddError("Заполните все поля")
      return
    }
    setSubmitting(true)
    try {
      await addReactionRoleBinding(guildId!, {
        channelId: ch,
        messageId: msg,
        emoji: em,
        roleId: r,
      })
      const { bindings } = await getReactionRoles(guildId!)
      setReactionRoles(bindings ?? [])
      setChannelId("")
      setMessageId("")
      setEmoji("")
      setRoleId("")
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Не удалось добавить привязку")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(messageId: string, emojiKey: string) {
    try {
      await removeReactionRole(guildId!, { messageId, emojiKey })
      const { bindings } = await getReactionRoles(guildId!)
      setReactionRoles(bindings ?? [])
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Роли по реакции
          </CardTitle>
          <CardDescription>
            Добавляйте привязки здесь или командой /reaction-role-emoji в Discord. Эмодзи — один символ (например ✅) или кастомный в формате имя:id.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-4 space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Добавить привязку
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Канал</Label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите канал" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        # {ch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rr-message-id">ID сообщения</Label>
                <Input
                  id="rr-message-id"
                  value={messageId}
                  onChange={(e) => setMessageId(e.target.value)}
                  placeholder="Из ссылки (ПКМ по сообщению → Копировать ссылку)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rr-emoji">Эмодзи</Label>
                <Input
                  id="rr-emoji"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="✅ или имя:id для кастомного"
                />
              </div>
              <div className="space-y-2">
                <Label>Роль</Label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {addError && (
              <p className="text-sm text-[hsl(var(--destructive))]">{addError}</p>
            )}
            <Button onClick={handleAdd} disabled={submitting || channels.length === 0 || roles.length === 0}>
              {submitting ? "Добавление…" : "Добавить привязку"}
            </Button>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Текущие привязки</h4>
            {reactionRoles.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Нет привязок.</p>
            ) : (
              <ul className="space-y-4">
                {reactionRoles.map((b) => (
                  <li key={b.messageId} className="rounded-lg border border-[hsl(var(--border))] p-4 bg-[hsl(var(--muted)/0.3)]">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {b.channelId ? (
                        <a
                          href={`https://discord.com/channels/${guildId}/${b.channelId}/${b.messageId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[hsl(var(--primary))] hover:underline"
                        >
                          Сообщение {b.messageId.slice(-8)}
                        </a>
                      ) : (
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">Сообщение {b.messageId.slice(-8)}</span>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {b.roles.map((r) => (
                        <li key={`${b.messageId}-${r.emojiKey}`} className="flex items-center justify-between gap-2 text-sm">
                          <span>
                            <span className="font-mono">{r.emojiKey}</span> → роль{" "}
                            <span className="font-mono text-[hsl(var(--muted-foreground))]">{r.roleId.slice(-8)}</span>
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[hsl(var(--destructive))] shrink-0"
                            onClick={() => handleRemove(b.messageId, r.emojiKey)}
                          >
                            Удалить
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
