import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AdminHeader } from "@/components/admin-header"
import {
  emptyEmbedForm,
  serializeFormToEmbedJson,
  type EmbedFormState,
  TemplateEmbedBuilder,
} from "@/components/template-embed-builder"
import {
  parseSelfRoleComponents,
  serializeSelfRoleComponents,
  type SelfRoleButtonDraft,
  TemplateSelfRoleButtonsEditor,
} from "@/components/template-self-role-buttons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import {
  ApiError,
  getServerTemplate,
  updateServerTemplate,
  getGuilds,
  getChannels,
  getGuildRoles,
  createTemplateMessage,
  createTemplateReactionRole,
  updateTemplateMessage,
  previewTemplateMessage,
  deleteTemplateReactionRole,
  createTemplateLogChannel,
  deleteTemplateLogChannel,
  createTemplateEmoji,
  deleteTemplateEmoji,
  createTemplateSticker,
  deleteTemplateSticker,
  createTemplateRole,
  deleteTemplateRole,
  createTemplateCategory,
  deleteTemplateCategory,
  createTemplateCategoryGrant,
  deleteTemplateCategoryGrant,
  uploadFile,
  type ServerTemplateDetail,
  type TemplateEmoji,
  type TemplateSticker,
  type TemplateCategoryGrant,
  type TemplateCategory,
  type TemplateChannel,
  type TemplateMessage,
  type TemplateRole,
  type TemplateReactionRole,
  type TemplateLogChannel,
  type TemplateLogType,
  type Guild,
  type Channel,
  type GuildRole,
  LOG_TYPES,
} from "@/lib/api"
import { TemplateMessageSelfRoleCard } from "@/components/template-message-self-role-card"
import { MessageSquare, ScrollText, Plus, Pencil, Trash2, Smile, Sticker, Upload } from "lucide-react"

const LOG_TYPE_LABELS: Record<TemplateLogType, string> = {
  joinLeave: "Join/Leave",
  messages: "Messages",
  moderation: "Moderation",
  channel: "Channel",
  banKick: "Ban/Kick",
}

/** Подсказка, если живой сервер не выбран */
const CHANNEL_NAME_HINT_MANUAL =
  "Channel name without #. You can pick a server above — channels from Discord (bot cache) will be suggested. Or type manually."

function ChannelNameField({
  id,
  value,
  onChange,
  channels,
  liveChannels = [],
  placeholder = "e.g. general",
}: {
  id: string
  value: string
  onChange: (v: string) => void
  channels: TemplateChannel[]
  /** Каналы с живого сервера: GET /api/guilds/:guildId/channels */
  liveChannels?: Channel[]
  placeholder?: string
}) {
  const listId = `${id}-channel-datalist`
  const seen = new Set<string>()
  const options: { key: string; name: string }[] = []
  for (const c of channels) {
    if (!seen.has(c.name)) {
      seen.add(c.name)
      options.push({ key: `t-${c.id}`, name: c.name })
    }
  }
  for (const c of liveChannels) {
    if (!seen.has(c.name)) {
      seen.add(c.name)
      options.push({ key: `g-${c.id}`, name: c.name })
    }
  }
  const hint =
    liveChannels.length > 0
      ? "Names from the selected server (bot cache). You can enter a different name manually — as it will be in Discord after the template is installed."
      : CHANNEL_NAME_HINT_MANUAL
  return (
    <div className="grid gap-2">
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.key} value={o.name} />
        ))}
      </datalist>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>
    </div>
  )
}

export function ServerTemplateEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  const [template, setTemplate] = useState<ServerTemplateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editMetaOpen, setEditMetaOpen] = useState(false)
  const [metaName, setMetaName] = useState("")
  const [metaDescription, setMetaDescription] = useState("")
  const [metaDiscordUrl, setMetaDiscordUrl] = useState("")
  const [metaIconUrl, setMetaIconUrl] = useState<string | null>(null)
  const [metaEnableServerStats, setMetaEnableServerStats] = useState(false)
  const [statsCategoryName, setStatsCategoryName] = useState("")
  const [statsTotalName, setStatsTotalName] = useState("")
  const [statsHumansName, setStatsHumansName] = useState("")
  const [statsBotsName, setStatsBotsName] = useState("")
  const [statsOnlineName, setStatsOnlineName] = useState("")
  const [savingStats, setSavingStats] = useState(false)
  const [statsSavedMsg, setStatsSavedMsg] = useState<string | null>(null)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [addMessageOpen, setAddMessageOpen] = useState(false)
  const [addLogChannelOpen, setAddLogChannelOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /** Подсказки каналов/ролей с живого сервера (GET /api/guilds/:id/channels, /roles) */
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [sourceGuildId, setSourceGuildId] = useState("")
  const [liveChannels, setLiveChannels] = useState<Channel[]>([])
  const [liveRoles, setLiveRoles] = useState<GuildRole[]>([])
  const [loadingLive, setLoadingLive] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getServerTemplate(id)
      setTemplate(data)
      setMetaName(data.name)
      setMetaDescription(data.description ?? "")
      setMetaDiscordUrl(data.discordTemplateUrl ?? "")
      setMetaIconUrl(data.iconUrl ?? null)
      setMetaEnableServerStats(Boolean(data.enableServerStats))
      setStatsCategoryName(data.statsCategoryName ?? "")
      setStatsTotalName(data.statsTotalName ?? "")
      setStatsHumansName(data.statsHumansName ?? "")
      setStatsBotsName(data.statsBotsName ?? "")
      setStatsOnlineName(data.statsOnlineName ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Loading error")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    getGuilds()
      .then((g) => {
        setGuilds(g)
        if (g.length > 0) setSourceGuildId((prev) => prev || g[0].id)
      })
      .catch(() => { /* список гильдий опционален */ })
  }, [])

  useEffect(() => {
    if (!sourceGuildId) {
      setLiveChannels([])
      setLiveRoles([])
      setLiveError(null)
      return
    }
    setLoadingLive(true)
    setLiveError(null)
    Promise.all([getChannels(sourceGuildId), getGuildRoles(sourceGuildId)])
      .then(([ch, r]) => {
        setLiveChannels(ch)
        setLiveRoles(r)
      })
      .catch((e) => {
        setLiveError(e instanceof Error ? e.message : "Failed to load server channels and roles")
        setLiveChannels([])
        setLiveRoles([])
      })
      .finally(() => setLoadingLive(false))
  }, [sourceGuildId])

  useEffect(() => {
    if (template) {
      setMetaName(template.name)
      setMetaDescription(template.description ?? "")
      setMetaDiscordUrl(template.discordTemplateUrl ?? "")
      setMetaIconUrl(template.iconUrl ?? null)
      setMetaEnableServerStats(Boolean(template.enableServerStats))
      setStatsCategoryName(template.statsCategoryName ?? "")
      setStatsTotalName(template.statsTotalName ?? "")
      setStatsHumansName(template.statsHumansName ?? "")
      setStatsBotsName(template.statsBotsName ?? "")
      setStatsOnlineName(template.statsOnlineName ?? "")
    }
  }, [template])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Link to="/login">Sign in</Link>
      </div>
    )
  }

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[hsl(var(--muted-foreground))]">No template selected</p>
      </div>
    )
  }

  if (loading && !template) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading template…</div>
      </div>
    )
  }

  if (error && !template) {
    return (
      <div className="min-h-screen p-4">
        <Link to="/server-templates" className="text-[hsl(var(--primary))] hover:underline">
          ← Back to templates
        </Link>
        <div className="mt-4 p-4 rounded-lg bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]">
          {error}
        </div>
      </div>
    )
  }

  if (!template) return null

  async function handleUploadIcon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFormError(null)
    setUploadingIcon(true)
    try {
      const { url } = await uploadFile(file)
      const updated = await updateServerTemplate(id!, { iconUrl: url })
      setMetaIconUrl(url)
      setTemplate((prev) => (prev ? { ...prev, ...updated } : null))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to upload icon")
    } finally {
      setUploadingIcon(false)
      e.target.value = ""
    }
  }

  async function handleSaveStatsNames() {
    setStatsSavedMsg(null)
    setSavingStats(true)
    try {
      const updated = await updateServerTemplate(id!, {
        statsCategoryName: statsCategoryName.trim() || null,
        statsTotalName: statsTotalName.trim() || null,
        statsHumansName: statsHumansName.trim() || null,
        statsBotsName: statsBotsName.trim() || null,
        statsOnlineName: statsOnlineName.trim() || null,
      })
      setTemplate((prev) => (prev ? { ...prev, ...updated } : null))
      setStatsSavedMsg("Saved")
      setTimeout(() => setStatsSavedMsg(null), 2000)
    } catch (err) {
      setStatsSavedMsg(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSavingStats(false)
    }
  }

  async function handleToggleServerStats(next: boolean) {
    setFormError(null)
    setMetaEnableServerStats(next)
    try {
      const updated = await updateServerTemplate(id!, { enableServerStats: next })
      setTemplate((prev) => (prev ? { ...prev, ...updated } : null))
    } catch (err) {
      // откатываем на бэкапное значение
      setMetaEnableServerStats(!next)
      setFormError(err instanceof Error ? err.message : "Failed to save")
    }
  }

  async function handleRemoveIcon() {
    setFormError(null)
    try {
      const updated = await updateServerTemplate(id!, { iconUrl: null })
      setMetaIconUrl(null)
      setTemplate((prev) => (prev ? { ...prev, ...updated } : null))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete icon")
    }
  }

  async function handleSaveMeta() {
    setFormError(null)
    setSavingMeta(true)
    try {
      const updated = await updateServerTemplate(id!, {
        name: metaName.trim(),
        description: metaDescription.trim() || null,
        discordTemplateUrl: metaDiscordUrl.trim() || null,
        iconUrl: metaIconUrl,
      })
      setTemplate((prev) => (prev ? { ...prev, ...updated } : null))
      setEditMetaOpen(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSavingMeta(false)
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <AdminHeader title={template.name} />

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {template.description ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{template.description}</p>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditMetaOpen(true)} className="shrink-0">
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
        {/* Discord template block (primary deployment scenario) */}
        <Card>
          <CardHeader>
            <CardTitle>Discord server template</CardTitle>
            <CardDescription>
              Provide a link to a native Discord template. It creates the role and channel structure,
              and the bot then layers messages, auto-roles and logs on top.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="meta-discord-url">Discord template URL</Label>
              <Input
                id="meta-discord-url"
                value={metaDiscordUrl}
                onChange={(e) => setMetaDiscordUrl(e.target.value)}
                placeholder="https://discord.new/..."
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={handleSaveMeta} disabled={savingMeta}>
                {savingMeta ? "Saving…" : "Save"}
              </Button>
              {template.discordTemplateUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                >
                  <a href={template.discordTemplateUrl} target="_blank" rel="noreferrer">
                    Open in Discord
                  </a>
                </Button>
              )}
            </div>
            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </CardContent>
        </Card>

        {/* Server icon — bot will set it during deployment */}
        <Card>
          <CardHeader>
            <CardTitle>Server icon</CardTitle>
            <CardDescription>
              The bot will automatically set this icon when deploying the template to a Discord server.
              PNG/JPG/GIF, 512×512 px recommended, up to 256 KB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[hsl(var(--muted))] border flex items-center justify-center shrink-0">
                {metaIconUrl ? (
                  <img src={metaIconUrl} alt="Icon" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">none</span>
                )}
              </div>
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <Button size="sm" variant="outline" asChild disabled={uploadingIcon}>
                    <span>{uploadingIcon ? "Uploading…" : metaIconUrl ? "Replace" : "Upload"}</span>
                  </Button>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={handleUploadIcon}
                    disabled={uploadingIcon}
                  />
                </label>
                {metaIconUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRemoveIcon}
                    className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Server stats (ServerStats clone) */}
        <Card>
          <CardHeader>
            <CardTitle>Server stats</CardTitle>
            <CardDescription>
              When the template is installed, the bot will create a category at the very top with 4 voice
              counter channels. Numbers refresh every 10 minutes (Discord rate limit on channel renames).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={metaEnableServerStats}
                onChange={(e) => handleToggleServerStats(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
              />
              <div className="space-y-0.5">
                <span className="text-sm font-medium">
                  Enable stats channels on template install
                </span>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  The user can disable them later with the <code>/serverstats-disable</code> command.
                </p>
              </div>
            </label>

            {metaEnableServerStats && (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <p className="text-sm font-medium mb-1">Names</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
                    Use <code>{"{count}"}</code> as a placeholder for the number. Empty = default value.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1 md:col-span-2">
                    <Label className="text-xs">Category name</Label>
                    <Input
                      value={statsCategoryName}
                      onChange={(e) => setStatsCategoryName(e.target.value)}
                      placeholder="📊 Server Stats"
                      maxLength={100}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">"Total" channel</Label>
                    <Input
                      value={statsTotalName}
                      onChange={(e) => setStatsTotalName(e.target.value)}
                      placeholder="👥 Total: {count}"
                      maxLength={100}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">"Humans" channel</Label>
                    <Input
                      value={statsHumansName}
                      onChange={(e) => setStatsHumansName(e.target.value)}
                      placeholder="👤 Humans: {count}"
                      maxLength={100}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">"Bots" channel</Label>
                    <Input
                      value={statsBotsName}
                      onChange={(e) => setStatsBotsName(e.target.value)}
                      placeholder="🤖 Bots: {count}"
                      maxLength={100}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">"Online" channel</Label>
                    <Input
                      value={statsOnlineName}
                      onChange={(e) => setStatsOnlineName(e.target.value)}
                      placeholder="🟢 Online: {count}"
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={handleSaveStatsNames} disabled={savingStats}>
                    {savingStats ? "Saving…" : "Save names"}
                  </Button>
                  {statsSavedMsg && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{statsSavedMsg}</span>
                  )}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Example: "Adventurers: {"{count}"}" becomes "Adventurers: 5" after install.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live server suggestions</CardTitle>
            <CardDescription>
              Once the server has already been created from the Discord template, pick it here — the forms
              below will show real channel and role names from the bot cache (
              <code className="text-xs">GET /api/guilds/…/channels</code>,{" "}
              <code className="text-xs">GET /api/guilds/…/roles</code>
              ). This does not change template records in the DB — it only helps you type the same names
              that will be used at install time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-w-lg">
            <div className="grid gap-2">
              <Label htmlFor="source-guild">Server for suggestions</Label>
              <Select
                value={sourceGuildId || "__none__"}
                onValueChange={(v) => setSourceGuildId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="source-guild">
                  <SelectValue placeholder="Not selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not selected</SelectItem>
                  {guilds.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {loadingLive && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading channels and roles…</p>
            )}
            {liveError && (
              <p className="text-sm text-[hsl(var(--destructive))]">{liveError}</p>
            )}
            {sourceGuildId && !loadingLive && !liveError && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Loaded: {liveChannels.length} channels, {liveRoles.length} roles (excluding @everyone and managed).
              </p>
            )}
          </CardContent>
        </Card>

        <SectionRoles
          templateId={id}
          roles={template.roles}
          onUpdate={load}
        />

        <SectionCategories
          templateId={id}
          categories={template.categories}
          onUpdate={load}
        />

        <SectionCategoryGrants
          templateId={id}
          categories={template.categories}
          grants={template.categoryGrants ?? []}
          onUpdate={load}
        />

        <SectionVerifyHide
          templateId={id}
          categories={template.categories}
          roles={template.roles}
          currentCategoryName={template.verifiedHideCategoryName ?? null}
          currentRoleName={template.verifiedHideRoleName ?? null}
          onUpdate={load}
        />

        <SectionMessages
          templateId={id}
          channels={template.channels}
          messages={template.messages}
          liveChannels={liveChannels}
          guilds={guilds}
          previewDefaultGuildId={sourceGuildId}
          onUpdate={load}
          addOpen={addMessageOpen}
          setAddOpen={setAddMessageOpen}
          formError={formError}
          setFormError={setFormError}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
        <SectionAutoRoles
          templateId={id}
          messages={template.messages}
          roles={template.roles}
          reactionRoles={template.reactionRoles}
          liveRoles={liveRoles}
          onUpdate={load}
        />
        <SectionEmojisStickers
          templateId={id}
          emojis={template.emojis ?? []}
          stickers={template.stickers ?? []}
          onUpdate={load}
        />
        <SectionLogChannels
          templateId={id}
          logChannels={template.logChannels}
          channels={[]}
          liveChannels={liveChannels}
          onUpdate={load}
          addOpen={addLogChannelOpen}
          setAddOpen={setAddLogChannelOpen}
          formError={formError}
          setFormError={setFormError}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      </main>

      <Dialog open={editMetaOpen} onOpenChange={setEditMetaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name and description</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={metaName} onChange={(e) => setMetaName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meta-discord-url-modal">Discord template URL</Label>
              <Input
                id="meta-discord-url-modal"
                value={metaDiscordUrl}
                onChange={(e) => setMetaDiscordUrl(e.target.value)}
                placeholder="https://discord.new/..."
              />
            </div>
            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMetaOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMeta} disabled={savingMeta}>
              {savingMeta ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const msgTextareaClass =
  "flex min-h-[120px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm ring-offset-[hsl(var(--background))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"

function messageOrderNorm(m: TemplateMessage): number {
  return m.messageOrder ?? 0
}

function orphanReactionRoles(messages: TemplateMessage[], all: TemplateReactionRole[]): TemplateReactionRole[] {
  return all.filter(
    (rr) =>
      !messages.some(
        (m) => rr.channelName === m.channelName && (rr.messageOrder ?? 0) === messageOrderNorm(m)
      )
  )
}

function SectionMessages({
  templateId,
  channels,
  messages,
  liveChannels,
  guilds,
  previewDefaultGuildId,
  onUpdate,
  addOpen,
  setAddOpen,
  formError,
  setFormError,
  submitting,
  setSubmitting,
}: {
  templateId: string
  channels: TemplateChannel[]
  messages: TemplateMessage[]
  liveChannels: Channel[]
  guilds: Guild[]
  previewDefaultGuildId: string
  onUpdate: () => void
  addOpen: boolean
  setAddOpen: (v: boolean) => void
  formError: string | null
  setFormError: (v: string | null) => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [channelName, setChannelName] = useState("")
  const [content, setContent] = useState("")
  const [messageOrder, setMessageOrder] = useState("")
  const [embedForm, setEmbedForm] = useState<EmbedFormState>(() => emptyEmbedForm())
  const [msgUiTab, setMsgUiTab] = useState<"message" | "embed">("message")
  const [previewGuildId, setPreviewGuildId] = useState("")
  const [previewChannelId, setPreviewChannelId] = useState("")
  const [previewChannelsList, setPreviewChannelsList] = useState<Channel[]>([])
  const [loadingPreviewChannels, setLoadingPreviewChannels] = useState(false)
  const [previewPanelError, setPreviewPanelError] = useState<string | null>(null)
  const [previewSending, setPreviewSending] = useState(false)

  const sortedMessages = [...messages].sort((a, b) => {
    const ca = a.channelName.localeCompare(b.channelName, "ru")
    if (ca !== 0) return ca
    return messageOrderNorm(a) - messageOrderNorm(b)
  })

  function resetFormForCreate() {
    setChannelName("")
    setContent("")
    setMessageOrder("")
    setEmbedForm(emptyEmbedForm())
    setMsgUiTab("message")
    setPreviewGuildId("")
    setPreviewChannelId("")
    setPreviewChannelsList([])
    setLoadingPreviewChannels(false)
    setPreviewPanelError(null)
    setPreviewSending(false)
  }

  function openCreate() {
    resetFormForCreate()
    setFormError(null)
    if (previewDefaultGuildId) setPreviewGuildId(previewDefaultGuildId)
    setAddOpen(true)
  }

  useEffect(() => {
    if (!addOpen || !previewGuildId.trim()) {
      setPreviewChannelsList([])
      return
    }
    let cancelled = false
    setLoadingPreviewChannels(true)
    setPreviewPanelError(null)
    getChannels(previewGuildId.trim())
      .then((ch) => {
        if (cancelled) return
        setPreviewChannelsList(ch.filter((c) => c.type === 0 || c.type === 5))
      })
      .catch((e) => {
        if (!cancelled) {
          setPreviewChannelsList([])
          setPreviewPanelError(e instanceof Error ? e.message : "Failed to load channels")
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPreviewChannels(false)
      })
    return () => {
      cancelled = true
    }
  }, [addOpen, previewGuildId])

  async function handlePreviewInDiscord() {
    const embedJsonStr = serializeFormToEmbedJson(embedForm)
    const hasContent = Boolean(content.trim())
    if (!hasContent && !embedJsonStr) {
      setPreviewPanelError("Text or embed is required. A color bar alone isn't enough — the API will return 400.")
      return
    }
    if (!previewGuildId.trim() || !previewChannelId.trim()) {
      setPreviewPanelError("Pick a server and a channel")
      return
    }
    setPreviewPanelError(null)
    setPreviewSending(true)
    try {
      await previewTemplateMessage(previewGuildId.trim(), {
        channelId: previewChannelId.trim(),
        content: hasContent ? content.trim() : undefined,
        embedJson: embedJsonStr ?? undefined,
      })
    } catch (e) {
      setPreviewPanelError(e instanceof ApiError ? e.message : "Failed to send preview")
    } finally {
      setPreviewSending(false)
    }
  }

  function handleDialogOpenChange(open: boolean) {
    setAddOpen(open)
    if (!open) {
      resetFormForCreate()
      setFormError(null)
    }
  }

  async function handleSubmitCreate() {
    const ch = channelName.trim()
    if (!ch) { setFormError("Pick a channel"); return }
    const embedJsonStr = serializeFormToEmbedJson(embedForm)
    const hasContent = Boolean(content.trim())
    const hasEmbed = embedJsonStr != null
    if (!hasContent && !hasEmbed) {
      setFormError("Provide text or an embed")
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      const orderRaw = messageOrder.trim()
      let order: number | undefined
      if (orderRaw !== "") {
        const n = Number(orderRaw)
        if (Number.isFinite(n)) order = Math.floor(n)
      }
      await createTemplateMessage(templateId, {
        channelName: ch,
        messageOrder: order,
        content: hasContent ? content.trim() : undefined,
        embedJson: hasEmbed ? embedJsonStr : undefined,
      })
      handleDialogOpenChange(false)
      onUpdate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Message templates
          </CardTitle>
          <CardDescription>
            Messages the bot will send to channels after the template is installed. Each card is one
            message: channel, order, text/embed and auto-role buttons.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Add message
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {sortedMessages.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No messages. Click "Add message" — then configure content, buttons or reactions in the card.
          </p>
        ) : (
          <div className="space-y-6">
            {sortedMessages.map((m) => (
              <TemplateMessageSelfRoleCard
                key={m.id}
                templateId={templateId}
                message={m}
                templateChannels={channels}
                liveChannels={liveChannels}
                guilds={guilds}
                previewDefaultGuildId={previewDefaultGuildId}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        )}
      </CardContent>
      <Dialog open={addOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add message</DialogTitle>
            <DialogDescription>
              Text, embed and auto-role buttons together form one template message. Embed: <code className="text-xs">{"{ \"embeds\": [ … ] }"}</code>
              . Buttons: Discord <code className="text-xs">components</code> (Action Row + buttons with{" "}
              <code className="text-xs">rr/give/{"{{"}role{"}}"})</code> etc.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label>Channel *</Label>
                {liveChannels.length > 0 ? (
                  <Select
                    value={channelName || "__none__"}
                    onValueChange={(v) => setChannelName(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Pick a channel</SelectItem>
                      {liveChannels
                        .filter((c) => c.type === 0 || c.type === 5)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.name}>#{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <ChannelNameField
                    id={`msg-ch-${templateId}`}
                    value={channelName}
                    onChange={setChannelName}
                    channels={channels}
                    liveChannels={[]}
                  />
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`msg-order-${templateId}`}>Order (messageOrder)</Label>
                <Input
                  id={`msg-order-${templateId}`}
                  type="number"
                  value={messageOrder}
                  onChange={(e) => setMessageOrder(e.target.value)}
                  placeholder="e.g. 0, 1, 2…"
                />
              </div>
            </div>

            <div className="flex flex-wrap rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-1 gap-1">
              <button
                type="button"
                onClick={() => setMsgUiTab("message")}
                className={cn(
                  "flex-1 min-w-[100px] rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  msgUiTab === "message"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                )}
              >
                Message
              </button>
              <button
                type="button"
                onClick={() => setMsgUiTab("embed")}
                className={cn(
                  "flex-1 min-w-[100px] rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  msgUiTab === "embed"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                )}
              >
                Embed
              </button>
            </div>

            {msgUiTab === "message" ? (
              <div className="grid gap-2">
                <Label htmlFor={`msg-content-${templateId}`}>Message content</Label>
                <textarea
                  id={`msg-content-${templateId}`}
                  className={msgTextareaClass}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Plain Discord text — shown above the embed card if the embed is configured on the 'Embed' tab."
                  rows={6}
                />
              </div>
            ) : (
              <TemplateEmbedBuilder form={embedForm} onChange={setEmbedForm} />
            )}

            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Preview in Discord</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Sends the current draft to a channel (without saving the template). The bot needs send permission on the channel. The embed must have visible content (not just a color bar) — otherwise the API returns 400.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor={`preview-guild-${templateId}`}>Server</Label>
                  <Select
                    value={previewGuildId || "__none__"}
                    onValueChange={(v) => {
                      const id = v === "__none__" ? "" : v
                      setPreviewGuildId(id)
                      setPreviewChannelId("")
                    }}
                  >
                    <SelectTrigger id={`preview-guild-${templateId}`}>
                      <SelectValue placeholder="Pick a server" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not selected</SelectItem>
                      {guilds.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`preview-ch-${templateId}`}>Channel</Label>
                  <Select
                    value={previewChannelId || "__none__"}
                    onValueChange={(v) => setPreviewChannelId(v === "__none__" ? "" : v)}
                    disabled={!previewGuildId.trim() || loadingPreviewChannels}
                  >
                    <SelectTrigger id={`preview-ch-${templateId}`}>
                      <SelectValue placeholder={loadingPreviewChannels ? "Loading…" : "Channel"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not selected</SelectItem>
                      {previewChannelsList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          #{c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {loadingPreviewChannels && previewGuildId ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading channel list…</p>
              ) : null}
              {previewPanelError ? (
                <p className="text-sm text-[hsl(var(--destructive))]">{previewPanelError}</p>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handlePreviewInDiscord()}
                disabled={previewSending || !previewGuildId.trim() || !previewChannelId.trim()}
              >
                {previewSending ? "Sending…" : "Send test to channel"}
              </Button>
            </div>

            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmitCreate()} disabled={submitting || !channelName.trim()}>
              {submitting ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SectionLogChannels({
  templateId,
  logChannels,
  channels,
  liveChannels,
  onUpdate,
  addOpen,
  setAddOpen,
  formError,
  setFormError,
  submitting,
  setSubmitting,
}: {
  templateId: string
  logChannels: TemplateLogChannel[]
  channels: TemplateChannel[]
  liveChannels: Channel[]
  onUpdate: () => void
  addOpen: boolean
  setAddOpen: (v: boolean) => void
  formError: string | null
  setFormError: (v: string | null) => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [logType, setLogType] = useState<TemplateLogType>("joinLeave")
  const [channelName, setChannelName] = useState("")

  async function handleAdd() {
    const ch = channelName.trim()
    if (!ch) return
    setFormError(null)
    setSubmitting(true)
    try {
      await createTemplateLogChannel(templateId, { logType, channelName: ch })
      setChannelName("")
      setAddOpen(false)
      onUpdate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(lcId: string) {
    if (!confirm("Delete log channel?")) return
    try {
      await deleteTemplateLogChannel(templateId, lcId)
      onUpdate()
    } catch {
      /* ignore */
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Log channels
          </CardTitle>
          <CardDescription>
            Log type and channel name. The name can be taken from "Live server suggestions" or typed manually.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        {logChannels.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No log channels</p>
        ) : (
          <ul className="space-y-2">
            {logChannels.map((lc) => (
              <li key={lc.id} className="flex items-center justify-between rounded border border-[hsl(var(--border))] px-3 py-2 text-sm">
                <span>{LOG_TYPE_LABELS[lc.logType as TemplateLogType] ?? lc.logType} → {lc.channelName}</span>
                <Button size="sm" variant="ghost" className="text-[hsl(var(--destructive))]" onClick={() => handleDelete(lc.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add log channel</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Log type *</Label>
              <Select value={logType} onValueChange={(v) => setLogType(v as TemplateLogType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOG_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{LOG_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`log-ch-${templateId}`}>Channel (name) *</Label>
              <ChannelNameField
                id={`log-ch-${templateId}`}
                value={channelName}
                onChange={setChannelName}
                channels={channels}
                liveChannels={liveChannels}
              />
            </div>
            {formError && <p className="text-sm text-[hsl(var(--destructive))]">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={submitting || !channelName.trim()}>{submitting ? "Adding…" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function buildMsgOptions(messages: TemplateMessage[]) {
  return messages.map((m) => {
    const order = m.messageOrder ?? 0
    const key = `${m.channelName}:${order}`
    let title = ""
    if (m.embedJson) {
      try {
        const p = JSON.parse(m.embedJson) as { embeds?: { title?: string }[] }
        const t = p.embeds?.[0]?.title
        if (typeof t === "string" && t.trim()) title = t.trim()
      } catch { /* ignore */ }
    }
    if (!title && m.content?.trim()) {
      const c = m.content.trim()
      title = c.length > 30 ? `${c.slice(0, 30)}…` : c
    }
    const label = title
      ? `#${m.channelName} · ${order} · ${title}`
      : `#${m.channelName} · order ${order}`
    return { key, label, message: m }
  })
}

function SectionAutoRoles({
  templateId,
  messages,
  roles,
  reactionRoles,
  liveRoles,
  onUpdate,
}: {
  templateId: string
  messages: TemplateMessage[]
  roles: TemplateRole[]
  reactionRoles: TemplateReactionRole[]
  liveRoles: GuildRole[]
  onUpdate: () => void
}) {
  const [activeTab, setActiveTab] = useState<"reactions" | "buttons">("reactions")

  // --- Реакции ---
  const [msgKey, setMsgKey] = useState("")
  const [emojiKey, setEmojiKey] = useState("")
  const [roleName, setRoleName] = useState("")
  const [adding, setAdding] = useState(false)
  const [rrError, setRrError] = useState<string | null>(null)

  // --- Кнопки --- (теперь per-message: для каждого сообщения свой редактор)
  // Локальное состояние кнопок по messageId — позволяет редактировать и сохранять
  // каждое сообщение независимо, без потери изменений при переключении.
  const [buttonsByMsg, setButtonsByMsg] = useState<Record<string, SelfRoleButtonDraft[]>>({})
  const [savingMsgId, setSavingMsgId] = useState<string | null>(null)
  const [btnErrorByMsg, setBtnErrorByMsg] = useState<Record<string, string | null>>({})
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set())

  const msgOptions = buildMsgOptions(messages)

  const roleOptions = [
    ...liveRoles.map((r) => ({ value: r.name, label: r.name })),
    ...roles
      .filter((r) => !liveRoles.some((lr) => lr.name === r.name))
      .map((r) => ({ value: r.name, label: r.name })),
  ]

  const orphans = orphanReactionRoles(messages, reactionRoles)

  // Синхронизируем buttonsByMsg с сообщениями из шаблона — добавляем новые, убираем удалённые.
  // Не перезатираем локальные несохранённые правки существующих сообщений.
  useEffect(() => {
    setButtonsByMsg((prev) => {
      const next: Record<string, SelfRoleButtonDraft[]> = {}
      for (const m of messages) {
        if (prev[m.id]) {
          // сохраняем локальные изменения
          next[m.id] = prev[m.id]
        } else {
          next[m.id] = parseSelfRoleComponents(m.componentsJson)
        }
      }
      return next
    })
  }, [messages])

  async function handleAddReaction() {
    const em = emojiKey.trim()
    const r = roleName.trim()
    if (!msgKey || !em || !r) { setRrError("Fill in all fields"); return }
    const colonIdx = msgKey.indexOf(":")
    const channelName = msgKey.slice(0, colonIdx)
    const messageOrder = Number(msgKey.slice(colonIdx + 1)) || 0
    setAdding(true)
    setRrError(null)
    try {
      await createTemplateReactionRole(templateId, { channelName, messageOrder, emojiKey: em, roleName: r })
      setEmojiKey("")
      setRoleName("")
      onUpdate()
    } catch (e) {
      setRrError(e instanceof Error ? e.message : "Error")
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteRR(rrId: string) {
    if (!confirm("Delete this binding?")) return
    try {
      await deleteTemplateReactionRole(templateId, rrId)
      onUpdate()
    } catch { /* ignore */ }
  }

  async function handleSaveButtonsFor(msgId: string) {
    const btns = buttonsByMsg[msgId] ?? []
    setBtnErrorByMsg((prev) => ({ ...prev, [msgId]: null }))
    setSavingMsgId(msgId)
    try {
      const componentsJson = serializeSelfRoleComponents(btns) ?? ""
      await updateTemplateMessage(templateId, msgId, { componentsJson })
      onUpdate()
    } catch (e) {
      setBtnErrorByMsg((prev) => ({
        ...prev,
        [msgId]: e instanceof Error ? e.message : "Failed to save",
      }))
    } finally {
      setSavingMsgId(null)
    }
  }

  function toggleExpanded(msgId: string) {
    setExpandedMsgs((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  function getMsgLabel(msgId: string): string {
    const opt = msgOptions.find((o) => o.message.id === msgId)
    return opt?.label ?? msgId
  }

  const tabClass = (active: boolean) =>
    cn(
      "flex-1 min-w-[100px] rounded-md px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          Auto-roles
        </CardTitle>
        <CardDescription>
          Manage reactions and buttons that grant roles after the template is installed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Переключатель вкладок */}
        <div className="flex flex-wrap rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-1 gap-1">
          <button type="button" onClick={() => setActiveTab("reactions")} className={tabClass(activeTab === "reactions")}>
            Reactions
          </button>
          <button type="button" onClick={() => setActiveTab("buttons")} className={tabClass(activeTab === "buttons")}>
            Buttons
          </button>
        </div>

        {activeTab === "reactions" ? (
          <>
            {/* Список реакций */}
            {reactionRoles.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No reaction bindings.</p>
            ) : (
              <ul className="space-y-2">
                {reactionRoles.map((rr) => {
                  const isOrphan = orphans.some((o) => o.id === rr.id)
                  return (
                    <li
                      key={rr.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-mono",
                        isOrphan
                          ? "border-amber-500/40 bg-amber-500/10"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]"
                      )}
                    >
                      <span>
                        #{rr.channelName} · {rr.messageOrder ?? 0} · {rr.emojiKey} → {rr.roleName}
                        {isOrphan && <span className="ml-2 font-sans text-xs text-amber-300">no message</span>}
                      </span>
                      <Button type="button" size="sm" variant="ghost" className="text-[hsl(var(--destructive))] shrink-0" onClick={() => void handleDeleteRR(rr.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Форма добавления реакции */}
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-4 space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" />Add reaction</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Message</Label>
                  {messages.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Add messages above first.</p>
                  ) : (
                    <Select value={msgKey || "__none__"} onValueChange={(v) => setMsgKey(v === "__none__" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Pick a message" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not selected</SelectItem>
                        {msgOptions.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Emoji</Label>
                  <Input value={emojiKey} onChange={(e) => setEmojiKey(e.target.value)} placeholder="✅ or name:id" />
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Select value={roleName || "__none__"} onValueChange={(v) => setRoleName(v === "__none__" ? "" : v)} disabled={roleOptions.length === 0}>
                    <SelectTrigger><SelectValue placeholder={roleOptions.length === 0 ? "No roles" : "Pick a role"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not selected</SelectItem>
                      {roleOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {rrError && <p className="text-sm text-[hsl(var(--destructive))]">{rrError}</p>}
              <Button onClick={() => void handleAddReaction()} disabled={adding || !msgKey || !emojiKey.trim() || !roleName.trim() || messages.length === 0}>
                {adding ? "Adding…" : "Add reaction"}
              </Button>
            </div>
          </>
        ) : (
          <>
            {messages.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Add messages above first.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Each message can have its own auto-role buttons added independently.
                  Click a message to expand its editor.
                </p>
                {messages.map((m) => {
                  const btns = buttonsByMsg[m.id] ?? []
                  const isExpanded = expandedMsgs.has(m.id)
                  const isSaving = savingMsgId === m.id
                  const err = btnErrorByMsg[m.id]
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(m.id)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[hsl(var(--muted)/0.4)] rounded-lg"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{getMsgLabel(m.id)}</span>
                          {btns.length > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                              {btns.length} {btns.length === 1 ? "button" : "buttons"}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                          {isExpanded ? "▲ collapse" : "▼ edit"}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="border-t p-3 space-y-3">
                          <TemplateSelfRoleButtonsEditor
                            buttons={btns}
                            onChange={(next) =>
                              setButtonsByMsg((prev) => ({ ...prev, [m.id]: next }))
                            }
                            roleOptions={roleOptions.length > 0 ? roleOptions : undefined}
                          />
                          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
                          <Button
                            size="sm"
                            onClick={() => void handleSaveButtonsFor(m.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? "Saving…" : "Save buttons for this message"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Секция «Эмодзи и стикеры»
// ════════════════════════════════════════════════════════════════════════════

function SectionEmojisStickers({
  templateId,
  emojis,
  stickers,
  onUpdate,
}: {
  templateId: string
  emojis: TemplateEmoji[]
  stickers: TemplateSticker[]
  onUpdate: () => void
}) {
  const [tab, setTab] = useState<"emojis" | "stickers">("emojis")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ——— Emoji upload ———
  async function handleEmojiFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    let name = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32)
    // Discord требует минимум 2 символа в имени эмодзи
    if (name.length < 2) name = `emoji_${name || Date.now().toString(36).slice(-4)}`
    name = name.slice(0, 32)
    setError(null)
    setUploading(true)
    try {
      const { url } = await uploadFile(file)
      await createTemplateEmoji(templateId, { name, imageUrl: url })
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload emoji")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  async function handleDeleteEmoji(emojiId: string) {
    try {
      await deleteTemplateEmoji(templateId, emojiId)
      onUpdate()
    } catch {
      // silent
    }
  }

  // ——— Sticker upload ———
  const [stickerName, setStickerName] = useState("")
  const [stickerTags, setStickerTags] = useState("😀")
  const [stickerDesc, setStickerDesc] = useState("")

  async function handleStickerFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const name = stickerName.trim() || file.name.replace(/\.[^.]+$/, "").slice(0, 30)
    const tags = stickerTags.trim() || "😀"
    if (!name) return
    setError(null)
    setUploading(true)
    try {
      const { url } = await uploadFile(file)
      await createTemplateSticker(templateId, {
        name,
        tags,
        imageUrl: url,
        description: stickerDesc.trim() || null,
      })
      onUpdate()
      setStickerName("")
      setStickerDesc("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload sticker")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  async function handleDeleteSticker(stickerId: string) {
    try {
      await deleteTemplateSticker(templateId, stickerId)
      onUpdate()
    } catch {
      // silent
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smile className="h-5 w-5" />
          <CardTitle>Emojis and stickers</CardTitle>
        </div>
        <CardDescription>
          Upload images — when the template is installed, the bot will automatically add them to the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={tab === "emojis" ? "default" : "outline"}
            onClick={() => setTab("emojis")}
          >
            <Smile className="h-4 w-4 mr-1" />
            Emojis ({emojis.length})
          </Button>
          <Button
            size="sm"
            variant={tab === "stickers" ? "default" : "outline"}
            onClick={() => setTab("stickers")}
          >
            <Sticker className="h-4 w-4 mr-1" />
            Stickers ({stickers.length})
          </Button>
        </div>

        {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}

        {tab === "emojis" && (
          <div className="space-y-3">
            {emojis.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {emojis.map((em) => (
                  <div
                    key={em.id}
                    className="group relative flex flex-col items-center gap-1 p-2 rounded-lg border bg-[hsl(var(--muted)/0.3)]"
                  >
                    <img
                      src={em.imageUrl}
                      alt={em.name}
                      className="w-10 h-10 object-contain"
                    />
                    <span className="text-xs text-[hsl(var(--muted-foreground))] max-w-[80px] truncate">
                      :{em.name}:
                    </span>
                    <button
                      onClick={() => handleDeleteEmoji(em.id)}
                      className="absolute -top-1 -right-1 hidden group-hover:flex w-5 h-5 items-center justify-center rounded-full bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Button size="sm" variant="outline" asChild disabled={uploading}>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    {uploading ? "Uploading…" : "Upload emoji"}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/png,image/gif,image/webp,image/jpeg"
                  className="hidden"
                  onChange={handleEmojiFileSelect}
                  disabled={uploading}
                />
              </label>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                PNG, GIF or WebP. Max 256 KB, 128×128 px recommended. The name is taken from the file name.
              </p>
            </div>
          </div>
        )}

        {tab === "stickers" && (
          <div className="space-y-3">
            {stickers.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {stickers.map((st) => (
                  <div
                    key={st.id}
                    className="group relative flex flex-col items-center gap-1 p-2 rounded-lg border bg-[hsl(var(--muted)/0.3)]"
                  >
                    <img
                      src={st.imageUrl}
                      alt={st.name}
                      className="w-16 h-16 object-contain"
                    />
                    <span className="text-xs text-[hsl(var(--muted-foreground))] max-w-[100px] truncate">
                      {st.name}
                    </span>
                    <button
                      onClick={() => handleDeleteSticker(st.id)}
                      className="absolute -top-1 -right-1 hidden group-hover:flex w-5 h-5 items-center justify-center rounded-full bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-2 max-w-sm">
              <div className="grid gap-1">
                <Label className="text-xs">Sticker name</Label>
                <Input
                  value={stickerName}
                  onChange={(e) => setStickerName(e.target.value)}
                  placeholder="Sticker name (2-30 characters)"
                  maxLength={30}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Emoji tag</Label>
                <Input
                  value={stickerTags}
                  onChange={(e) => setStickerTags(e.target.value)}
                  placeholder="😀"
                  maxLength={32}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  value={stickerDesc}
                  onChange={(e) => setStickerDesc(e.target.value)}
                  placeholder="Sticker description"
                  maxLength={100}
                />
              </div>
            </div>

            <div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Button size="sm" variant="outline" asChild disabled={uploading || !stickerName.trim()}>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    {uploading ? "Uploading…" : "Upload sticker"}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/png,image/apng"
                  className="hidden"
                  onChange={handleStickerFileSelect}
                  disabled={uploading || !stickerName.trim()}
                />
              </label>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                PNG or APNG. Max 512 KB, 320×320 px. Provide name and tag before uploading.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Секция «Роли шаблона» — роли которые бот создаст на сервере при установке.
// Все эти роли автоматически окажутся НИЖЕ роли бота в иерархии → бот сможет
// выдавать их через кнопки авторолей без ошибок.
// ════════════════════════════════════════════════════════════════════════════

const ROLE_COLOR_PRESETS: { hex: string; label: string }[] = [
  { hex: "#99AAB5", label: "Gray (default)" },
  { hex: "#F04747", label: "Red" },
  { hex: "#E67E22", label: "Orange" },
  { hex: "#F1C40F", label: "Yellow" },
  { hex: "#2ECC71", label: "Green" },
  { hex: "#3498DB", label: "Blue" },
  { hex: "#9B59B6", label: "Purple" },
  { hex: "#E91E63", label: "Pink" },
]

function hexToInt(hex: string): number {
  return parseInt(hex.replace(/^#/, ""), 16) || 0
}
function intToHex(n: number | null | undefined): string {
  if (!n) return "#99AAB5"
  return "#" + n.toString(16).padStart(6, "0").toUpperCase()
}

function SectionRoles({
  templateId,
  roles,
  onUpdate,
}: {
  templateId: string
  roles: TemplateRole[]
  onUpdate: () => void
}) {
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#99AAB5")
  const [newHoist, setNewHoist] = useState(false)
  const [newMentionable, setNewMentionable] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    setError(null)
    try {
      await createTemplateRole(templateId, {
        name,
        color: hexToInt(newColor),
        hoist: newHoist,
        mentionable: newMentionable,
        position: roles.length,
      })
      setNewName("")
      setNewColor("#99AAB5")
      setNewHoist(false)
      setNewMentionable(false)
      onUpdate()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add role")
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(roleId: string) {
    if (!confirm("Delete role from template?")) return
    setDeletingId(roleId)
    try {
      await deleteTemplateRole(templateId, roleId)
      onUpdate()
    } catch {
      // silent
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template roles</CardTitle>
        <CardDescription>
          Roles the bot will create when installing the template on a server. All these roles will end
          up <b>below the bot role</b>, so auto-role buttons can assign them. These same roles will
          appear in the role dropdown when configuring buttons in the "Auto-roles" section below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {roles.length > 0 && (
          <div className="space-y-2">
            {roles.map((r) => {
              const hex = intToHex(r.color)
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-[hsl(var(--muted)/0.2)]"
                >
                  <span
                    className="inline-block w-4 h-4 rounded-full shrink-0 border"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="text-sm font-medium flex-1 truncate">{r.name}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                    {r.hoist ? "• hoisted" : ""} {r.mentionable ? "• mentionable" : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <div className="rounded-lg border border-dashed p-3 space-y-3">
          <p className="text-sm font-medium">Add role</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <Label className="text-xs">Role name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Adventurer"
                maxLength={100}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {ROLE_COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setNewColor(c.hex)}
                    title={c.label}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform",
                      newColor === c.hex
                        ? "border-[hsl(var(--foreground))] scale-110"
                        : "border-transparent hover:border-[hsl(var(--border))]",
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border"
                  title="Custom color"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={newHoist}
                onChange={(e) => setNewHoist(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Display separately in role list
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={newMentionable}
                onChange={(e) => setNewMentionable(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Mentionable (@role)
            </label>
          </div>
          {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
          <Button size="sm" onClick={() => void handleAdd()} disabled={adding || !newName.trim()}>
            {adding ? "Adding…" : "Add role"}
          </Button>
        </div>

        {roles.length === 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            No roles yet. Add roles above — they will appear in the role dropdown for auto-role buttons.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Секция «Настройки прав» — какие категории открыть для верификационной роли.
// Используется первая роль из секции «Роли шаблона». Для выбранных категорий
// бот при установке выставит: @everyone — запрет ViewChannel, верификационная
// роль — разрешение View + Send + ReadHistory. Остальные категории не трогает.
// ════════════════════════════════════════════════════════════════════════════

function SectionCategoryGrants({
  templateId,
  categories,
  grants,
  onUpdate,
}: {
  templateId: string
  categories: TemplateCategory[]
  grants: TemplateCategoryGrant[]
  onUpdate: () => void
}) {
  const [selected, setSelected] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Доступны для добавления — те категории, которые ещё не в grants
  const grantedNames = new Set(grants.map((g) => g.categoryName))
  const available = categories.filter((c) => !grantedNames.has(c.name))

  async function handleAdd() {
    const name = selected.trim()
    if (!name) return
    setAdding(true)
    setError(null)
    try {
      await createTemplateCategoryGrant(templateId, { categoryName: name })
      setSelected("")
      onUpdate()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add")
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(grantId: string) {
    if (!confirm("Remove category from the list?")) return
    setDeletingId(grantId)
    try {
      await deleteTemplateCategoryGrant(templateId, grantId)
      onUpdate()
    } catch {
      // silent
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissions setup</CardTitle>
        <CardDescription>
          Pick template categories that should be opened for the <b>verification role</b>
          (the first role from the "Template roles" section). On install the bot will:
          <br />• deny @everyone the View Channel permission in these categories
          <br />• allow the verification role View / Send / Read History
          <br />Categories not in this list are left untouched. The binding is stored by{" "}
          <b>category name</b>, not Discord ID — so it works on any new server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {grants.length > 0 && (
          <div className="space-y-2">
            {grants.map((g) => {
              const exists = categories.some((c) => c.name === g.categoryName)
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-[hsl(var(--muted)/0.2)]"
                >
                  <span className="text-sm font-medium flex-1 truncate">{g.categoryName}</span>
                  {!exists && (
                    <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]">
                      no such category in the template
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleDelete(g.id)}
                    disabled={deletingId === g.id}
                    className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <div className="rounded-lg border border-dashed p-3 space-y-3">
          <p className="text-sm font-medium">Add category</p>
          {categories.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              First add categories to the template (via the channels/categories section).
            </p>
          ) : available.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              All template categories are already added.
            </p>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1 grid gap-1">
                <Label className="text-xs">Category</Label>
                <Select value={selected || "__none__"} onValueChange={(v) => setSelected(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not selected</SelectItem>
                    {available.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={() => void handleAdd()} disabled={adding || !selected}>
                {adding ? "Adding…" : "Add"}
              </Button>
            </div>
          )}
          {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
        </div>
      </CardContent>
    </Card>
  )
}


// ════════════════════════════════════════════════════════════════════════════
// Секция «Категории шаблона» — категории, которые бот создаст при установке
// (используются для группировки каналов и для настройки прав верификации).
// ════════════════════════════════════════════════════════════════════════════

function SectionCategories({
  templateId,
  categories,
  onUpdate,
}: {
  templateId: string
  categories: TemplateCategory[]
  onUpdate: () => void
}) {
  const [newName, setNewName] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    setError(null)
    try {
      await createTemplateCategory(templateId, { name, position: categories.length })
      setNewName("")
      onUpdate()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add")
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(catId: string) {
    if (!confirm("Delete category from template?")) return
    setDeletingId(catId)
    try {
      await deleteTemplateCategory(templateId, catId)
      onUpdate()
    } catch {
      // silent
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template categories</CardTitle>
        <CardDescription>
          Categories the bot will create when installing the template. Names must match category names
          from the Discord template (if you use one) — otherwise the permissions setup below will have
          no matches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.length > 0 && (
          <div className="space-y-2">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-[hsl(var(--muted)/0.2)]"
              >
                <span className="text-sm font-medium flex-1 truncate">{c.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-dashed p-3 space-y-3">
          <p className="text-sm font-medium">Add category</p>
          <div className="flex items-end gap-2">
            <div className="flex-1 grid gap-1">
              <Label className="text-xs">Category name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Verification"
                maxLength={100}
              />
            </div>
            <Button size="sm" onClick={() => void handleAdd()} disabled={adding || !newName.trim()}>
              {adding ? "Adding…" : "Add"}
            </Button>
          </div>
          {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// «Verification Category» — одна категория + одна роль.
// Бот при установке выставит deny ViewChannel для выбранной роли на этой
// категории и всех каналах внутри. Используется для канала верификации,
// который должен исчезать после получения роли.
// ════════════════════════════════════════════════════════════════════════════

function SectionVerifyHide({
  templateId,
  categories,
  roles,
  currentCategoryName,
  currentRoleName,
  onUpdate,
}: {
  templateId: string
  categories: TemplateCategory[]
  roles: TemplateRole[]
  currentCategoryName: string | null
  currentRoleName: string | null
  onUpdate: () => void
}) {
  const [categoryName, setCategoryName] = useState(currentCategoryName ?? "")
  const [roleName, setRoleName] = useState(currentRoleName ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    setCategoryName(currentCategoryName ?? "")
    setRoleName(currentRoleName ?? "")
  }, [currentCategoryName, currentRoleName])

  async function handleSave() {
    setError(null)
    setSavedMsg(null)
    setSaving(true)
    try {
      const updated = await updateServerTemplate(templateId, {
        verifiedHideCategoryName: categoryName.trim() || null,
        verifiedHideRoleName: roleName.trim() || null,
      })
      onUpdate()
      setSavedMsg("Saved")
      setTimeout(() => setSavedMsg(null), 2000)
      void updated
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setCategoryName("")
    setRoleName("")
    setError(null)
    setSaving(true)
    try {
      await updateServerTemplate(templateId, {
        verifiedHideCategoryName: null,
        verifiedHideRoleName: null,
      })
      onUpdate()
      setSavedMsg("Cleared")
      setTimeout(() => setSavedMsg(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification Category</CardTitle>
        <CardDescription>
          Pick one category and one role — when the template is installed, the bot will
          <b> hide that category and all its channels from the chosen role</b> (deny ViewChannel).
          Useful for a verification channel: visible to everyone, then disappears after the user
          gets the verification role. Binding by name, not Discord ID.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1">
            <Label className="text-xs">Category to hide</Label>
            {categories.length === 0 ? (
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g. Verification"
              />
            ) : (
              <Select
                value={categoryName || "__none__"}
                onValueChange={(v) => setCategoryName(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not selected</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Role that won't see the category</Label>
            {roles.length === 0 ? (
              <Input
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Verified"
              />
            ) : (
              <Select
                value={roleName || "__none__"}
                onValueChange={(v) => setRoleName(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not selected</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || (!categoryName.trim() && !roleName.trim())}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          {(currentCategoryName || currentRoleName) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void handleClear()}
              disabled={saving}
              className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
            >
              Clear
            </Button>
          )}
          {savedMsg && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{savedMsg}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
