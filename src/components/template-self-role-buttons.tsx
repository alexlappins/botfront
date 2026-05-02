import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"

/** Режим customId: rr/{{Роль}} | rr/give/{{Роль}} | rr/take/{{Роль}} */
export type SelfRoleButtonMode = "toggle" | "give" | "take"

export type SelfRoleButtonDraft = {
  localId: string
  mode: SelfRoleButtonMode
  /** Имя роли в шаблоне — подставляется в {{…}} при установке */
  roleName: string
  label: string
  /** Discord: 1 Primary, 2 Secondary, 3 Success, 4 Danger */
  style: 1 | 2 | 3 | 4
  /** Unicode или имя эмодзи; пусто — без эмодзи */
  emojiName: string
}

function newLocalId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
}

export function emptySelfRoleButton(): SelfRoleButtonDraft {
  return {
    localId: newLocalId(),
    mode: "give",
    roleName: "",
    label: "",
    style: 3,
    emojiName: "",
  }
}

const STYLE_COLORS: { value: 1 | 2 | 3 | 4; color: string; label: string }[] = [
  { value: 1, color: "#5865F2", label: "Blue (Primary)" },
  { value: 2, color: "#4E5058", label: "Gray (Secondary)" },
  { value: 3, color: "#248046", label: "Green (Success)" },
  { value: 4, color: "#DA373C", label: "Red (Danger)" },
]

export function buildSelfRoleCustomId(mode: SelfRoleButtonMode, roleName: string): string {
  const r = roleName.trim()
  const wrapped = `{{${r}}}`
  if (mode === "give") return `rr/give/${wrapped}`
  if (mode === "take") return `rr/take/${wrapped}`
  return `rr/${wrapped}`
}

/**
 * GUILD variant — works with real Discord role IDs (after install).
 * Use it in User Admin Panel where customId already contains real IDs, e.g. `rr/give/123456789`.
 */
export function buildGuildSelfRoleCustomId(mode: SelfRoleButtonMode, roleId: string): string {
  const r = roleId.trim()
  if (mode === "give") return `rr/give/${r}`
  if (mode === "take") return `rr/take/${r}`
  return `rr/${r}`
}

/** Serializer for guild context — roleName field stores raw role ID, no `{{…}}` wrapping. */
export function serializeGuildSelfRoleComponents(buttons: SelfRoleButtonDraft[]): unknown[] | undefined {
  const valid = buttons.filter((b) => b.roleName.trim() && b.label.trim())
  if (valid.length === 0) return undefined

  const rows: { type: 1; components: Record<string, unknown>[] }[] = []
  let row: { type: 1; components: Record<string, unknown>[] } = { type: 1, components: [] }

  for (const b of valid) {
    const btn: Record<string, unknown> = {
      type: 2,
      style: b.style,
      label: b.label.trim().slice(0, 80),
      customId: buildGuildSelfRoleCustomId(b.mode, b.roleName),
    }
    const em = b.emojiName.trim()
    if (em) {
      if (/^\d{17,20}$/.test(em)) {
        btn.emoji = { id: em }
      } else {
        btn.emoji = { name: em }
      }
    }
    if (row.components.length >= 5) {
      rows.push(row)
      row = { type: 1, components: [] }
    }
    row.components.push(btn)
  }
  if (row.components.length) rows.push(row)
  return rows
}

/** Parser for guild context — accepts customId with raw role IDs (no `{{…}}`). */
export function parseGuildSelfRoleComponents(raw: unknown): SelfRoleButtonDraft[] {
  if (raw == null) return []
  let parsed: unknown
  if (typeof raw === "string") {
    if (!raw.trim()) return []
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  } else if (Array.isArray(raw)) {
    parsed = raw
  } else {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: SelfRoleButtonDraft[] = []
  for (const row of parsed) {
    if (!row || typeof row !== "object" || (row as { type?: number }).type !== 1) continue
    const comps = (row as { components?: unknown[] }).components ?? []
    for (const c of comps) {
      if (!c || typeof c !== "object" || (c as { type?: number }).type !== 2) continue
      const btn = c as {
        customId?: string
        label?: string
        style?: number
        emoji?: { name?: string; id?: string }
      }
      const cid = btn.customId ?? ""
      // Match raw IDs first; fall back to {{…}} placeholders for safety
      let mode: SelfRoleButtonMode = "toggle"
      let roleId = ""
      const giveRaw = cid.match(/^rr\/give\/(\d{17,20})$/)
      const takeRaw = cid.match(/^rr\/take\/(\d{17,20})$/)
      const togRaw = cid.match(/^rr\/(\d{17,20})$/)
      const giveTpl = cid.match(/^rr\/give\/\{\{([^}]+)\}\}$/)
      const takeTpl = cid.match(/^rr\/take\/\{\{([^}]+)\}\}$/)
      const togTpl = cid.match(/^rr\/\{\{([^}]+)\}\}$/)
      if (giveRaw) { mode = "give"; roleId = giveRaw[1] }
      else if (takeRaw) { mode = "take"; roleId = takeRaw[1] }
      else if (togRaw) { mode = "toggle"; roleId = togRaw[1] }
      else if (giveTpl) { mode = "give"; roleId = giveTpl[1] }
      else if (takeTpl) { mode = "take"; roleId = takeTpl[1] }
      else if (togTpl) { mode = "toggle"; roleId = togTpl[1] }
      else continue

      const st = btn.style
      const style: 1 | 2 | 3 | 4 = st === 1 || st === 2 || st === 3 || st === 4 ? st : 2
      let emojiName = ""
      if (btn.emoji?.id) emojiName = btn.emoji.id
      else if (btn.emoji?.name) emojiName = btn.emoji.name
      out.push({
        localId: newLocalId(),
        mode,
        roleName: roleId,
        label: typeof btn.label === "string" ? btn.label : "",
        style,
        emojiName,
      })
    }
  }
  return out
}

function buildCustomId(mode: SelfRoleButtonMode, roleName: string): string {
  return buildSelfRoleCustomId(mode, roleName)
}

const STYLE_PREVIEW: Record<1 | 2 | 3 | 4, string> = {
  1: "bg-[#5865F2] hover:bg-[#4752C4]",
  2: "bg-[#4E5058] hover:bg-[#6D6F78]",
  3: "bg-[#248046] hover:bg-[#1A6334]",
  4: "bg-[#DA373C] hover:bg-[#A12D32]",
}

function DiscordButtonPreviewChip({ b }: { b: SelfRoleButtonDraft }) {
  const valid = b.roleName.trim() && b.label.trim()
  if (!valid) {
    return (
      <span className="inline-flex h-8 min-w-[72px] items-center justify-center rounded border border-dashed border-[hsl(var(--border))] px-2 text-[10px] text-[hsl(var(--muted-foreground))]">
        …
      </span>
    )
  }
  const st = b.style in STYLE_PREVIEW ? STYLE_PREVIEW[b.style] : STYLE_PREVIEW[2]
  return (
    <span
      className={`inline-flex h-8 max-w-[160px] items-center gap-1.5 truncate rounded px-2.5 text-xs font-medium text-white shadow-sm ${st}`}
    >
      {b.emojiName.trim() ? (
        <span className="shrink-0 text-[14px] leading-none">{b.emojiName.trim().slice(0, 32)}</span>
      ) : null}
      <span className="truncate">{b.label.trim().slice(0, 80)}</span>
    </span>
  )
}

/** Сериализация в components Discord: массив Action Row (по 5 кнопок в ряд). */
export function serializeSelfRoleComponents(buttons: SelfRoleButtonDraft[]): string | undefined {
  const valid = buttons.filter((b) => b.roleName.trim() && b.label.trim())
  if (valid.length === 0) return undefined

  const rows: { type: 1; components: Record<string, unknown>[] }[] = []
  let row: { type: 1; components: Record<string, unknown>[] } = { type: 1, components: [] }

  for (const b of valid) {
    const btn: Record<string, unknown> = {
      type: 2,
      style: b.style,
      label: b.label.trim().slice(0, 80),
      customId: buildCustomId(b.mode, b.roleName),
    }
    const em = b.emojiName.trim()
    if (em) {
      if (/^\d{17,20}$/.test(em)) {
        btn.emoji = { id: em }
      } else {
        btn.emoji = { name: em }
      }
    }
    if (row.components.length >= 5) {
      rows.push(row)
      row = { type: 1, components: [] }
    }
    row.components.push(btn)
  }
  if (row.components.length) rows.push(row)
  return JSON.stringify(rows)
}

export function parseSelfRoleComponents(raw: unknown): SelfRoleButtonDraft[] {
  if (raw == null) return []
  let parsed: unknown
  // Бэк может отдавать строку (legacy) или массив (JSONB) — нормализуем
  if (typeof raw === "string") {
    if (!raw.trim()) return []
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  } else if (Array.isArray(raw)) {
    parsed = raw
  } else {
    return []
  }
  try {
    if (!Array.isArray(parsed)) return []
    const out: SelfRoleButtonDraft[] = []
    for (const row of parsed) {
      if (!row || typeof row !== "object" || (row as { type?: number }).type !== 1) continue
      const comps = (row as { components?: unknown[] }).components ?? []
      for (const c of comps) {
        if (!c || typeof c !== "object" || (c as { type?: number }).type !== 2) continue
        const btn = c as {
          customId?: string
          label?: string
          style?: number
          emoji?: { name?: string; id?: string }
        }
        const cid = btn.customId ?? ""
        let mode: SelfRoleButtonMode = "toggle"
        let roleName = ""
        const g = cid.match(/^rr\/give\/\{\{([^}]+)\}\}$/)
        const t = cid.match(/^rr\/take\/\{\{([^}]+)\}\}$/)
        const u = cid.match(/^rr\/\{\{([^}]+)\}\}$/)
        if (g) {
          mode = "give"
          roleName = g[1]
        } else if (t) {
          mode = "take"
          roleName = t[1]
        } else if (u) {
          mode = "toggle"
          roleName = u[1]
        } else {
          continue
        }
        const st = btn.style
        const style: 1 | 2 | 3 | 4 =
          st === 1 || st === 2 || st === 3 || st === 4 ? st : 2
        let emojiName = ""
        if (btn.emoji?.id) emojiName = btn.emoji.id
        else if (btn.emoji?.name) emojiName = btn.emoji.name
        out.push({
          localId: newLocalId(),
          mode,
          roleName,
          label: typeof btn.label === "string" ? btn.label : "",
          style,
          emojiName,
        })
      }
    }
    return out
  } catch {
    return []
  }
}

export function TemplateSelfRoleButtonsEditor({
  buttons,
  onChange,
  roleOptions,
}: {
  buttons: SelfRoleButtonDraft[]
  onChange: (next: SelfRoleButtonDraft[]) => void
  /** Если передан — показывает Select вместо Input для поля роли */
  roleOptions?: { value: string; label: string }[]
}) {
  function patchAt(i: number, p: Partial<SelfRoleButtonDraft>) {
    onChange(buttons.map((b, j) => (j === i ? { ...b, ...p } : b)))
  }

  function removeAt(i: number) {
    onChange(buttons.filter((_, j) => j !== i))
  }

  const validButtons = buttons.filter((b) => b.roleName.trim() && b.label.trim())
  const previewRows: SelfRoleButtonDraft[][] = []
  for (let i = 0; i < validButtons.length; i += 5) {
    previewRows.push(validButtons.slice(i, i + 5))
  }

  return (
    <div className="space-y-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-4">
      <div>
        <p className="text-sm font-medium">Auto-role buttons</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          Channel and message order are set in the card header. On install the bot substitutes role IDs
          into <code className="text-[10px]">customId</code>. Up to 5 buttons per row.
        </p>
      </div>

      {previewRows.length > 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[#2b2d31] p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-[#b5bac1]">Like in Discord</p>
          <div className="flex flex-col gap-2">
            {previewRows.map((row, ri) => (
              <div key={ri} className="flex flex-wrap gap-2">
                {row.map((b) => (
                  <DiscordButtonPreviewChip key={b.localId} b={b} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Add buttons below — a preview will appear here.</p>
      )}

      <div className="space-y-3">
        {buttons.map((b, i) => (
          <div
            key={b.localId}
            className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]/60 p-3 space-y-3"
          >
            <div className="flex flex-wrap items-end gap-2 justify-between">
              <div className="grid gap-1.5 min-w-[140px] flex-1">
                <Label className="text-xs">Mode</Label>
                <Select
                  value={b.mode}
                  onValueChange={(v) => patchAt(i, { mode: v as SelfRoleButtonMode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="give">Give only (give)</SelectItem>
                    <SelectItem value="take">Remove only (take)</SelectItem>
                    <SelectItem value="toggle">Toggle (toggle)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => removeAt(i)} aria-label="Delete button">
                <Trash2 className="h-4 w-4 text-[hsl(var(--destructive))]" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Role</Label>
                {roleOptions && roleOptions.length > 0 ? (
                  <Select
                    value={b.roleName || "__none__"}
                    onValueChange={(v) => patchAt(i, { roleName: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not selected</SelectItem>
                      {roleOptions.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={b.roleName}
                    onChange={(e) => patchAt(i, { roleName: e.target.value })}
                    placeholder="e.g. Member"
                  />
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Button text</Label>
                <Input
                  value={b.label}
                  onChange={(e) => patchAt(i, { label: e.target.value })}
                  placeholder="Agree"
                  maxLength={80}
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Button color</Label>
                <div className="flex gap-2 items-center h-9">
                  {STYLE_COLORS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      title={s.label}
                      onClick={() => patchAt(i, { style: s.value })}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: s.color,
                        borderColor: b.style === s.value ? "white" : "transparent",
                        transform: b.style === s.value ? "scale(1.15)" : "scale(1)",
                        opacity: b.style === s.value ? 1 : 0.6,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Emoji (optional)</Label>
                <Input
                  value={b.emojiName}
                  onChange={(e) => patchAt(i, { emojiName: e.target.value })}
                  placeholder="✅ or custom emoji id"
                />
              </div>
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono break-all">
              customId: {buildCustomId(b.mode, b.roleName || "…")}
            </p>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...buttons, { ...emptySelfRoleButton(), localId: newLocalId() }])}
        disabled={buttons.length >= 25}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add button
      </Button>
      {buttons.length >= 25 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Limit 25 buttons (room for multiple rows).</p>
      ) : null}
    </div>
  )
}
