import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HandHeart,
  Hash,
  Loader2,
  MessageSquare,
  Smile,
  Sparkles,
  Sticker,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react"
import {
  ApiError,
  createStoreCheckout,
  getStoreProduct,
  type StoreContents,
  type StoreTemplateProduct,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import { formatCents } from "@/lib/price"

/**
 * Product detail page. URL: /store/:storeTemplateId
 *
 * Sections:
 *   - Breadcrumb back to /store
 *   - Top: gallery (screenshots) on the left, name/price/buy on the right
 *   - "What's inside": auto-counted from the underlying ServerTemplate's
 *     relations (channels, roles, messages, welcome variants, etc.)
 *   - Long description (markdown) — small renderer, same one used in twitch page
 */
export function StoreProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<StoreTemplateProduct | null>(null)
  const [contents, setContents] = useState<StoreContents | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [galleryIdx, setGalleryIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    setLoading(true)
    setError(null)
    getStoreProduct(id)
      .then((r) => {
        if (!alive) return
        setProduct(r.product)
        setContents(r.contents)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
        setError(e instanceof Error ? e.message : "Loading error")
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id, navigate])

  async function handleBuy() {
    if (!product) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const { url } = await createStoreCheckout(product.templateId)
      window.location.href = url
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return navigate("/login", { replace: true })
      setError(e instanceof Error ? e.message : "Checkout error")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-7 w-7 animate-spin text-white/40" />
      </div>
    )
  }
  if (error || !product) {
    return (
      <div className="space-y-3">
        <Link to="/store" className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to shop
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error ?? "Product not found"}
        </div>
      </div>
    )
  }

  const images = product.screenshots?.length
    ? product.screenshots
    : product.iconUrl
      ? [product.iconUrl]
      : []
  const priceLabel =
    formatCents(product.price, product.currency)

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Link to="/store" className="inline-flex items-center gap-1 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Shop
        </Link>
        <span className="text-white/30">/</span>
        <span className="text-white/70 truncate">{product.name}</span>
      </div>

      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {success}
        </div>
      )}

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <Gallery images={images} index={galleryIdx} onIndex={setGalleryIdx} name={product.name} />

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{product.name}</h1>
            {product.description && (
              <p className="text-sm text-white/65 mt-1">{product.description}</p>
            )}
          </div>

          {(product.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              {product.tags!.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{priceLabel}</span>
              <span className="text-xs text-white/40">per install</span>
            </div>
            <button
              type="button"
              onClick={handleBuy}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Processing…" : "Buy"}
            </button>
            <p className="text-[11px] text-white/40 text-center">
              После покупки откройте «Список покупок» и нажмите «Установить» на нужном сервере.
            </p>
          </div>

          {contents && <WhatsInside contents={contents} />}
        </div>
      </div>

      {product.longDescription && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white mb-2">Description</h2>
          <div
            className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(product.longDescription) }}
          />
        </section>
      )}
    </div>
  )
}

function Gallery({
  images,
  index,
  onIndex,
  name,
}: {
  images: string[]
  index: number
  onIndex: (n: number) => void
  name: string
}) {
  if (images.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-700/30 to-fuchsia-700/20 aspect-[16/10] grid place-items-center">
        <span className="text-5xl font-bold text-white/30">{name[0]?.toUpperCase() ?? "?"}</span>
      </div>
    )
  }
  const safeIdx = Math.max(0, Math.min(images.length - 1, index))
  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl border border-white/10 bg-[#0e0e18] aspect-[16/10] overflow-hidden">
        <img src={images[safeIdx]} alt={`${name} screenshot ${safeIdx + 1}`} className="w-full h-full object-cover" />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => onIndex(safeIdx === 0 ? images.length - 1 : safeIdx - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 grid place-items-center text-white"
              aria-label="Previous screenshot"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onIndex(safeIdx === images.length - 1 ? 0 : safeIdx + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 grid place-items-center text-white"
              aria-label="Next screenshot"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[11px] text-white">
              {safeIdx + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => onIndex(i)}
              className={cn(
                "shrink-0 w-20 h-12 rounded-md overflow-hidden border-2 transition-colors",
                i === safeIdx ? "border-violet-500" : "border-transparent hover:border-white/20",
              )}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function WhatsInside({ contents }: { contents: StoreContents }) {
  const features: { icon: typeof Hash; label: string; on: boolean }[] = [
    { icon: Sparkles, label: "Server stats channels", on: contents.serverStatsEnabled },
    { icon: HandHeart, label: "Welcome messages", on: contents.welcomeEnabled },
    { icon: HandHeart, label: "Goodbye messages", on: contents.goodbyeEnabled },
    { icon: TrendingUp, label: "Leveling system", on: contents.levelingEnabled },
  ]
  const counts: { icon: typeof Hash; label: string; count: number }[] = [
    { icon: Hash, label: "Channels", count: contents.channels },
    { icon: Users, label: "Roles", count: contents.roles },
    { icon: MessageSquare, label: "Messages", count: contents.messages },
    { icon: UserCog, label: "Auto-roles", count: contents.reactionRoles },
    { icon: Smile, label: "Emojis", count: contents.emojis },
    { icon: Sticker, label: "Stickers", count: contents.stickers },
    { icon: HandHeart, label: "Welcome variants", count: contents.welcomeVariants },
    { icon: HandHeart, label: "Goodbye variants", count: contents.goodbyeVariants },
  ].filter((c) => c.count > 0)

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      <h3 className="text-xs font-semibold text-white/75 uppercase tracking-wide">What's inside</h3>
      {counts.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {counts.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-white/80">
              <c.icon className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              <span>
                <span className="font-semibold text-white">{c.count}</span> {c.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/40 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Empty for now — the template author hasn't filled it yet.
        </p>
      )}
      {features.some((f) => f.on) && (
        <div className="border-t border-white/5 pt-2 space-y-1">
          {features
            .filter((f) => f.on)
            .map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-white/75">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                {f.label}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

/**
 * Mini markdown subset: **bold**, *italic*, `code`, line breaks.
 * Caller HTML-escapes first; we only inject our own tags.
 */
function simpleMarkdownToHtml(s: string): string {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return esc
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /`([^`]+)`/g,
      "<code style='background:rgba(255,255,255,0.06);padding:0 4px;border-radius:3px;font-size:0.9em'>$1</code>",
    )
}
