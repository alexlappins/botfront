import { useEffect, useMemo, useState } from "react"
import {
  HandHeart,
  Loader2,
  Plus,
  Send,
  Trash2,
  Wand2,
  X,
} from "lucide-react"
import {
  ApiError,
  getChannels,
  getGoodbyeConfig,
  getWelcomeConfig,
  testGoodbyeMessage,
  testWelcomeMessage,
  updateGoodbyeConfig,
  updateWelcomeConfig,
  type Channel,
  type GoodbyeConfig,
  type WelcomeButton,
  type WelcomeConfig,
} from "@/lib/api"
import { useCurrentGuildId } from "@/lib/use-current-guild-id"
import { cn } from "@/lib/utils"
import { ImageEditor, type ImageEditorState } from "@/components/welcome/image-editor"

type Tab = "welcome" | "goodbye"

const VARIABLES: { key: string; desc: string }[] = [
  { key: "{user}", desc: "Упоминание пользователя (@username)" },
  { key: "{user.name}", desc: "Имя пользователя без @" },
  { key: "{user.tag}", desc: "Имя с дискриминатором" },
  { key: "{user.id}", desc: "ID пользователя" },
  { key: "{server.name}", desc: "Название сервера" },
  { key: "{server.memberCount}", desc: "Кол-во участников" },
]

const DEFAULT_WELCOME = "Привет, {user}! Добро пожаловать на **{server.name}** 🎉"
const DEFAULT_GOODBYE = "{user.name} покинул(а) **{server.name}**. Нас стало {server.memberCount}."

export function WelcomePage() {
  const guildId = useCurrentGuildId()
  const [tab, setTab] = useState<Tab>("welcome")
  const [channels, setChannels] = useState<Channel[]>([])
  const [welcome, setWelcome] = useState<WelcomeConfig | null>(null)
  const [goodbye, setGoodbye] = useState<GoodbyeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!guildId) return
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([
      getChannels(guildId),
      getWelcomeConfig(guildId),
      getGoodbyeConfig(guildId),
    ])
      .then(([c, w, g]) => {
        if (!alive) return
        setChannels(c)
        setWelcome(w)
        setGoodbye(g)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setError("Нет доступа к серверу.")
        } else {
          setError(e instanceof Error ? e.message : "Ошибка загрузки")
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [guildId])

  if (!guildId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <p className="text-white/60">Выберите сервер в селекторе слева вверху.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <HandHeart className="h-7 w-7 text-violet-400" />
          Приветствия
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Сообщения при входе и выходе участников. Поддерживает переменные.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-white/5">
        {(["welcome", "goodbye"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-violet-500 text-white"
                : "border-transparent text-white/50 hover:text-white/80",
            )}
          >
            {t === "welcome" ? "Welcome" : "Goodbye"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && tab === "welcome" && welcome && (
        <WelcomeTab
          guildId={guildId}
          channels={channels}
          value={welcome}
          onChange={setWelcome}
        />
      )}
      {!loading && !error && tab === "goodbye" && goodbye && (
        <GoodbyeTab
          guildId={guildId}
          channels={channels}
          value={goodbye}
          onChange={setGoodbye}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Welcome
// ─────────────────────────────────────────────────────────

function WelcomeTab({
  guildId,
  channels,
  value,
  onChange,
}: {
  guildId: string
  channels: Channel[]
  value: WelcomeConfig
  onChange: (next: WelcomeConfig) => void
}) {
  const [enabled, setEnabled] = useState(value.enabled)
  const [sendMode, setSendMode] = useState<"channel" | "dm">(value.sendMode)
  const [channelId, setChannelId] = useState<string | null>(value.channelId)
  const [templates, setTemplates] = useState(
    value.templates.length
      ? value.templates.map((t) => ({ id: t.id, text: t.text }))
      : [{ id: undefined as string | undefined, text: DEFAULT_WELCOME }],
  )
  const [buttons, setButtons] = useState<WelcomeButton[]>(value.buttonsConfig ?? [])
  const [returningEnabled, setReturningEnabled] = useState(value.returningMemberEnabled)
  const [returningText, setReturningText] = useState(value.returningMemberText ?? "")
  const [image, setImage] = useState<ImageEditorState>({
    imageEnabled: value.imageEnabled,
    imageSendMode: value.imageSendMode,
    backgroundImageUrl: value.backgroundImageUrl,
    backgroundFill: value.backgroundFill,
    avatarConfig: value.avatarConfig,
    usernameConfig: value.usernameConfig,
    imageTextConfig: value.imageTextConfig,
  })

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [flash, setFlash] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  function setFlashAuto(type: "ok" | "err", text: string) {
    setFlash({ type, text })
    setTimeout(() => setFlash(null), 3500)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const next = await updateWelcomeConfig(guildId, {
        enabled,
        sendMode,
        channelId,
        templates: templates.map((t, i) => ({ id: t.id, text: t.text, orderIndex: i })),
        buttonsConfig: buttons.length ? buttons : null,
        returningMemberEnabled: returningEnabled,
        returningMemberText: returningText.trim() || null,
        ...image,
      })
      onChange(next)
      setTemplates(
        next.templates.length
          ? next.templates.map((t) => ({ id: t.id, text: t.text }))
          : [{ id: undefined, text: "" }],
      )
      setFlashAuto("ok", "Сохранено")
    } catch (e) {
      setFlashAuto("err", e instanceof Error ? e.message : "Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      await testWelcomeMessage(guildId)
      setFlashAuto("ok", "Тестовое сообщение отправлено")
    } catch (e) {
      setFlashAuto("err", e instanceof Error ? e.message : "Не удалось отправить")
    } finally {
      setTesting(false)
    }
  }

  const previewText = templates[0]?.text ?? ""

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Включено</p>
              <p className="text-xs text-white/50 mt-0.5">
                Отправлять приветствие при входе нового участника
              </p>
            </div>
            <Toggle checked={enabled} onChange={setEnabled} />
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-white mb-3">Куда отправлять</p>
          <div className="flex gap-2 mb-4">
            {(["channel", "dm"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSendMode(m)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium border",
                  sendMode === m
                    ? "border-violet-500 bg-violet-500/15 text-white"
                    : "border-white/10 text-white/60 hover:bg-white/5",
                )}
              >
                {m === "channel" ? "В канал" : "В личные сообщения"}
              </button>
            ))}
          </div>
          {sendMode === "channel" && (
            <ChannelPicker
              channels={channels}
              value={channelId}
              onChange={setChannelId}
              placeholder="Выберите канал"
            />
          )}
          {sendMode === "dm" && (
            <p className="text-xs text-white/50">
              Бот напишет в ЛС нового участника. Если у пользователя выключены ЛС от незнакомцев — сообщение не дойдёт.
            </p>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">
                Тексты сообщений
                <span className="ml-2 text-[11px] font-normal text-white/40">
                  до 5 — выбор случайный
                </span>
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                Поддерживаются переменные: {"{user}"}, {"{server.name}"} и др.
              </p>
            </div>
            {templates.length < 5 && (
              <button
                type="button"
                onClick={() =>
                  setTemplates((arr) => [...arr, { id: undefined, text: "" }])
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-sm text-violet-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Добавить вариант
              </button>
            )}
          </div>
          <div className="space-y-3">
            {templates.map((t, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-white/40">
                    Вариант {i + 1}
                  </span>
                  {templates.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setTemplates((arr) => arr.filter((_, idx) => idx !== i))
                      }
                      className="text-white/40 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <textarea
                  value={t.text}
                  onChange={(e) =>
                    setTemplates((arr) =>
                      arr.map((row, idx) =>
                        idx === i ? { ...row, text: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="Привет, {user}!"
                  rows={3}
                  className="w-full rounded-lg bg-black/40 border border-white/10 text-sm text-white p-3 outline-none focus:border-violet-500/60 resize-y"
                />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">
                Кнопки-ссылки
                <span className="ml-2 text-[11px] font-normal text-white/40">до 3</span>
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                Прикрепляются под текстом приветствия. Только URL-кнопки.
              </p>
            </div>
            {buttons.length < 3 && (
              <button
                type="button"
                onClick={() =>
                  setButtons((arr) => [...arr, { label: "", url: "", emoji: null }])
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/80"
              >
                <Plus className="h-3.5 w-3.5" />
                Добавить кнопку
              </button>
            )}
          </div>
          {buttons.length === 0 && (
            <p className="text-xs text-white/40">Нет кнопок.</p>
          )}
          <div className="space-y-2">
            {buttons.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                <input
                  value={b.label}
                  onChange={(e) =>
                    setButtons((arr) =>
                      arr.map((row, idx) =>
                        idx === i ? { ...row, label: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="Текст кнопки"
                  className="rounded-lg bg-black/40 border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-violet-500/60"
                />
                <input
                  value={b.url}
                  onChange={(e) =>
                    setButtons((arr) =>
                      arr.map((row, idx) =>
                        idx === i ? { ...row, url: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="https://..."
                  className="rounded-lg bg-black/40 border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-violet-500/60"
                />
                <button
                  type="button"
                  onClick={() =>
                    setButtons((arr) => arr.filter((_, idx) => idx !== i))
                  }
                  className="grid place-items-center w-9 rounded-lg border border-white/10 hover:bg-white/5 text-white/40 hover:text-red-400"
                  aria-label="Удалить"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <ImageEditor guildId={guildId} kind="welcome" value={image} onChange={setImage} />

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                Возвращающиеся участники
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                Отдельный текст, если человек был на сервере раньше.
              </p>
            </div>
            <Toggle checked={returningEnabled} onChange={setReturningEnabled} />
          </div>
          {returningEnabled && (
            <textarea
              value={returningText}
              onChange={(e) => setReturningText(e.target.value)}
              placeholder="С возвращением, {user}!"
              rows={2}
              className="mt-3 w-full rounded-lg bg-black/40 border border-white/10 text-sm text-white p-3 outline-none focus:border-violet-500/60"
            />
          )}
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 self-start">
        <Card>
          <p className="text-sm font-semibold text-white mb-2">Превью</p>
          <PreviewBox text={previewText} buttons={buttons} />
        </Card>

        <VariablesList />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Сохранить
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !enabled}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm font-medium disabled:opacity-50"
            title={!enabled ? "Включите приветствие, чтобы тестировать" : ""}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Отправить тест
          </button>
        </div>

        {flash && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-xs border",
              flash.type === "ok"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300",
            )}
          >
            {flash.text}
          </div>
        )}
      </aside>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Goodbye
// ─────────────────────────────────────────────────────────

function GoodbyeTab({
  guildId,
  channels,
  value,
  onChange,
}: {
  guildId: string
  channels: Channel[]
  value: GoodbyeConfig
  onChange: (next: GoodbyeConfig) => void
}) {
  const [enabled, setEnabled] = useState(value.enabled)
  const [channelId, setChannelId] = useState<string | null>(value.channelId)
  const [templates, setTemplates] = useState(
    value.templates.length
      ? value.templates.map((t) => ({ id: t.id, text: t.text }))
      : [{ id: undefined as string | undefined, text: DEFAULT_GOODBYE }],
  )
  const [image, setImage] = useState<ImageEditorState>({
    imageEnabled: value.imageEnabled,
    imageSendMode: value.imageSendMode,
    backgroundImageUrl: value.backgroundImageUrl,
    backgroundFill: value.backgroundFill,
    avatarConfig: value.avatarConfig,
    usernameConfig: value.usernameConfig,
    imageTextConfig: value.imageTextConfig,
  })

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [flash, setFlash] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  function setFlashAuto(type: "ok" | "err", text: string) {
    setFlash({ type, text })
    setTimeout(() => setFlash(null), 3500)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const next = await updateGoodbyeConfig(guildId, {
        enabled,
        channelId,
        templates: templates.map((t, i) => ({ id: t.id, text: t.text, orderIndex: i })),
        ...image,
      })
      onChange(next)
      setTemplates(
        next.templates.length
          ? next.templates.map((t) => ({ id: t.id, text: t.text }))
          : [{ id: undefined, text: "" }],
      )
      setFlashAuto("ok", "Сохранено")
    } catch (e) {
      setFlashAuto("err", e instanceof Error ? e.message : "Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      await testGoodbyeMessage(guildId)
      setFlashAuto("ok", "Тестовое сообщение отправлено")
    } catch (e) {
      setFlashAuto("err", e instanceof Error ? e.message : "Не удалось отправить")
    } finally {
      setTesting(false)
    }
  }

  const previewText = templates[0]?.text ?? ""

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Включено</p>
              <p className="text-xs text-white/50 mt-0.5">
                Сообщать в канал, когда участник покидает сервер
              </p>
            </div>
            <Toggle checked={enabled} onChange={setEnabled} />
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-white mb-3">Канал</p>
          <ChannelPicker
            channels={channels}
            value={channelId}
            onChange={setChannelId}
            placeholder="Выберите канал"
          />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">
                Тексты прощаний
                <span className="ml-2 text-[11px] font-normal text-white/40">
                  до 5 — выбор случайный
                </span>
              </p>
            </div>
            {templates.length < 5 && (
              <button
                type="button"
                onClick={() =>
                  setTemplates((arr) => [...arr, { id: undefined, text: "" }])
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-sm text-violet-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Добавить вариант
              </button>
            )}
          </div>
          <div className="space-y-3">
            {templates.map((t, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-white/40">
                    Вариант {i + 1}
                  </span>
                  {templates.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setTemplates((arr) => arr.filter((_, idx) => idx !== i))
                      }
                      className="text-white/40 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <textarea
                  value={t.text}
                  onChange={(e) =>
                    setTemplates((arr) =>
                      arr.map((row, idx) =>
                        idx === i ? { ...row, text: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="{user.name} покинул(а) {server.name}"
                  rows={3}
                  className="w-full rounded-lg bg-black/40 border border-white/10 text-sm text-white p-3 outline-none focus:border-violet-500/60 resize-y"
                />
              </div>
            ))}
          </div>
        </Card>

        <ImageEditor guildId={guildId} kind="goodbye" value={image} onChange={setImage} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 self-start">
        <Card>
          <p className="text-sm font-semibold text-white mb-2">Превью</p>
          <PreviewBox text={previewText} buttons={[]} />
        </Card>

        <VariablesList />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Сохранить
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !enabled}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm font-medium disabled:opacity-50"
            title={!enabled ? "Включите прощание, чтобы тестировать" : ""}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Отправить тест
          </button>
        </div>

        {flash && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-xs border",
              flash.type === "ok"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300",
            )}
          >
            {flash.text}
          </div>
        )}
      </aside>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#11111c] border border-white/5 p-5">{children}</div>
  )
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-violet-500" : "bg-white/15",
      )}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  )
}

function ChannelPicker({
  channels,
  value,
  onChange,
  placeholder,
}: {
  channels: Channel[]
  value: string | null
  onChange: (v: string | null) => void
  placeholder: string
}) {
  // type 0 = text, 5 = announcement
  const textChannels = useMemo(
    () => channels.filter((c) => c.type === 0 || c.type === 5),
    [channels],
  )
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-lg bg-black/40 border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-violet-500/60"
    >
      <option value="">{placeholder}</option>
      {textChannels.map((c) => (
        <option key={c.id} value={c.id}>
          # {c.name}
        </option>
      ))}
    </select>
  )
}

function PreviewBox({ text, buttons }: { text: string; buttons: WelcomeButton[] }) {
  // Render variables in muted color so the user sees them clearly.
  const tokens = useMemo(() => splitVariables(text), [text])
  return (
    <div className="rounded-xl bg-[#36393f] border border-black/30 p-3 text-sm text-white whitespace-pre-wrap break-words">
      {tokens.length === 0 ? (
        <span className="text-white/40 italic">пусто</span>
      ) : (
        tokens.map((t, i) =>
          t.kind === "var" ? (
            <span key={i} className="rounded bg-violet-500/30 px-1 text-violet-100">
              {t.value}
            </span>
          ) : (
            <span key={i}>{t.value}</span>
          ),
        )
      )}
      {buttons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {buttons.map((b, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#4f545c] border border-black/30 text-xs text-white"
            >
              {b.emoji && <span>{b.emoji}</span>}
              {b.label || "(без названия)"}
              <span className="text-white/40">↗</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function splitVariables(text: string): { kind: "text" | "var"; value: string }[] {
  if (!text) return []
  const out: { kind: "text" | "var"; value: string }[] = []
  const re = /\{[\w.]+\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) })
    out.push({ kind: "var", value: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) })
  return out
}

function VariablesList() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl bg-[#11111c] border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-white"
      >
        <span>Переменные</span>
        <span className="text-white/40">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="px-5 pb-4 space-y-1.5 text-xs">
          {VARIABLES.map((v) => (
            <li key={v.key} className="flex items-baseline gap-2">
              <code className="text-violet-300">{v.key}</code>
              <span className="text-white/50">— {v.desc}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
