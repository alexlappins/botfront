import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, uploadFile } from "@/lib/api"
import { cn } from "@/lib/utils"
import { ImageIcon, Plus, Trash2, Upload } from "lucide-react"

const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp"

/** Состояние формы — сериализуется в JSON для поля embedJson (формат Discord embed). Автор в embed не задаём: сообщение шлёт бот. */
export type EmbedFormState = {
  title: string
  description: string
  url: string
  color: string
  timestampLocal: string
  footerText: string
  footerIconUrl: string
  thumbnailUrl: string
  imageUrl: string
  fields: { name: string; value: string; inline: boolean }[]
}

export function emptyEmbedForm(): EmbedFormState {
  return {
    title: "",
    description: "",
    url: "",
    color: "#5865F2",
    timestampLocal: "",
    footerText: "",
    footerIconUrl: "",
    thumbnailUrl: "",
    imageUrl: "",
    fields: [],
  }
}

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function datetimeLocalToIso(local: string): string | undefined {
  if (!local.trim()) return undefined
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function parseColorToNumber(input: string): number | undefined {
  const s = input.trim()
  if (!s) return undefined
  if (s.startsWith("#")) {
    const n = parseInt(s.slice(1), 16)
    return Number.isFinite(n) ? n : undefined
  }
  if (/^[0-9a-fA-F]{6}$/.test(s)) return parseInt(s, 16)
  const n = parseInt(s, 16)
  if (Number.isFinite(n) && s.length <= 8 && /^[0-9a-fA-F]+$/.test(s)) return n
  const dec = Number(s)
  return Number.isFinite(dec) && dec >= 0 ? Math.floor(dec) : undefined
}

function colorNumberToHex(n: number): string {
  const hex = n.toString(16).padStart(6, "0")
  return `#${hex.slice(-6)}`
}

/** Значение для <input type="color"> — только валидный #RRGGBB. */
function embedColorToPickerHex(color: string): string {
  const s = color.trim()
  const withHash = s.startsWith("#") ? s : /^[0-9a-fA-F]{6}$/i.test(s) ? `#${s}` : s
  const n = parseColorToNumber(withHash)
  if (n != null) return colorNumberToHex(n)
  return "#5865F2"
}

/** Порядок ближе к ProBot: тёплые → холодные. Последний круг — системный color picker. */
const EMBED_COLOR_PRESETS: { hex: string; label: string }[] = [
  { hex: "#E67E22", label: "Orange" },
  { hex: "#FEE75C", label: "Yellow" },
  { hex: "#1ABC9C", label: "Teal" },
  { hex: "#5865F2", label: "Blue (Discord)" },
  { hex: "#9B59B6", label: "Purple" },
  { hex: "#ED4245", label: "Red" },
  { hex: "#57F287", label: "Green" },
  { hex: "#EB459E", label: "Pink" },
  { hex: "#99AAB5", label: "Gray" },
]

function pickUrl(v: unknown): string {
  if (typeof v === "string") return v
  if (v && typeof v === "object" && "url" in v && typeof (v as { url: unknown }).url === "string") {
    return (v as { url: string }).url
  }
  return ""
}

function extractEmbed(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null
  const o = parsed as Record<string, unknown>
  if (Array.isArray(o.embeds) && o.embeds.length > 0 && typeof o.embeds[0] === "object" && o.embeds[0]) {
    return o.embeds[0] as Record<string, unknown>
  }
  if ("title" in o || "description" in o || "fields" in o || "author" in o || "footer" in o) {
    return o
  }
  return null
}

export function parseEmbedJsonToForm(raw: unknown): EmbedFormState {
  const empty = emptyEmbedForm()
  if (raw == null) return empty
  let parsed: unknown
  // Бэк может отдавать либо строку (legacy), либо уже распарсенный объект (JSONB)
  if (typeof raw === "string") {
    if (!raw.trim()) return empty
    try {
      parsed = JSON.parse(raw)
    } catch {
      return empty
    }
  } else if (typeof raw === "object") {
    parsed = raw
  } else {
    return empty
  }
  try {
    const embed = extractEmbed(parsed)
    if (!embed) return empty

    const footer = embed.footer && typeof embed.footer === "object" ? (embed.footer as Record<string, unknown>) : null

    let ts = ""
    if (typeof embed.timestamp === "string") ts = isoToDatetimeLocal(embed.timestamp)
    else if (typeof embed.timestamp === "number") ts = isoToDatetimeLocal(new Date(embed.timestamp).toISOString())

    const fieldsRaw = Array.isArray(embed.fields) ? embed.fields : []
    const fields = fieldsRaw
      .filter((f): f is Record<string, unknown> => f != null && typeof f === "object")
      .slice(0, 25)
      .map((f) => ({
        name: String(f.name ?? ""),
        value: String(f.value ?? ""),
        inline: Boolean(f.inline),
      }))

    let color = "#5865F2"
    if (typeof embed.color === "number") color = colorNumberToHex(embed.color)
    else if (typeof embed.color === "string") {
      const s = embed.color.trim()
      const n = parseColorToNumber(s.startsWith("#") ? s : s.length === 6 && /^[0-9a-fA-F]+$/.test(s) ? `#${s}` : s)
      color = n != null ? colorNumberToHex(n) : s.startsWith("#") && s.length === 7 ? s : "#5865F2"
    }

    return {
      title: String(embed.title ?? ""),
      description: String(embed.description ?? ""),
      url: String(embed.url ?? ""),
      color,
      timestampLocal: ts,
      footerText: footer ? String(footer.text ?? "") : "",
      footerIconUrl: footer ? String(footer.icon_url ?? footer.iconURL ?? "") : "",
      thumbnailUrl: pickUrl(embed.thumbnail),
      imageUrl: pickUrl(embed.image),
      fields,
    }
  } catch {
    return empty
  }
}

/**
 * Есть ли в эмбеде то, что Discord/бэк считают телом сообщения.
 * Только color (и/или timestamp) — нет: бэк превью отвечает 400 «немає що відправити».
 */
function embedRecordHasRenderableBody(e: Record<string, unknown>): boolean {
  if (typeof e.title === "string" && e.title.trim()) return true
  if (typeof e.description === "string" && e.description.trim()) return true
  if (typeof e.url === "string" && e.url.trim()) return true

  const fields = Array.isArray(e.fields) ? e.fields : []
  if (
    fields.some((f) => {
      if (!f || typeof f !== "object") return false
      const o = f as { name?: string; value?: string }
      return Boolean(o.name?.trim() || o.value?.trim())
    })
  )
    return true

  if (pickUrl(e.thumbnail).trim() || pickUrl(e.image).trim()) return true

  const footer = e.footer
  if (footer && typeof footer === "object") {
    const fo = footer as { text?: string; icon_url?: string; iconURL?: string }
    if (fo.text?.trim()) return true
    if ((fo.icon_url || fo.iconURL || "").toString().trim()) return true
  }

  const author = e.author
  if (author && typeof author === "object") {
    const n = (author as { name?: string }).name
    if (typeof n === "string" && n.trim()) return true
  }

  return false
}

function embedHasVisibleContent(e: Record<string, unknown>): boolean {
  return embedRecordHasRenderableBody(e)
}

/** Возвращает JSON для API или undefined, если эмбед пустой (бэк не шлёт пустой embed). */
export function serializeFormToEmbedJson(form: EmbedFormState): string | undefined {
  const embed: Record<string, unknown> = {}

  const t = form.title.trim()
  const d = form.description.trim()
  const u = form.url.trim()
  if (t) embed.title = t
  if (d) embed.description = d
  if (u) embed.url = u

  const col = parseColorToNumber(form.color)
  if (col != null) embed.color = col

  const ts = datetimeLocalToIso(form.timestampLocal)
  if (ts) embed.timestamp = ts

  if (form.footerText.trim() || form.footerIconUrl.trim()) {
    const f: Record<string, string> = {}
    if (form.footerText.trim()) f.text = form.footerText.trim()
    if (form.footerIconUrl.trim()) f.icon_url = form.footerIconUrl.trim()
    embed.footer = f
  }

  if (form.thumbnailUrl.trim()) embed.thumbnail = { url: form.thumbnailUrl.trim() }
  if (form.imageUrl.trim()) embed.image = { url: form.imageUrl.trim() }

  const flds = form.fields
    .map((x) => ({
      name: x.name.trim(),
      value: x.value.trim(),
      inline: x.inline,
    }))
    .filter((x) => x.name || x.value)
    .slice(0, 25)
  if (flds.length) embed.fields = flds

  if (!embedHasVisibleContent(embed)) return undefined
  return JSON.stringify({ embeds: [embed] })
}

const textareaClass =
  "flex min-h-[120px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm ring-offset-[hsl(var(--background))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

export function DiscordEmbedPreview({ form }: { form: EmbedFormState }) {
  const raw = serializeFormToEmbedJson(form)
  if (!raw) {
    return (
      <div className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Fill in the title, description, fields or images — a Discord-style preview will appear here.
      </div>
    )
  }
  let embed: Record<string, unknown>
  try {
    const p = JSON.parse(raw) as { embeds?: unknown[] }
    embed = (p.embeds?.[0] as Record<string, unknown>) ?? {}
  } catch {
    return null
  }
  const col = typeof embed.color === "number" ? embed.color : 0x5865f2
  const border = `#${col.toString(16).padStart(6, "0")}`

  const footer = embed.footer as { text?: string; icon_url?: string } | undefined
  const thumb = embed.thumbnail as { url?: string } | undefined
  const img = embed.image as { url?: string } | undefined
  const fields = (Array.isArray(embed.fields) ? embed.fields : []) as {
    name?: string
    value?: string
    inline?: boolean
  }[]

  return (
    <div
      className="overflow-hidden rounded-lg text-sm text-[#dbdee1]"
      style={{ background: "#2b2d31", maxWidth: 520 }}
    >
      <div className="flex">
        <div className="w-1 shrink-0" style={{ background: border }} />
        <div className="min-w-0 flex-1 p-3 pr-4">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              {typeof embed.title === "string" && embed.title ? (
                embed.url ? (
                  <a
                    href={String(embed.url)}
                    className="block font-semibold text-[#00aff4] hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {embed.title}
                  </a>
                ) : (
                  <div className="font-semibold text-white">{embed.title}</div>
                )
              ) : null}
              {typeof embed.description === "string" && embed.description ? (
                <div className="whitespace-pre-wrap text-[#dbdee1]">{embed.description}</div>
              ) : null}
              {fields.length > 0 ? (
                <div
                  className={cn(
                    "grid gap-2 pt-1",
                    fields.some((f) => f.inline) ? "sm:grid-cols-3" : "grid-cols-1"
                  )}
                >
                  {fields.map((f, i) => (
                    <div key={i} className={cn("min-w-0 rounded bg-[#1e1f22]/80 px-2 py-1", f.inline && "sm:col-span-1")}>
                      {f.name ? <div className="text-xs font-semibold text-white">{f.name}</div> : null}
                      {f.value ? <div className="mt-0.5 whitespace-pre-wrap text-xs text-[#dbdee1]">{f.value}</div> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {footer?.text ? (
                <div className="flex items-center gap-2 pt-1 text-xs text-[#dbdee1]">
                  {footer.icon_url ? <img src={footer.icon_url} alt="" className="h-4 w-4 rounded-full" /> : null}
                  <span>{footer.text}</span>
                </div>
              ) : null}
            </div>
            {thumb?.url ? (
              <img src={thumb.url} alt="" className="h-20 w-20 shrink-0 rounded object-cover" />
            ) : null}
          </div>
          {img?.url ? (
            <div className="mt-2 max-h-48 overflow-hidden rounded">
              <img src={img.url} alt="" className="max-h-48 w-full object-cover" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const dashedMediaBox =
  "flex min-h-[100px] items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))]/40 text-[hsl(var(--muted-foreground))]"

export function TemplateEmbedBuilder({ form, onChange }: { form: EmbedFormState; onChange: (next: EmbedFormState) => void }) {
  const imageFileRef = useRef<HTMLInputElement>(null)
  const thumbFileRef = useRef<HTMLInputElement>(null)
  const [uploadingKind, setUploadingKind] = useState<null | "image" | "thumbnail">(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  function patch(p: Partial<EmbedFormState>) {
    onChange({ ...form, ...p })
  }

  function setField(i: number, p: Partial<EmbedFormState["fields"][0]>) {
    const fields = form.fields.map((f, j) => (j === i ? { ...f, ...p } : f))
    onChange({ ...form, fields })
  }

  async function handleUploadedFile(kind: "image" | "thumbnail", file: File | undefined) {
    if (!file) return
    setUploadError(null)
    setUploadingKind(kind)
    try {
      const { url } = await uploadFile(file)
      if (kind === "image") patch({ imageUrl: url })
      else patch({ thumbnailUrl: url })
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload error")
    } finally {
      setUploadingKind(null)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] xl:items-start">
      <div className="space-y-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.22)] p-4 sm:p-5">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Embed author is not configurable — the bot sends the message (like ProBot). Image uploads go
          through the backend{" "}
          <code className="text-[10px]">POST /api/uploads</code>; Discord requires a public{" "}
          <code className="text-[10px]">PUBLIC_BASE_URL</code> (https), otherwise the embed will contain
          localhost and the image won't load.
        </p>

        <div>
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Color
          </Label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {EMBED_COLOR_PRESETS.map((p) => {
              const active = embedColorToPickerHex(form.color).toLowerCase() === p.hex.toLowerCase()
              return (
                <button
                  key={p.hex}
                  type="button"
                  title={p.label}
                  onClick={() => patch({ color: p.hex })}
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-full border-2 shadow-sm transition-transform hover:scale-110",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2",
                    active
                      ? "border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/25"
                      : "border-[hsl(var(--border))]"
                  )}
                  style={{ backgroundColor: p.hex }}
                />
              )
            })}
            <input
              type="color"
              value={embedColorToPickerHex(form.color)}
              onChange={(e) => patch({ color: e.target.value })}
              className={cn(
                "h-9 w-9 shrink-0 cursor-pointer rounded-full border-2 border-[hsl(var(--border))]",
                "bg-[hsl(var(--background))] shadow-sm [color-scheme:dark]",
                "[&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0",
                "[&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
              )}
              title="Custom color (system picker)"
              aria-label="Pick a color from the palette"
            />
            <Input
              className="h-9 max-w-[7.5rem] font-mono text-xs"
              type="text"
              value={form.color}
              onChange={(e) => patch({ color: e.target.value })}
              placeholder="#5865F2"
              spellCheck={false}
              aria-label="HEX"
            />
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Embed title"
              />
            </div>
            <div className="grid gap-2">
              <Label>Title URL</Label>
              <Input value={form.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <textarea
                className={textareaClass}
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Embed text. Markdown: **bold**, *italic*…"
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() =>
                  onChange({
                    ...form,
                    fields: [...form.fields, { name: "", value: "", inline: false }].slice(0, 25),
                  })
                }
                disabled={form.fields.length >= 25}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add field
              </Button>
              <div className="space-y-2">
                {form.fields.map((f, i) => (
                  <div key={i} className="space-y-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]/50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="min-w-[120px] flex-1"
                        placeholder="Name"
                        value={f.name}
                        onChange={(e) => setField(i, { name: e.target.value })}
                      />
                      <label className="flex items-center gap-2 text-xs whitespace-nowrap text-[hsl(var(--muted-foreground))]">
                        <input
                          type="checkbox"
                          checked={f.inline}
                          onChange={(e) => setField(i, { inline: e.target.checked })}
                        />
                        Inline
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => patch({ fields: form.fields.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="h-4 w-4 text-[hsl(var(--destructive))]" />
                      </Button>
                    </div>
                    <textarea
                      className={cn(textareaClass, "min-h-[72px]")}
                      placeholder="Value (**bold** etc.)"
                      value={f.value}
                      onChange={(e) => setField(i, { value: e.target.value })}
                      rows={3}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Large image</Label>
              <div className={cn(dashedMediaBox, "min-h-[140px]")}>
                {form.imageUrl.trim() ? (
                  <img
                    src={form.imageUrl.trim()}
                    alt=""
                    className="max-h-48 w-full rounded-md object-contain"
                  />
                ) : (
                  <ImageIcon className="h-12 w-12 opacity-40" strokeWidth={1.25} />
                )}
              </div>
              <Input
                value={form.imageUrl}
                onChange={(e) => patch({ imageUrl: e.target.value })}
                placeholder="Image URL (image)"
              />
              <input
                ref={imageFileRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  void handleUploadedFile("image", f)
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={uploadingKind === "image"}
                onClick={() => imageFileRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadingKind === "image" ? "Uploading…" : "Upload PNG / JPEG / GIF / WebP"}
              </Button>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 lg:w-40">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Thumbnail
            </Label>
            <div className={cn(dashedMediaBox, "aspect-square max-h-36 min-h-[7rem]")}>
              {form.thumbnailUrl.trim() ? (
                <img
                  src={form.thumbnailUrl.trim()}
                  alt=""
                  className="max-h-full max-w-full rounded-md object-cover"
                />
              ) : (
                <ImageIcon className="h-10 w-10 opacity-40" strokeWidth={1.25} />
              )}
            </div>
            <Input
              value={form.thumbnailUrl}
              onChange={(e) => patch({ thumbnailUrl: e.target.value })}
              placeholder="Thumbnail URL"
              className="text-sm"
            />
            <input
              ref={thumbFileRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                void handleUploadedFile("thumbnail", f)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={uploadingKind === "thumbnail"}
              onClick={() => thumbFileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4 shrink-0" />
              {uploadingKind === "thumbnail" ? "…" : "Upload"}
            </Button>
          </div>
        </div>

        {uploadError ? (
          <p className="text-sm text-[hsl(var(--destructive))]" role="alert">
            {uploadError}
          </p>
        ) : null}

        <div className="border-t border-[hsl(var(--border))] pt-4 space-y-3">
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Footer
          </Label>
          <div className="flex flex-wrap items-start gap-3">
            <div
              className={cn(
                dashedMediaBox,
                "h-12 w-12 min-h-0 shrink-0 rounded-full p-0"
              )}
            >
              {form.footerIconUrl.trim() ? (
                <img src={form.footerIconUrl.trim()} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 opacity-40" />
              )}
            </div>
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
              <Input
                value={form.footerIconUrl}
                onChange={(e) => patch({ footerIconUrl: e.target.value })}
                placeholder="Footer icon (URL)"
              />
              <Input
                value={form.footerText}
                onChange={(e) => patch({ footerText: e.target.value })}
                placeholder="Footer text"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:max-w-xs">
          <Label className="text-xs text-[hsl(var(--muted-foreground))]">Time (timestamp)</Label>
          <Input
            type="datetime-local"
            value={form.timestampLocal}
            onChange={(e) => patch({ timestampLocal: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2 xl:sticky xl:top-2 xl:self-start">
        <Label className="text-sm font-medium">Preview</Label>
        <DiscordEmbedPreview form={form} />
      </div>
    </div>
  )
}
