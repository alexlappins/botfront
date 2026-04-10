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

export async function getGuilds(): Promise<Guild[]> {
  const res = await fetch(`${API_BASE}/guilds`, { ...fetchOptions, method: "GET" })
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
  if (!res.ok) await throwApiError(res, "Ошибка загрузки файла")
  const data = (await res.json()) as { url?: string }
  if (typeof data.url !== "string") throw new Error("Ответ загрузки без поля url")
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
  if (!res.ok) await throwApiError(res, "Не удалось отправить превью в канал")
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
    throw new Error(typeof data.message === "string" ? data.message : "Не удалось добавить привязку")
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

export type ServerTemplateDetail = ServerTemplate & {
  roles: TemplateRole[]
  categories: TemplateCategory[]
  channels: TemplateChannel[]
  messages: TemplateMessage[]
  reactionRoles: TemplateReactionRole[]
  logChannels: TemplateLogChannel[]
  emojis: TemplateEmoji[]
  stickers: TemplateSticker[]
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
}): Promise<ServerTemplate> {
  const res = await fetch(ST, { ...fetchOptions, method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error("Failed to create template")
  return res.json()
}

export async function updateServerTemplate(
  id: string,
  body: { name?: string; description?: string | null; discordTemplateUrl?: string | null }
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
    throw new Error(typeof data.message === "string" ? data.message : "Ошибка установки шаблона")
  }
}

export type StoreTemplateProduct = {
  id?: string
  templateId: string
  name: string
  description: string | null
  discordTemplateUrl: string | null
  price: number
  currency: string
  isActive?: boolean
  template?: {
    id: string
    name: string
    description: string | null
    discordTemplateUrl: string | null
  } | null
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

export async function getStoreTemplates(): Promise<StoreTemplateProduct[]> {
  const res = await fetch(`${API_BASE}/store/templates`, { ...fetchOptions, method: "GET" })
  if (!res.ok) await throwApiError(res, "Failed to fetch store templates")
  const raw = await res.json()
  if (!Array.isArray(raw)) return []
  return raw.map((item: any) => {
    const nested = item?.template ?? null
    return {
      id: typeof item?.id === "string" ? item.id : undefined,
      templateId: typeof item?.templateId === "string" ? item.templateId : (nested?.id ?? ""),
      name:
        typeof item?.name === "string"
          ? item.name
          : typeof nested?.name === "string"
            ? nested.name
            : "Без названия",
      description:
        typeof item?.description === "string"
          ? item.description
          : typeof nested?.description === "string"
            ? nested.description
            : null,
      discordTemplateUrl:
        typeof item?.discordTemplateUrl === "string"
          ? item.discordTemplateUrl
          : typeof nested?.discordTemplateUrl === "string"
            ? nested.discordTemplateUrl
            : null,
      price: typeof item?.price === "number" ? item.price : 0,
      currency: typeof item?.currency === "string" ? item.currency : "USD",
      isActive: typeof item?.isActive === "boolean" ? item.isActive : undefined,
      template: nested,
    } as StoreTemplateProduct
  })
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

export async function getMyServerTemplates(): Promise<ServerTemplate[]> {
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

export async function adminUpsertStoreTemplate(body: {
  templateId: string
  price: number
  currency: string
  isActive: boolean
}): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/store/templates/upsert`, {
    ...fetchOptions,
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res, "Failed to upsert store card")
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

export const LOGIN_URL = `${API_BASE}/auth/discord`
export const LOGOUT_URL = `${API_BASE}/auth/logout`
