import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AdminHeader } from "@/components/admin-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ApiError,
  adminListStoreOrders,
  adminListStoreTemplates,
  adminRefundStoreOrder,
  adminUpsertStoreTemplate,
  getServerTemplates,
  updateServerTemplate,
  uploadFile,
  type AdminStoreOrder,
  type ProductStatus,
  type ServerTemplate,
  type StoreCategory,
  type StoreTemplateProduct,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import { Loader2, Plus, RotateCcw, Star, Trash2, Upload } from "lucide-react"

const CATEGORIES: { value: StoreCategory; label: string }[] = [
  { value: "streamer", label: "Streamer" },
  { value: "vtuber", label: "VTuber" },
  { value: "gaming", label: "Gaming" },
  { value: "community", label: "Community" },
  { value: "anime", label: "Anime" },
  { value: "crypto", label: "Crypto" },
  { value: "streaming", label: "Streaming" },
  { value: "other", label: "Other" },
]

const STATUSES: { value: ProductStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
]

const CURRENCIES = ["USD", "EUR", "UAH"]

export function AdminStorePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<"products" | "orders">("products")
  const [templates, setTemplates] = useState<ServerTemplate[]>([])
  const [storeRows, setStoreRows] = useState<StoreTemplateProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Editor state
  const [templateId, setTemplateId] = useState("")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [price, setPrice] = useState("10")
  const [oldPrice, setOldPrice] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [status, setStatus] = useState<ProductStatus>("draft")
  const [shortDescription, setShortDescription] = useState("")
  const [longDescription, setLongDescription] = useState("")
  const [category, setCategory] = useState<StoreCategory | "">("")
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [featured, setFeatured] = useState(false)
  const [featuredOrder, setFeaturedOrder] = useState("0")
  const [discordTemplateUrl, setDiscordTemplateUrl] = useState("")

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingShot, setUploadingShot] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  async function reload() {
    setLoading(true)
    try {
      const [tpls, rows] = await Promise.all([getServerTemplates(), adminListStoreTemplates()])
      setTemplates(tpls)
      setStoreRows(rows)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      if (e instanceof ApiError && e.status === 403) return setError("No access")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Load the editor with the currently saved values for the selected template,
   * if a store row already exists. Falls back to defaults for new products.
   */
  function selectTemplate(id: string) {
    setTemplateId(id)
    setError(null)
    setSuccess(null)
    const tpl = templates.find((t) => t.id === id)
    setDiscordTemplateUrl(tpl?.discordTemplateUrl ?? "")
    const existing = storeRows.find((r) => r.templateId === id)
    if (existing) {
      setName(existing.name ?? "")
      setSlug(existing.slug ?? "")
      setPrice(String(existing.price))
      setOldPrice(existing.oldPrice != null ? String(existing.oldPrice) : "")
      setCurrency(existing.currency)
      setStatus(existing.status ?? (existing.isActive ? "published" : "draft"))
      setShortDescription(existing.shortDescription ?? "")
      setLongDescription(existing.longDescription ?? "")
      setCategory((existing.category as StoreCategory | null) ?? "")
      setTags(existing.tags ?? [])
      setCoverImageUrl(existing.coverImageUrl ?? null)
      setScreenshots(existing.screenshots ?? [])
      setFeatured(Boolean(existing.featured))
      setFeaturedOrder(String(existing.featuredOrder ?? 0))
    } else {
      setName(tpl?.name ?? "")
      setSlug("")
      setPrice("10")
      setOldPrice("")
      setCurrency("USD")
      setStatus("draft")
      setShortDescription("")
      setLongDescription("")
      setCategory("")
      setTags([])
      setCoverImageUrl(null)
      setScreenshots([])
      setFeatured(false)
      setFeaturedOrder("0")
    }
  }

  async function uploadScreenshot(file: File) {
    if (screenshots.length >= 12) {
      setError("Максимум 12 скриншотов на товар.")
      return
    }
    setUploadingShot(true)
    setError(null)
    try {
      const { url } = await uploadFile(file)
      setScreenshots((s) => [...s, url])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploadingShot(false)
    }
  }

  async function uploadCover(file: File) {
    setUploadingCover(true)
    setError(null)
    try {
      const { url } = await uploadFile(file)
      setCoverImageUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploadingCover(false)
    }
  }

  async function submit() {
    setError(null)
    setSuccess(null)
    setSaving(true)
    try {
      await adminUpsertStoreTemplate({
        templateId,
        name: name.trim() || null,
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        price: Number(price),
        oldPrice: oldPrice.trim() ? Number(oldPrice) : null,
        currency,
        status,
        shortDescription: shortDescription.trim() || null,
        longDescription: longDescription.trim() || null,
        category: category || null,
        tags,
        coverImageUrl,
        screenshots,
        featured,
        featuredOrder: Number(featuredOrder) || 0,
      })
      // discord_template_url lives on the server template (TZ-2 §1/§5) —
      // saved alongside so the install flow always has the discord.new link.
      await updateServerTemplate(templateId, {
        discordTemplateUrl: discordTemplateUrl.trim() || null,
      })
      setSuccess("Saved.")
      void reload()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <AdminHeader title="Shop Management" />
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex gap-2">
          {(
            [
              { v: "products" as const, label: "Products" },
              { v: "orders" as const, label: "Orders" },
            ]
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setTab(o.v)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === o.v
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {tab === "orders" && <OrdersTab />}

        {tab === "products" && (
        <>
        {/* Existing products list */}
        <Card>
          <CardHeader>
            <CardTitle>Товары в магазине ({storeRows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
              </div>
            ) : storeRows.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Пока ничего. Выберите шаблон ниже чтобы добавить в магазин.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {storeRows.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectTemplate(r.templateId)}
                    className={cn(
                      "text-left rounded-md border p-2.5 transition-colors",
                      templateId === r.templateId
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]"
                        : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.5)]",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {r.featured && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                      <span className="text-sm font-semibold truncate flex-1">{r.name}</span>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded",
                          r.status === "published"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : r.status === "archived"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-white/5 text-white/40",
                        )}
                      >
                        {r.status ?? (r.isActive ? "published" : "draft")}
                      </span>
                    </div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                      <span>{r.currency === "USD" ? `$${r.price}` : `${r.price} ${r.currency}`}</span>
                      {r.category && <span>· {r.category}</span>}
                      <span>· {r.salesCount ?? 0} sales</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Editor */}
        <Card>
          <CardHeader>
            <CardTitle>{storeRows.some((r) => r.templateId === templateId) ? "Редактировать" : "Добавить в магазин"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Шаблон сервера</Label>
              <Select
                value={templateId || "__none__"}
                onValueChange={(v) => selectTemplate(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите шаблон" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Не выбран</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Название товара</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
              </div>
              <div className="grid gap-2">
                <Label>Slug (URL /shop/…)</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto from name" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Короткое описание (1-2 предложения, для карточки)</Label>
              <Input
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Shown on the catalog card"
              />
            </div>

            <div className="grid gap-2">
              <Label>Discord template URL (discord.new/… — для установки, ТЗ-2)</Label>
              <Input
                value={discordTemplateUrl}
                onChange={(e) => setDiscordTemplateUrl(e.target.value)}
                placeholder="https://discord.new/xxxx"
              />
            </div>

            <div className="grid sm:grid-cols-4 gap-3">
              <div className="grid gap-2">
                <Label>Цена</Label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min={0} step="0.01" />
              </div>
              <div className="grid gap-2">
                <Label>Старая цена (скидка)</Label>
                <Input
                  value={oldPrice}
                  onChange={(e) => setOldPrice(e.target.value)}
                  type="number"
                  min={0}
                  placeholder="—"
                />
              </div>
              <div className="grid gap-2">
                <Label>Статус</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Валюта</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Категория</Label>
                <Select value={category || "__none__"} onValueChange={(v) => setCategory(v === "__none__" ? "" : (v as StoreCategory))}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— нет —</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Длинное описание (markdown)</Label>
              <textarea
                value={longDescription}
                onChange={(e) => setLongDescription(e.target.value)}
                rows={6}
                placeholder="Можно использовать **bold**, *italic*, `code`."
                className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              />
            </div>

            <div className="grid gap-2">
              <Label>Теги</Label>
              <div className="flex flex-wrap gap-1.5 mb-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                      className="text-violet-300/60 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagDraft}
                  placeholder="новый тег + Enter"
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      const t = tagDraft.trim()
                      if (t && !tags.includes(t) && tags.length < 24) setTags([...tags, t])
                      setTagDraft("")
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const t = tagDraft.trim()
                    if (t && !tags.includes(t) && tags.length < 24) setTags([...tags, t])
                    setTagDraft("")
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Обложка (16:9, для карточки каталога)</Label>
              <div className="flex items-center gap-3">
                <label
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm cursor-pointer hover:bg-[hsl(var(--muted)/0.4)]",
                    uploadingCover && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {coverImageUrl ? "Заменить обложку" : "Загрузить обложку"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingCover}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void uploadCover(f)
                      e.target.value = ""
                    }}
                  />
                </label>
                {coverImageUrl && (
                  <div className="relative h-14 w-24 overflow-hidden rounded-md border border-[hsl(var(--border))]">
                    <img src={coverImageUrl} alt="cover" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setCoverImageUrl(null)}
                      className="absolute top-0.5 right-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 hover:bg-red-500/80 text-white"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {!coverImageUrl && (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    без обложки берётся первый скриншот
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Галерея / скриншоты ({screenshots.length} / 12)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {screenshots.map((src, i) => (
                  <div key={src + i} className="relative aspect-video rounded-md overflow-hidden border border-[hsl(var(--border))]">
                    <img src={src} alt={`screenshot ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setScreenshots(screenshots.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-red-500/80 text-white grid place-items-center"
                      title="Удалить"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-violet-600/80 text-[9px] font-semibold text-white">
                        COVER
                      </span>
                    )}
                  </div>
                ))}
                <label
                  className={cn(
                    "aspect-video rounded-md border-2 border-dashed border-[hsl(var(--border))] grid place-items-center cursor-pointer hover:bg-[hsl(var(--muted)/0.3)]",
                    (uploadingShot || screenshots.length >= 12) && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {uploadingShot ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
                  ) : (
                    <div className="text-center text-[hsl(var(--muted-foreground))]">
                      <Upload className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-[11px]">Загрузить</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingShot || screenshots.length >= 12}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void uploadScreenshot(f)
                      e.target.value = ""
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                <Star className={cn("h-4 w-4", featured ? "fill-amber-400 text-amber-400" : "text-[hsl(var(--muted-foreground))]")} />
                <span className="text-sm">Featured (hero)</span>
              </label>
              {featured && (
                <div className="grid gap-1">
                  <Label className="text-xs">Featured order</Label>
                  <Input
                    value={featuredOrder}
                    onChange={(e) => setFeaturedOrder(e.target.value)}
                    type="number"
                    placeholder="0"
                  />
                </div>
              )}
            </div>

            {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
            {success && <p className="text-sm text-emerald-500">{success}</p>}
            <div className="flex items-center gap-2">
              <Button onClick={submit} disabled={!templateId.trim() || saving}>
                {saving ? "Saving…" : "Сохранить"}
              </Button>
              {templateId && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const row = storeRows.find((r) => r.templateId === templateId)
                    window.open(`/shop/${row?.slug ?? row?.id ?? ""}`, "_blank")
                  }}
                  disabled={!storeRows.some((r) => r.templateId === templateId)}
                >
                  Preview (как увидит покупатель)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        </>
        )}
      </main>
    </div>
  )
}

/** Orders tab (TZ-1 §6.3): every purchase + Stripe refund. */
function OrdersTab() {
  const [orders, setOrders] = useState<AdminStoreOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    try {
      setOrders(await adminListStoreOrders())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders")
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function refund(o: AdminStoreOrder) {
    if (!confirm(`Refund "${o.productName}" for ${o.buyerTag ?? o.buyerId}? The deployed server is left untouched.`)) return
    setBusyId(o.id)
    setError(null)
    try {
      await adminRefundStoreOrder(o.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders {orders ? `(${orders.length})` : ""}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-[hsl(var(--destructive))] mb-3">{error}</p>}
        {!orders ? (
          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
        ) : orders.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No orders yet.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {o.productName}
                    {o.status === "refunded" && <span className="ml-2 text-xs text-red-400">refunded</span>}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {o.buyerTag ?? o.buyerId} · {o.currency === "USD" ? `$${o.amount}` : `${o.amount} ${o.currency}`} ·{" "}
                    {new Date(o.createdAt).toLocaleString()} ·{" "}
                    {o.deployedGuildId ? `deployed on ${o.deployedGuildName ?? o.deployedGuildId}` : "not deployed"}
                  </p>
                </div>
                {o.status === "paid" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === o.id}
                    onClick={() => void refund(o)}
                    className="text-[hsl(var(--destructive))]"
                  >
                    {busyId === o.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    )}
                    Refund
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
