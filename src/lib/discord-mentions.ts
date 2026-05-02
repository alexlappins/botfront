/**
 * Helpers for two-way conversion between raw Discord mentions and human-friendly strings.
 *
 * Raw form (what Discord/the API stores):  `<#123456789>`  /  `<@&987654321>`
 * Friendly form (what we show in textarea): `#channel-name` /  `@RoleName`
 *
 * On save we convert friendly → raw so Discord renders proper clickable mentions.
 */

export type IdNamePair = { id: string; name: string }

/** Replace all `<#id>` and `<@&id>` with `#name` / `@name` using provided maps. */
export function mentionsToFriendly(
  text: string,
  channels: IdNamePair[],
  roles: IdNamePair[],
): string {
  if (!text) return text
  const channelMap = new Map(channels.map((c) => [c.id, c.name]))
  const roleMap = new Map(roles.map((r) => [r.id, r.name]))
  let out = text
  out = out.replace(/<#(\d{17,20})>/g, (_, id: string) => {
    const name = channelMap.get(id)
    return name ? `#${name}` : `<#${id}>`
  })
  out = out.replace(/<@&(\d{17,20})>/g, (_, id: string) => {
    const name = roleMap.get(id)
    return name ? `@${name}` : `<@&${id}>`
  })
  return out
}

/**
 * Reverse of mentionsToFriendly: replaces `#name` and `@name` tokens with raw mentions.
 * Greedy match by longest name first to avoid partial collisions.
 */
export function friendlyToMentions(
  text: string,
  channels: IdNamePair[],
  roles: IdNamePair[],
): string {
  if (!text) return text
  let out = text

  const channelsByLen = [...channels].sort((a, b) => b.name.length - a.name.length)
  for (const c of channelsByLen) {
    if (!c.name) continue
    const escaped = c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    out = out.replace(new RegExp(`#${escaped}\\b`, "g"), `<#${c.id}>`)
  }

  const rolesByLen = [...roles].sort((a, b) => b.name.length - a.name.length)
  for (const r of rolesByLen) {
    if (!r.name) continue
    const escaped = r.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    out = out.replace(new RegExp(`@${escaped}\\b`, "g"), `<@&${r.id}>`)
  }

  return out
}
