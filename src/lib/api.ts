/** Базовый URL API. По умолчанию "/api" (тот же origin). Для деплоя на другой домен задать VITE_API_URL, например https://api.example.com/api */
const API_BASE = import.meta.env.VITE_API_URL ?? "/api"

const fetchOptions: RequestInit = {
  credentials: "include",
  headers: { "Content-Type": "application/json" },
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
  const data = await res.json().catch(() => ({}))
  const message = typeof data.message === "string" ? data.message : fallback
  throw new ApiError(res.status, message)
}

export type User = {
  id: string
  username: string
  role?: "admin" | "customer"
  discriminator?: string
  avatar?: string
}

export type Guild = {
  id: string
  name: string
  icon: string | null
  permissions: string
  owner: boolean
}

export type Channel = {
  id: string
  name: string
  type: number
}

export type Template = {
  id: string
  guildId: string
  name: string
  title: string | null
  description: string | null
  image: string | null
  createdAt: string
  updatedAt: string
}

export async function getMe(): Promise<User | null> {
  const res = await fetch(`${API_BASE}/auth/me`, { ...fetchOptions, method: "GET" })
  if (res.status === 401) return null
  if (!res.ok) throw new Error("Failed to fetch user")
  return res.json()
}

export async function getGuilds(options?: { forceRefresh?: boolean }): Promise<Guild[]> {
  const qs = options?.forceRefresh ? "?refresh=1" : ""
  const res = await fetch(`${API_BASE}/guilds${qs}`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to fetch guilds")
  return res.json()
}

export async function getChannels(guildId: string): Promise<Channel[]> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/channels`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch channels")
  return res.json()
}

/** Multipart POST, поле `file`. Нужен публичный PUBLIC_BASE_URL на бэке, иначе url может быть localhost — Discord картинку не откроет. */
export async function uploadFile(file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/uploads`, {
    method: "POST",
    body: formData,
    credentials: "include",
  })
  if (!res.ok) await throwApiError(res, "File upload error")
  const data = (await res.json()) as { url?: string }
  if (typeof data.url !== "string") throw new Error("Upload response missing url field")
  return { url: data.url }
}

export async function previewTemplateMessage(
  guildId: string,
  body: { channelId: string; content?: string; embedJson?: string; componentsJson?: string }
): Promise<void> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/preview-template-message`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to send preview to channel")
}

export async function sendMessage(
  guildId: string,
  body: { channelId: string; title?: string; description?: string; image?: string }
): Promise<void> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/send`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to send message")
}

export async function getTemplates(guildId: string): Promise<Template[]> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/templates`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch templates")
  return res.json()
}

export async function getTemplate(guildId: string, templateId: string): Promise<Template> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/templates/${templateId}`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch template")
  return res.json()
}

export async function createTemplate(
  guildId: string,
  body: { name: string; title?: string | null; description?: string | null; image?: string | null }
): Promise<Template> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/templates`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to create template")
  return res.json()
}

export async function updateTemplate(
  guildId: string,
  templateId: string,
  body: Partial<{ name: string; title: string | null; description: string | null; image: string | null }>
): Promise<Template> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/templates/${templateId}`, {
    ...fetchOptions,
    method: "PATCH",
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update template")
  return res.json()
}

export async function deleteTemplate(guildId: string, templateId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/templates/${templateId}`, {
    ...fetchOptions,
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete template")
}

export async function sendFromTemplate(
  guildId: string,
  templateId: string,
  channelId: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/templates/${templateId}/send`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify({ channelId }),
  })
  if (!res.ok) throw new Error("Failed to send from template")
}

// ——— Логи ———
export type LogsType = "joinLeave" | "messages" | "moderation" | "channel" | "banKick"

export type GuildLogs = {
  joinLeave?: string | null
  messages?: string | null
  moderation?: string | null
  channel?: string | null
  banKick?: string | null
}

export async function getLogs(guildId: string): Promise<GuildLogs> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/logs`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch logs")
  return res.json()
}

export async function updateLogsChannel(
  guildId: string,
  body: { type: LogsType; channelId: string | null }
): Promise<GuildLogs> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/logs`, {
    ...fetchOptions,
    method: "PATCH",
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update logs")
  return res.json()
}

export type LogEvent = {
  id: string
  guildId: string
  type: LogsType
  kind: string
  payload: Record<string, unknown>
  createdAt: string
}

export async function getLogEvents(
  guildId: string,
  params?: { limit?: number; before?: string }
): Promise<{ events: LogEvent[] }> {
  const sp = new URLSearchParams()
  if (params?.limit != null) sp.set("limit", String(params.limit))
  if (params?.before != null) sp.set("before", params.before)
  const q = sp.toString()
  const url = `${API_BASE}/guilds/${guildId}/logs/events${q ? `?${q}` : ""}`
  const res = await fetch(url, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch log events")
  return res.json()
}

// ——— Роли по реакции ———
export type GuildRole = { id: string; name: string }

export type ReactionRoleBinding = {
  messageId: string
  channelId?: string
  roles: { emojiKey: string; roleId: string }[]
}

export type ReactionRolesResponse = {
  bindings: ReactionRoleBinding[]
}

export async function getGuildRoles(guildId: string): Promise<GuildRole[]> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/roles`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch roles")
  return res.json()
}

export async function getReactionRoles(guildId: string): Promise<ReactionRolesResponse> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/reaction-roles`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch reaction roles")
  return res.json()
}

export async function addReactionRoleBinding(
  guildId: string,
  body: { channelId: string; messageId: string; emoji: string; roleId: string }
): Promise<void> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/reaction-roles`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data.message === "string" ? data.message : "Failed to add binding")
  }
}

export async function removeReactionRole(
  guildId: string,
  body: { messageId: string; emojiKey: string }
): Promise<void> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/reaction-roles/remove`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to remove reaction role")
}

// ——— Шаблоны сервера (развёртывание и редактор) ———
export type ServerTemplate = {
  id: string
  name: string
  description: string | null
  /**
   * Ссылка на Discord‑шаблон сервера (если используется развёртывание через нативные шаблоны Discord)
   */
  discordTemplateUrl: string | null
  /** URL иконки сервера (бот установит её при развёртывании) */
  iconUrl: string | null
  /** Включить статистику сервера (4 канала-счётчика) при установке */
  enableServerStats?: boolean
  /** Шаблоны имён для ServerStats — `{count}` заменяется на число */
  statsCategoryName?: string | null
  statsTotalName?: string | null
  statsHumansName?: string | null
  statsBotsName?: string | null
  statsOnlineName?: string | null
  /** Verification: category name to hide from the role */
  verifiedHideCategoryName?: string | null
  /** Verification: role name that won't see the category */
  verifiedHideRoleName?: string | null
  createdAt: string
}

export type TemplateRole = {
  id: string
  name: string
  color?: number | null
  permissions?: string | null
  position?: number | null
  hoist?: boolean | null
  mentionable?: boolean | null
}

export type TemplateCategory = {
  id: string
  name: string
  position?: number | null
}

export type TemplateChannel = {
  id: string
  name: string
  categoryName?: string | null
  type?: number | null
  topic?: string | null
  position?: number | null
  permissionOverwrites?: Array<{ roleName: string; allow: string; deny: string }> | null
}

export type TemplateMessage = {
  id: string
  channelName: string
  messageOrder?: number | null
  content?: string | null
  embedJson?: string | null
  componentsJson?: string | null
}

export type TemplateReactionRole = {
  id: string
  channelName: string
  messageOrder?: number | null
  emojiKey: string
  roleName: string
}

export type TemplateLogChannel = {
  id: string
  logType: string
  channelName: string
}

export type TemplateEmoji = {
  id: string
  name: string
  imageUrl: string
}

export type TemplateSticker = {
  id: string
  name: string
  tags: string
  imageUrl: string
  description?: string | null
}

export type TemplateCategoryGrant = {
  id: string
  categoryName: string
}

export type TemplateWelcomeVariant = VariantImageFields & {
  id: string
  templateId: string
  role: WelcomeVariantRole
  text: string
  orderIndex: number
  buttonsConfig: WelcomeButton[] | null
}

export type TemplateGoodbyeVariant = VariantImageFields & {
  id: string
  templateId: string
  text: string
  orderIndex: number
}

export type ServerTemplateDetail = ServerTemplate & {
  roles: TemplateRole[]
  categories: TemplateCategory[]
  channels: TemplateChannel[]
  messages: TemplateMessage[]
  reactionRoles: TemplateReactionRole[]
  logChannels: TemplateLogChannel[]
  emojis: TemplateEmoji[]
  stickers: TemplateSticker[]
  categoryGrants?: TemplateCategoryGrant[]
  welcomeVariants?: TemplateWelcomeVariant[]
  goodbyeVariants?: TemplateGoodbyeVariant[]
  // template-level config (mirrors ServerTemplate columns)
  welcomeEnabled?: boolean
  welcomeSendMode?: "channel" | "dm"
  welcomeChannelName?: string | null
  welcomeReturningEnabled?: boolean
  goodbyeEnabled?: boolean
  goodbyeChannelName?: string | null
}

const ST = `${API_BASE}/server-templates`
const st = (id: string) => `${ST}/${id}`

export async function getServerTemplates(): Promise<ServerTemplate[]> {
  const res = await fetch(ST, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch server templates")
  return res.json()
}

export async function getServerTemplate(id: string): Promise<ServerTemplateDetail> {
  const res = await fetch(st(id), { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch template")
  return res.json()
}

export async function createServerTemplate(body: {
  name: string
  description?: string | null
  discordTemplateUrl?: string | null
  iconUrl?: string | null
}): Promise<ServerTemplate> {
  const res = await fetch(ST, { ...fetchOptions, method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to create template")
  return res.json()
}

export async function updateServerTemplate(
  id: string,
  body: {
    name?: string
    description?: string | null
    discordTemplateUrl?: string | null
    iconUrl?: string | null
    enableServerStats?: boolean
    statsCategoryName?: string | null
    statsTotalName?: string | null
    statsHumansName?: string | null
    statsBotsName?: string | null
    statsOnlineName?: string | null
    verifiedHideCategoryName?: string | null
    verifiedHideRoleName?: string | null
    welcomeEnabled?: boolean
    welcomeSendMode?: "channel" | "dm"
    welcomeChannelName?: string | null
    welcomeReturningEnabled?: boolean
    goodbyeEnabled?: boolean
    goodbyeChannelName?: string | null
  }
): Promise<ServerTemplate> {
  const res = await fetch(st(id), { ...fetchOptions, method: "PATCH", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to update template")
  return res.json()
}

export async function deleteServerTemplate(id: string): Promise<void> {
  const res = await fetch(st(id), { ...fetchOptions, method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete template")
}

// Роли шаблона
export async function getTemplateRoles(templateId: string): Promise<TemplateRole[]> {
  const res = await fetch(`${st(templateId)}/roles`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch roles")
  return res.json()
}

export async function createTemplateRole(
  templateId: string,
  body: { name: string; color?: number; permissions?: string; position?: number; hoist?: boolean; mentionable?: boolean }
): Promise<TemplateRole> {
  const res = await fetch(`${st(templateId)}/roles`, { ...fetchOptions, method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to create role")
  return res.json()
}

export async function updateTemplateRole(
  templateId: string,
  roleId: string,
  body: Partial<{ name: string; color: number; permissions: string; position: number; hoist: boolean; mentionable: boolean }>
): Promise<TemplateRole> {
  const res = await fetch(`${st(templateId)}/roles/${roleId}`, { ...fetchOptions, method: "PATCH", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to update role")
  return res.json()
}

export async function deleteTemplateRole(templateId: string, roleId: string): Promise<void> {
  const res = await fetch(`${st(templateId)}/roles/${roleId}`, { ...fetchOptions, method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete role")
}

// Категории
export async function getTemplateCategories(templateId: string): Promise<TemplateCategory[]> {
  const res = await fetch(`${st(templateId)}/categories`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch categories")
  return res.json()
}

export async function createTemplateCategory(
  templateId: string,
  body: { name: string; position?: number }
): Promise<TemplateCategory> {
  const res = await fetch(`${st(templateId)}/categories`, { ...fetchOptions, method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to create category")
  return res.json()
}

export async function updateTemplateCategory(
  templateId: string,
  categoryId: string,
  body: { name?: string; position?: number }
): Promise<TemplateCategory> {
  const res = await fetch(`${st(templateId)}/categories/${categoryId}`, { ...fetchOptions, method: "PATCH", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to update category")
  return res.json()
}

export async function deleteTemplateCategory(templateId: string, categoryId: string): Promise<void> {
  const res = await fetch(`${st(templateId)}/categories/${categoryId}`, { ...fetchOptions, method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete category")
}

// Каналы
export async function getTemplateChannels(templateId: string): Promise<TemplateChannel[]> {
  const res = await fetch(`${st(templateId)}/channels`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch channels")
  return res.json()
}

export async function createTemplateChannel(
  templateId: string,
  body: {
    name: string
    categoryName?: string
    type?: number
    topic?: string
    position?: number
    permissionOverwrites?: Array<{ roleName: string; allow: string; deny: string }>
  }
): Promise<TemplateChannel> {
  const res = await fetch(`${st(templateId)}/channels`, { ...fetchOptions, method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to create channel")
  return res.json()
}

export async function updateTemplateChannel(
  templateId: string,
  channelId: string,
  body: Partial<{ name: string; categoryName: string; type: number; topic: string; position: number; permissionOverwrites: Array<{ roleName: string; allow: string; deny: string }> }>
): Promise<TemplateChannel> {
  const res = await fetch(`${st(templateId)}/channels/${channelId}`, { ...fetchOptions, method: "PATCH", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to update channel")
  return res.json()
}

export async function deleteTemplateChannel(templateId: string, channelId: string): Promise<void> {
  const res = await fetch(`${st(templateId)}/channels/${channelId}`, { ...fetchOptions, method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete channel")
}

// Сообщения
export async function getTemplateMessages(templateId: string): Promise<TemplateMessage[]> {
  const res = await fetch(`${st(templateId)}/messages`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch messages")
  return res.json()
}

export async function createTemplateMessage(
  templateId: string,
  body: { channelName: string; messageOrder?: number; content?: string; embedJson?: string; componentsJson?: string }
): Promise<TemplateMessage> {
  const res = await fetch(`${st(templateId)}/messages`, { ...fetchOptions, method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to create message")
  return res.json()
}

export async function updateTemplateMessage(
  templateId: string,
  messageId: string,
  body: Partial<{ channelName: string; messageOrder: number; content: string; embedJson: string; componentsJson: string }>
): Promise<TemplateMessage> {
  const res = await fetch(`${st(templateId)}/messages/${messageId}`, { ...fetchOptions, method: "PATCH", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to update message")
  return res.json()
}

export async function deleteTemplateMessage(templateId: string, messageId: string): Promise<void> {
  const res = await fetch(`${st(templateId)}/messages/${messageId}`, { ...fetchOptions, method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete message")
}

// Автороли шаблона
export async function getTemplateReactionRoles(templateId: string): Promise<TemplateReactionRole[]> {
  const res = await fetch(`${st(templateId)}/reaction-roles`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch reaction roles")
  return res.json()
}

export async function createTemplateReactionRole(
  templateId: string,
  body: { channelName: string; messageOrder?: number; emojiKey: string; roleName: string }
): Promise<TemplateReactionRole> {
  const res = await fetch(`${st(templateId)}/reaction-roles`, { ...fetchOptions, method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to create reaction role")
  return res.json()
}

export async function updateTemplateReactionRole(
  templateId: string,
  rrId: string,
  body: Partial<{ channelName: string; messageOrder: number; emojiKey: string; roleName: string }>
): Promise<TemplateReactionRole> {
  const res = await fetch(`${st(templateId)}/reaction-roles/${rrId}`, { ...fetchOptions, method: "PATCH", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to update reaction role")
  return res.json()
}

export async function deleteTemplateReactionRole(templateId: string, rrId: string): Promise<void> {
  const res = await fetch(`${st(templateId)}/reaction-roles/${rrId}`, { ...fetchOptions, method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete reaction role")
}

// Лог-каналы шаблона
export const LOG_TYPES = ["joinLeave", "messages", "moderation", "channel", "banKick"] as const
export type TemplateLogType = (typeof LOG_TYPES)[number]

export async function getTemplateLogChannels(templateId: string): Promise<TemplateLogChannel[]> {
  const res = await fetch(`${st(templateId)}/log-channels`, { ...fetchOptions, method: "GET" })
  if (!res.ok) throw new Error("Failed to fetch log channels")
  return res.json()
}

export async function createTemplateLogChannel(
  templateId: string,
  body: { logType: TemplateLogType; channelName: string }
): Promise<TemplateLogChannel> {
  const res = await fetch(`${st(templateId)}/log-channels`, { ...fetchOptions, method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to create log channel")
  return res.json()
}

export async function updateTemplateLogChannel(
  templateId: string,
  lcId: string,
  body: { logType?: TemplateLogType; channelName?: string }
): Promise<TemplateLogChannel> {
  const res = await fetch(`${st(templateId)}/log-channels/${lcId}`, { ...fetchOptions, method: "PATCH", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to update log channel")
  return res.json()
}

export async function deleteTemplateLogChannel(templateId: string, lcId: string): Promise<void> {
  const res = await fetch(`${st(templateId)}/log-channels/${lcId}`, { ...fetchOptions, method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete log channel")
}

// ——— Emojis ———
export async function createTemplateEmoji(
  templateId: string,
  body: { name: string; imageUrl: string }
): Promise<TemplateEmoji> {
  const res = await fetch(`${st(templateId)}/emojis`, { ...fetchOptions, method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to create emoji")
  return res.json()
}

export async function deleteTemplateEmoji(templateId: string, emojiId: string): Promise<void> {
  const res = await fetch(`${st(templateId)}/emojis/${emojiId}`, { ...fetchOptions, method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete emoji")
}

// ——— Stickers ———
export async function createTemplateSticker(
  templateId: string,
  body: { name: string; tags: string; imageUrl: string; description?: string | null }
): Promise<TemplateSticker> {
  const res = await fetch(`${st(templateId)}/stickers`, { ...fetchOptions, method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to create sticker")
  return res.json()
}

export async function deleteTemplateSticker(templateId: string, stickerId: string): Promise<void> {
  const res = await fetch(`${st(templateId)}/stickers/${stickerId}`, { ...fetchOptions, method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete sticker")
}

// ——— Category grants (привязка категорий к роли верификации) ———
export async function createTemplateCategoryGrant(
  templateId: string,
  body: { categoryName: string }
): Promise<TemplateCategoryGrant> {
  const res = await fetch(`${st(templateId)}/category-grants`, { ...fetchOptions, method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to add category grant")
  return res.json()
}

export async function deleteTemplateCategoryGrant(templateId: string, grantId: string): Promise<void> {
  const res = await fetch(`${st(templateId)}/category-grants/${grantId}`, { ...fetchOptions, method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete category grant")
}

export async function installServerTemplate(
  guildId: string,
  templateId: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/install-template`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify({ templateId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data.message === "string" ? data.message : "Template install error")
  }
}

export type StoreCategory =
  | "gaming"
  | "community"
  | "anime"
  | "crypto"
  | "streaming"
  | "other"

export type StoreSort = "newest" | "popular" | "price_asc" | "price_desc"

export type StoreTemplateProduct = {
  id?: string
  templateId: string
  name: string
  description: string | null
  discordTemplateUrl: string | null
  iconUrl?: string | null
  price: number
  currency: string
  isActive?: boolean
  longDescription?: string | null
  category?: StoreCategory | null
  tags?: string[]
  screenshots?: string[]
  featured?: boolean
  featuredOrder?: number
  purchaseCount?: number
  template?: {
    id: string
    name: string
    description: string | null
    discordTemplateUrl: string | null
    iconUrl?: string | null
  } | null
}

export type StoreListResponse = {
  total: number
  items: StoreTemplateProduct[]
}

export type StoreContents = {
  roles: number
  categories: number
  channels: number
  messages: number
  reactionRoles: number
  emojis: number
  stickers: number
  welcomeVariants: number
  goodbyeVariants: number
  serverStatsEnabled: boolean
  levelingEnabled: boolean
  welcomeEnabled: boolean
  goodbyeEnabled: boolean
}

export type StoreFacets = {
  categories: { category: StoreCategory; count: number }[]
  tags: { tag: string; count: number }[]
}

export type StoreFilters = {
  q?: string
  category?: StoreCategory
  tags?: string[]
  sort?: StoreSort
  limit?: number
  offset?: number
}

/** Per-user template access record (purchases history with usage tracking) */
export type MyTemplateAccess = {
  grantedAt: string
  installedAt: string | null
  installedGuildId: string | null
  usageType: "oneShot" | "multi"
  pricePaid: number | null
  currency: string | null
}

export type MyTemplateRow = ServerTemplate & {
  access: MyTemplateAccess | null
}

export type Purchase = {
  id: string
  templateId: string
  templateName?: string
  amount?: number
  currency?: string
  createdAt: string
}

export type InstallCheckResult = {
  warnings?: string[]
  checks?: {
    missingChannels?: string[]
    missingRoles?: string[]
    missingMessages?: string[]
    missingLogChannels?: string[]
  }
}

export type InstallApplyResult = {
  ok?: boolean
  error?: string
  errors?: string[]
  summary?: Record<string, number>
  skipped?: Record<string, string[]>
  warnings?: string[]
}

/**
 * Normalise the backend StoreTemplate shape. The row pulls scalars from
 * `store_templates`, but `name/description/iconUrl` live on the joined
 * `ServerTemplate` (`item.template`). We surface both flat scalars and the
 * nested `template` object so callers can pick whichever is convenient.
 */
function normaliseProduct(item: any): StoreTemplateProduct {
  const nested = item?.template ?? null
  return {
    id: typeof item?.id === "string" ? item.id : undefined,
    templateId:
      typeof item?.templateId === "string" ? item.templateId : (nested?.id ?? ""),
    name:
      typeof nested?.name === "string"
        ? nested.name
        : typeof item?.name === "string"
          ? item.name
          : "Untitled",
    description:
      typeof nested?.description === "string"
        ? nested.description
        : typeof item?.description === "string"
          ? item.description
          : null,
    discordTemplateUrl:
      typeof nested?.discordTemplateUrl === "string"
        ? nested.discordTemplateUrl
        : typeof item?.discordTemplateUrl === "string"
          ? item.discordTemplateUrl
          : null,
    iconUrl:
      typeof nested?.iconUrl === "string" ? nested.iconUrl :
      typeof item?.iconUrl === "string" ? item.iconUrl : null,
    price: typeof item?.price === "number" ? item.price : 0,
    currency: typeof item?.currency === "string" ? item.currency : "USD",
    isActive: typeof item?.isActive === "boolean" ? item.isActive : undefined,
    longDescription: typeof item?.longDescription === "string" ? item.longDescription : null,
    category: item?.category ?? null,
    tags: Array.isArray(item?.tags) ? item.tags : [],
    screenshots: Array.isArray(item?.screenshots) ? item.screenshots : [],
    featured: Boolean(item?.featured),
    featuredOrder: typeof item?.featuredOrder === "number" ? item.featuredOrder : 0,
    purchaseCount: typeof item?.purchaseCount === "number" ? item.purchaseCount : 0,
    template: nested,
  }
}

export async function getStoreTemplates(filters: StoreFilters = {}): Promise<StoreListResponse> {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  if (filters.category) params.set("category", filters.category)
  if (filters.tags?.length) params.set("tags", filters.tags.join(","))
  if (filters.sort) params.set("sort", filters.sort)
  if (filters.limit !== undefined) params.set("limit", String(filters.limit))
  if (filters.offset !== undefined) params.set("offset", String(filters.offset))
  const qs = params.toString() ? `?${params.toString()}` : ""
  const res = await fetch(`${API_BASE}/store/templates${qs}`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to fetch store templates")
  const raw = await res.json()
  const items = Array.isArray(raw?.items) ? raw.items.map(normaliseProduct) : []
  const total = typeof raw?.total === "number" ? raw.total : items.length
  return { total, items }
}

export async function getStoreFeatured(): Promise<StoreTemplateProduct[]> {
  const res = await fetch(`${API_BASE}/store/templates/featured`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to fetch featured products")
  const raw = await res.json()
  return Array.isArray(raw) ? raw.map(normaliseProduct) : []
}

export async function getStoreFacets(): Promise<StoreFacets> {
  const res = await fetch(`${API_BASE}/store/templates/facets`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to fetch facets")
  const raw = await res.json()
  return {
    categories: Array.isArray(raw?.categories) ? raw.categories : [],
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
  }
}

export async function getStoreProduct(storeTemplateId: string): Promise<{
  product: StoreTemplateProduct
  contents: StoreContents | null
}> {
  const res = await fetch(`${API_BASE}/store/templates/${storeTemplateId}`, {
    ...fetchOptions,
    method: "GET",
  })
  if (!res.ok) await throwApiError(res, "Failed to fetch product")
  const raw = await res.json()
  return {
    product: normaliseProduct(raw?.product ?? {}),
    contents: raw?.contents ?? null,
  }
}

// ── Admin ──

export async function adminListStoreTemplates(): Promise<StoreTemplateProduct[]> {
  const res = await fetch(`${API_BASE}/admin/store/templates`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to load admin store list")
  const raw = await res.json()
  return Array.isArray(raw) ? raw.map(normaliseProduct) : []
}

export async function adminUpsertStoreTemplate(body: {
  templateId: string
  price?: number
  currency?: string
  isActive?: boolean
  longDescription?: string | null
  category?: StoreCategory | null
  tags?: string[]
  screenshots?: string[]
  featured?: boolean
  featuredOrder?: number
}): Promise<StoreTemplateProduct> {
  const res = await fetch(`${API_BASE}/admin/store/templates/upsert`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to save store product")
  return normaliseProduct(await res.json())
}

export async function checkoutTemplate(templateId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/store/checkout`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify({ templateId }),
  })
  if (!res.ok) await throwApiError(res, "Checkout failed")
}

export async function getMyPurchases(): Promise<Purchase[]> {
  const res = await fetch(`${API_BASE}/store/my-purchases`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to fetch purchases")
  return res.json()
}

export async function getMyServerTemplates(): Promise<MyTemplateRow[]> {
  const res = await fetch(`${API_BASE}/my/server-templates`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to fetch my templates")
  return res.json()
}

export async function checkInstallServerTemplate(
  guildId: string,
  templateId: string
): Promise<InstallCheckResult> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/install-template/check`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify({ templateId }),
  })
  if (!res.ok) await throwApiError(res, "Install check failed")
  return res.json()
}

export async function installServerTemplateWithResult(
  guildId: string,
  templateId: string
): Promise<InstallApplyResult> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/install-template`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify({ templateId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, typeof data.message === "string" ? data.message : "Install failed")
  return data
}

/**
 * Пытается поднять роль бота на сервере автоматически через OAuth пользователя.
 * Если Discord отклоняет — вернёт { ok: false, needsManual: true }.
 */
export async function liftBotRole(
  guildId: string
): Promise<{ ok: boolean; needsManual?: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/lift-bot-role`, {
    ...fetchOptions,
    method: "POST",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok && res.status !== 200) {
    return { ok: false, needsManual: true, message: (data as { message?: string })?.message ?? "Error" }
  }
  return data
}

export async function adminGrantTemplateAccess(body: {
  userId: string
  templateId: string
}): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/template-access`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to grant access")
}

export async function adminRevokeTemplateAccess(userId: string, templateId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/template-access/${userId}/${templateId}`, {
    ...fetchOptions,
    method: "DELETE",
  })
  if (!res.ok) await throwApiError(res, "Failed to revoke access")
}

// ─── Server template welcome/goodbye variants ──────────────────────────────

export type TemplateVariantBody = Partial<VariantImageFields> & {
  text: string
  orderIndex?: number
  role?: WelcomeVariantRole
  buttonsConfig?: WelcomeButton[] | null
}

export async function createTemplateWelcomeVariant(
  templateId: string,
  body: TemplateVariantBody,
): Promise<TemplateWelcomeVariant> {
  const res = await fetch(`${st(templateId)}/welcome-variants`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to create welcome variant")
  return res.json()
}

export async function updateTemplateWelcomeVariant(
  templateId: string,
  vId: string,
  body: Partial<TemplateVariantBody>,
): Promise<TemplateWelcomeVariant> {
  const res = await fetch(`${st(templateId)}/welcome-variants/${vId}`, {
    ...fetchOptions,
    method: "PATCH",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to update welcome variant")
  return res.json()
}

export async function deleteTemplateWelcomeVariant(
  templateId: string,
  vId: string,
): Promise<void> {
  const res = await fetch(`${st(templateId)}/welcome-variants/${vId}`, {
    ...fetchOptions,
    method: "DELETE",
  })
  if (!res.ok) await throwApiError(res, "Failed to delete welcome variant")
}

export async function createTemplateGoodbyeVariant(
  templateId: string,
  body: TemplateVariantBody,
): Promise<TemplateGoodbyeVariant> {
  const res = await fetch(`${st(templateId)}/goodbye-variants`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to create goodbye variant")
  return res.json()
}

export async function updateTemplateGoodbyeVariant(
  templateId: string,
  vId: string,
  body: Partial<TemplateVariantBody>,
): Promise<TemplateGoodbyeVariant> {
  const res = await fetch(`${st(templateId)}/goodbye-variants/${vId}`, {
    ...fetchOptions,
    method: "PATCH",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to update goodbye variant")
  return res.json()
}

export async function deleteTemplateGoodbyeVariant(
  templateId: string,
  vId: string,
): Promise<void> {
  const res = await fetch(`${st(templateId)}/goodbye-variants/${vId}`, {
    ...fetchOptions,
    method: "DELETE",
  })
  if (!res.ok) await throwApiError(res, "Failed to delete goodbye variant")
}

export const LOGIN_URL = `${API_BASE}/auth/discord`
export const LOGOUT_URL = `${API_BASE}/auth/logout`

// ─── Per-guild snapshots (User Admin Panel) ─────────────────────────────────

export type GuildMessage = {
  id: string
  guildId: string
  discordChannelId: string
  discordMessageId: string
  channelName: string
  content: string | null
  embedJson: Record<string, unknown> | null
  componentsJson: unknown[] | null
  createdAt: string
  updatedAt: string
}

export type GuildReactionRole = {
  id: string
  guildId: string
  discordChannelId: string
  discordMessageId: string
  emojiKey: string
  discordRoleId: string
  createdAt: string
}

// All guild-data endpoints live under /api/guilds/:id/data/* to avoid collision with
// legacy /api/guilds/:id/reaction-roles which has a different response shape.
const guildData = (guildId: string) => `${API_BASE}/guilds/${guildId}/data`

export async function getGuildMessages(guildId: string): Promise<GuildMessage[]> {
  const res = await fetch(`${guildData(guildId)}/messages`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to load guild messages")
  const data = await res.json().catch(() => [])
  return Array.isArray(data) ? data : []
}

export async function createGuildMessage(
  guildId: string,
  body: {
    discordChannelId: string
    content?: string | null
    embedJson?: Record<string, unknown> | string | null
    componentsJson?: unknown[] | string | null
  },
): Promise<GuildMessage> {
  const res = await fetch(`${guildData(guildId)}/messages`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to create message")
  return res.json()
}

export async function updateGuildMessage(
  guildId: string,
  msgId: string,
  body: {
    content?: string | null
    embedJson?: Record<string, unknown> | string | null
    componentsJson?: unknown[] | string | null
  },
): Promise<GuildMessage> {
  const res = await fetch(`${guildData(guildId)}/messages/${msgId}`, {
    ...fetchOptions,
    method: "PATCH",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to update message")
  return res.json()
}

export async function deleteGuildMessage(guildId: string, msgId: string): Promise<void> {
  const res = await fetch(`${guildData(guildId)}/messages/${msgId}`, {
    ...fetchOptions,
    method: "DELETE",
  })
  if (!res.ok) await throwApiError(res, "Failed to delete message")
}

export async function getGuildReactionRoles(guildId: string): Promise<GuildReactionRole[]> {
  const res = await fetch(`${guildData(guildId)}/reaction-roles`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to load reaction roles")
  const data = await res.json().catch(() => [])
  return Array.isArray(data) ? data : []
}

export async function addGuildReactionRole(
  guildId: string,
  body: {
    discordChannelId: string
    discordMessageId: string
    emojiKey: string
    discordRoleId: string
  },
): Promise<GuildReactionRole> {
  const res = await fetch(`${guildData(guildId)}/reaction-roles`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to add reaction role")
  return res.json()
}

export async function deleteGuildReactionRole(guildId: string, rrId: string): Promise<void> {
  const res = await fetch(`${guildData(guildId)}/reaction-roles/${rrId}`, {
    ...fetchOptions,
    method: "DELETE",
  })
  if (!res.ok) await throwApiError(res, "Failed to delete reaction role")
}

// ─── Welcome / Goodbye ──────────────────────────────────────────────────────

export type WelcomeButton = {
  label: string
  url: string
  emoji?: string | null
}

export type ImageSendMode = "with_text" | "before_text" | "image_only"
export type WelcomeVariantRole = "new_member" | "returning_member"

export type AvatarConfig = {
  enabled: boolean
  x: number
  y: number
  radius: number
  borderColor: string
  borderWidth: number
}

export type ImageTextBlock = {
  enabled: boolean
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  bold: boolean
  align: "left" | "center" | "right"
  strokeColor?: string | null
  strokeWidth?: number
}

export type UsernameConfig = Omit<ImageTextBlock, "text">

export type VariantImageFields = {
  imageEnabled: boolean
  imageSendMode: ImageSendMode
  backgroundImageUrl: string | null
  backgroundFill: string | null
  avatarConfig: AvatarConfig | null
  usernameConfig: UsernameConfig | null
  imageTextConfig: ImageTextBlock | null
}

export type WelcomeVariant = VariantImageFields & {
  id: string
  text: string
  orderIndex: number
  role: WelcomeVariantRole
  buttonsConfig: WelcomeButton[] | null
}

export type GoodbyeVariant = VariantImageFields & {
  id: string
  text: string
  orderIndex: number
}

export type WelcomeConfig = {
  id: string
  guildId: string
  enabled: boolean
  sendMode: "channel" | "dm"
  channelId: string | null
  returningMemberEnabled: boolean
  templates: WelcomeVariant[]
  variables?: { key: string; desc: string }[]
}

export type GoodbyeConfig = {
  id: string
  guildId: string
  enabled: boolean
  channelId: string | null
  templates: GoodbyeVariant[]
  variables?: { key: string; desc: string }[]
}

export type WelcomeVariantInput = Partial<VariantImageFields> & {
  id?: string
  text: string
  orderIndex?: number
  role?: WelcomeVariantRole
  buttonsConfig?: WelcomeButton[] | null
}

export type GoodbyeVariantInput = Partial<VariantImageFields> & {
  id?: string
  text: string
  orderIndex?: number
}

export type WelcomeUpdateBody = {
  enabled?: boolean
  sendMode?: "channel" | "dm"
  channelId?: string | null
  returningMemberEnabled?: boolean
  variants?: WelcomeVariantInput[]
}

export type GoodbyeUpdateBody = {
  enabled?: boolean
  channelId?: string | null
  variants?: GoodbyeVariantInput[]
}

export type PreviewImageBody = Partial<VariantImageFields> & {
  sampleText?: string
}

export async function getWelcomeConfig(guildId: string): Promise<WelcomeConfig> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/welcome`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to load welcome config")
  return res.json()
}

export async function updateWelcomeConfig(guildId: string, body: WelcomeUpdateBody): Promise<WelcomeConfig> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/welcome`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to save welcome config")
  return res.json()
}

export async function testWelcomeMessage(
  guildId: string,
  body?: { variantId?: string; returning?: boolean },
): Promise<{ ok: boolean; sent: string; withImage: boolean }> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/welcome/test`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) await throwApiError(res, "Failed to send test welcome")
  return res.json()
}

export async function getGoodbyeConfig(guildId: string): Promise<GoodbyeConfig> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/goodbye`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to load goodbye config")
  return res.json()
}

export async function updateGoodbyeConfig(guildId: string, body: GoodbyeUpdateBody): Promise<GoodbyeConfig> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/goodbye`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to save goodbye config")
  return res.json()
}

export async function testGoodbyeMessage(
  guildId: string,
  body?: { variantId?: string },
): Promise<{ ok: boolean; sent: string; withImage: boolean }> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/goodbye/test`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) await throwApiError(res, "Failed to send test goodbye")
  return res.json()
}

/**
 * Render a welcome/goodbye preview image on the server with the given form state.
 * Returns a Blob the caller can turn into a URL.createObjectURL.
 */
export async function fetchWelcomePreviewImage(
  guildId: string,
  body: PreviewImageBody,
  kind: "welcome" | "goodbye" = "welcome",
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/${kind}/preview-image`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to render preview")
  return res.blob()
}

// ─── Leveling ────────────────────────────────────────────

export type LevelingSettings = {
  serverId: string
  enabled: boolean
  levelupChannelId: string | null  // real channel id, 'dm', or null (disabled)
  levelupMessageTemplate: string
  notifyOnlyNewTier: boolean
  chatXpEnabled: boolean
  chatXpMin: number
  chatXpMax: number
  chatXpCooldown: number
  chatXpMinLength: number
  voiceXpEnabled: boolean
  voiceXpPerMinute: number
  voiceXpMinUsers: number
  voiceXpAfkMinutes: number
  roleRewardsMode: "stack" | "replace"
  rankBgImageUrl: string | null
  rankBgColor: string
  rankOverlayOpacity: number
  rankPrimaryTextColor: string
  rankSecondaryTextColor: string
  rankAccentColor: string
  rankProgressColor: string
  rankProgressBgColor: string
}

export type LevelingTier = {
  id?: string
  name: string
  emoji: string | null
  iconUrl: string | null
  startLevel: number
  endLevel: number
  color: string
  levelupMessage: string | null
  sortOrder: number
}

export type RoleReward = { id?: string; level: number; roleId: string }
export type NoXpRoleEntry = { id: string; roleId: string }
export type NoXpChannelEntry = { id: string; channelId: string; channelType: "text" | "voice" }
export type IgnoredUserEntry = { id: string; discordId: string }

export type LevelingState = {
  settings: LevelingSettings
  tiers: LevelingTier[]
  rewards: RoleReward[]
  noXpRoles: NoXpRoleEntry[]
  noXpChannels: NoXpChannelEntry[]
  ignoredUsers: IgnoredUserEntry[]
  limits: { roleRewards: number }
  warnings: { roleHierarchy: string[] }
}

export async function getLeveling(guildId: string): Promise<LevelingState> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling`, {
    ...fetchOptions,
    method: "GET",
  })
  if (!res.ok) await throwApiError(res, "Failed to load leveling state")
  return res.json()
}

export async function updateLevelingSettings(
  guildId: string,
  body: Partial<LevelingSettings>,
): Promise<LevelingSettings> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling/settings`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to save settings")
  return res.json()
}

export async function replaceLevelingTiers(
  guildId: string,
  tiers: Partial<LevelingTier>[],
): Promise<LevelingTier[]> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling/tiers`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify({ tiers }),
  })
  if (!res.ok) await throwApiError(res, "Failed to save tiers")
  return res.json()
}

export async function resetLevelingTiers(guildId: string): Promise<LevelingTier[]> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling/tiers/reset`, {
    ...fetchOptions,
    method: "PUT",
  })
  if (!res.ok) await throwApiError(res, "Failed to reset tiers")
  return res.json()
}

export async function replaceLevelingRoleRewards(
  guildId: string,
  rewards: RoleReward[],
): Promise<RoleReward[]> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling/role-rewards`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify({ rewards }),
  })
  if (!res.ok) await throwApiError(res, "Failed to save role rewards")
  return res.json()
}

export async function replaceNoXpRoles(
  guildId: string,
  roleIds: string[],
): Promise<NoXpRoleEntry[]> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling/no-xp-roles`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify({ roleIds }),
  })
  if (!res.ok) await throwApiError(res, "Failed to save no-XP roles")
  return res.json()
}

export async function replaceNoXpChannels(
  guildId: string,
  body: { text: string[]; voice: string[] },
): Promise<NoXpChannelEntry[]> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling/no-xp-channels`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to save no-XP channels")
  return res.json()
}

export async function removeIgnoredUser(guildId: string, discordId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/guilds/${guildId}/leveling/ignored-users/${discordId}`,
    { ...fetchOptions, method: "DELETE" },
  )
  if (!res.ok) await throwApiError(res, "Failed to remove ignored user")
}

export async function recalcLeveling(guildId: string): Promise<{ updated: number }> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling/recalc`, {
    ...fetchOptions,
    method: "PUT",
  })
  if (!res.ok) await throwApiError(res, "Failed to recalc")
  return res.json()
}

export async function wipeLeveling(guildId: string): Promise<{ ok: boolean; affected: number }> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling/xp-all`, {
    ...fetchOptions,
    method: "DELETE",
  })
  if (!res.ok) await throwApiError(res, "Failed to wipe XP")
  return res.json()
}

/** Returns the canonical CSV download URL. The browser will navigate to it; cookies go along. */
export function levelingCsvExportUrl(guildId: string): string {
  return `${API_BASE}/guilds/${guildId}/leveling/xp-export.csv`
}

export type XpEventType =
  | "chat"
  | "voice"
  | "admin_give"
  | "admin_remove"
  | "admin_set"
  | "admin_reset"

export type LevelingEvent = {
  id: string
  discordId: string
  eventType: XpEventType
  xpAmount: number
  newTotal: string
  newLevel: number
  createdAt: string
}

export type LevelingEventsResponse = {
  total: number
  limit: number
  offset: number
  events: LevelingEvent[]
}

export async function getLevelingEvents(
  guildId: string,
  opts: { userId?: string; types?: XpEventType[]; limit?: number; offset?: number } = {},
): Promise<LevelingEventsResponse> {
  const params = new URLSearchParams()
  if (opts.userId) params.set("userId", opts.userId)
  if (opts.types?.length) params.set("type", opts.types.join(","))
  if (opts.limit !== undefined) params.set("limit", String(opts.limit))
  if (opts.offset !== undefined) params.set("offset", String(opts.offset))
  const qs = params.toString() ? `?${params.toString()}` : ""
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling/events${qs}`, {
    ...fetchOptions,
    method: "GET",
  })
  if (!res.ok) await throwApiError(res, "Failed to load audit log")
  return res.json()
}

// ─── Twitch live notifications ──────────────────────────

export type StreamPlatform = "twitch" | "youtube" | "kick" | "tiktok"

export type TwitchEmbedConfig = {
  color?: string
  titleTemplate?: string
  descriptionTemplate?: string
  buttonLabel?: string
  contentTemplate?: string
  showGame?: boolean
  showThumbnail?: boolean
  showStreamerAvatar?: boolean
}

export type TwitchSubscription = {
  id: string
  platform: StreamPlatform
  platformUserId: string
  platformUsername: string
  discordChannelId: string
  enabled: boolean
  isLive: boolean
  currentStreamId: string | null
  currentStreamStartedAt: string | null
  contentTemplate: string | null
  embedConfig: TwitchEmbedConfig
  createdAt: string
}

export type TwitchListResponse = {
  configured: boolean
  limit: number
  moduleEnabled: boolean
  subscriptions: TwitchSubscription[]
}

export async function getTwitchSubscriptions(guildId: string): Promise<TwitchListResponse> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/twitch`, {
    ...fetchOptions,
    method: "GET",
  })
  if (!res.ok) await throwApiError(res, "Failed to load Twitch subscriptions")
  return res.json()
}

export async function addTwitchSubscription(
  guildId: string,
  body: { username: string; discordChannelId: string },
): Promise<TwitchSubscription> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/twitch`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to add Twitch channel")
  return res.json()
}

export async function removeTwitchSubscription(guildId: string, subId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/twitch/${subId}`, {
    ...fetchOptions,
    method: "DELETE",
  })
  if (!res.ok) await throwApiError(res, "Failed to remove Twitch channel")
}

export async function updateTwitchSubscription(
  guildId: string,
  subId: string,
  body: {
    discordChannelId?: string
    enabled?: boolean
    contentTemplate?: string | null
    embedConfig?: Partial<TwitchEmbedConfig>
  },
): Promise<TwitchSubscription> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/twitch/${subId}`, {
    ...fetchOptions,
    method: "PATCH",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to update Twitch subscription")
  return res.json()
}

export async function toggleTwitchModule(
  guildId: string,
  enabled: boolean,
): Promise<{ ok: boolean; enabled: boolean }> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/twitch/module/enabled`, {
    ...fetchOptions,
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) await throwApiError(res, "Failed to toggle module")
  return res.json()
}

export type RankCardStyleOverride = Partial<{
  rankBgImageUrl: string | null
  rankBgColor: string
  rankOverlayOpacity: number
  rankPrimaryTextColor: string
  rankSecondaryTextColor: string
  rankAccentColor: string
  rankProgressColor: string
  rankProgressBgColor: string
}>

/** Fetch a live PNG preview of the rank card with the given style overrides. */
export async function fetchRankCardPreview(
  guildId: string,
  style: RankCardStyleOverride,
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling/preview-image`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify(style),
  })
  if (!res.ok) await throwApiError(res, "Failed to render rank card preview")
  return res.blob()
}

/** Ask the bot to drop the current admin's real rank card into a channel. */
export async function sendTestRankCard(guildId: string, channelId: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/leveling/test-card`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify({ channelId }),
  })
  if (!res.ok) await throwApiError(res, "Failed to send test rank card")
  return res.json()
}

// ─── Template leveling (owner-admin) ─────────────────────
// Backend mirror of the per-guild leveling endpoints, but keyed on template_id
// and using role/channel NAMES (resolved to IDs at install). Reuses
// LevelingTier / LevelingSettings shapes where possible — only the channel
// representation differs (name+mode vs. id).

export type TemplateLevelingSettings = {
  templateId: string
  enabled: boolean
  levelupChannelName: string | null
  levelupChannelMode: "channel" | "dm" | "disabled"
  levelupMessageTemplate: string
  notifyOnlyNewTier: boolean
  chatXpEnabled: boolean
  chatXpMin: number
  chatXpMax: number
  chatXpCooldown: number
  chatXpMinLength: number
  voiceXpEnabled: boolean
  voiceXpPerMinute: number
  voiceXpMinUsers: number
  voiceXpAfkMinutes: number
  roleRewardsMode: "stack" | "replace"
  rankBgImageUrl: string | null
  rankBgColor: string
  rankOverlayOpacity: number
  rankPrimaryTextColor: string
  rankSecondaryTextColor: string
  rankAccentColor: string
  rankProgressColor: string
  rankProgressBgColor: string
}

export type TemplateLevelingTier = {
  id?: string
  name: string
  emoji: string | null
  iconUrl: string | null
  startLevel: number
  endLevel: number
  color: string
  levelupMessage: string | null
  sortOrder: number
}

export type TemplateRoleReward = { id?: string; level: number; roleName: string }
export type TemplateNoXpRole = { id: string; roleName: string }
export type TemplateNoXpChannel = { id: string; channelName: string; channelType: "text" | "voice" }

export type TemplateLevelingState = {
  enabled: boolean
  settings: TemplateLevelingSettings
  tiers: TemplateLevelingTier[]
  rewards: TemplateRoleReward[]
  noXpRoles: TemplateNoXpRole[]
  noXpChannels: TemplateNoXpChannel[]
}

export async function getTemplateLeveling(templateId: string): Promise<TemplateLevelingState> {
  const res = await fetch(`${API_BASE}/server-templates/${templateId}/leveling`, {
    ...fetchOptions,
    method: "GET",
  })
  if (!res.ok) await throwApiError(res, "Failed to load template leveling")
  return res.json()
}

export async function toggleTemplateLevelingEnabled(
  templateId: string,
  enabled: boolean,
): Promise<{ enabled: boolean }> {
  const res = await fetch(`${API_BASE}/server-templates/${templateId}/leveling/enabled`, {
    ...fetchOptions,
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) await throwApiError(res, "Failed to toggle leveling")
  return res.json()
}

export async function updateTemplateLevelingSettings(
  templateId: string,
  body: Partial<TemplateLevelingSettings>,
): Promise<TemplateLevelingSettings> {
  const res = await fetch(`${API_BASE}/server-templates/${templateId}/leveling/settings`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to save settings")
  return res.json()
}

export async function replaceTemplateLevelingTiers(
  templateId: string,
  tiers: Partial<TemplateLevelingTier>[],
): Promise<TemplateLevelingTier[]> {
  const res = await fetch(`${API_BASE}/server-templates/${templateId}/leveling/tiers`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify({ tiers }),
  })
  if (!res.ok) await throwApiError(res, "Failed to save tiers")
  return res.json()
}

export async function resetTemplateLevelingTiers(templateId: string): Promise<TemplateLevelingTier[]> {
  const res = await fetch(`${API_BASE}/server-templates/${templateId}/leveling/tiers/reset`, {
    ...fetchOptions,
    method: "PUT",
  })
  if (!res.ok) await throwApiError(res, "Failed to reset tiers")
  return res.json()
}

export async function replaceTemplateLevelingRoleRewards(
  templateId: string,
  rewards: TemplateRoleReward[],
): Promise<TemplateRoleReward[]> {
  const res = await fetch(`${API_BASE}/server-templates/${templateId}/leveling/role-rewards`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify({ rewards }),
  })
  if (!res.ok) await throwApiError(res, "Failed to save role rewards")
  return res.json()
}

export async function replaceTemplateNoXpRoles(
  templateId: string,
  roleNames: string[],
): Promise<TemplateNoXpRole[]> {
  const res = await fetch(`${API_BASE}/server-templates/${templateId}/leveling/no-xp-roles`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify({ roleNames }),
  })
  if (!res.ok) await throwApiError(res, "Failed to save no-XP roles")
  return res.json()
}

export async function replaceTemplateNoXpChannels(
  templateId: string,
  body: { text: string[]; voice: string[] },
): Promise<TemplateNoXpChannel[]> {
  const res = await fetch(`${API_BASE}/server-templates/${templateId}/leveling/no-xp-channels`, {
    ...fetchOptions,
    method: "PUT",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to save no-XP channels")
  return res.json()
}

export async function wipeTemplateLeveling(templateId: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/server-templates/${templateId}/leveling`, {
    ...fetchOptions,
    method: "DELETE",
  })
  if (!res.ok) await throwApiError(res, "Failed to wipe template leveling")
  return res.json()
}
