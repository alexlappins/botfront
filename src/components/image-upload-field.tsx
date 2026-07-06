import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Upload, X } from "lucide-react"
import { uploadFile } from "@/lib/api"

/**
 * Project-wide image picker (Misha's TZ §9): a file-upload button instead of
 * a URL text field. Uploads via /api/uploads and hands back the public URL.
 */
export function ImageUploadField({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleFile(file: File) {
    setErr(null)
    setUploading(true)
    try {
      const { url } = await uploadFile(file)
      onChange(url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("imageUpload.error"))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ""
        }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/85 hover:bg-white/[0.06] disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {value ? t("imageUpload.replace") : t("imageUpload.upload")}
        </button>
        {value && (
          <>
            <img
              src={value}
              alt=""
              className="h-10 max-w-[120px] rounded-md object-cover border border-white/10"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-white/50 hover:text-red-400"
              title={t("imageUpload.remove")}
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  )
}
