import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createTemplate,
  updateTemplate,
  sendFromTemplate,
  sendMessage,
  type Channel,
  type Template,
} from "@/lib/api"

export function CreateTemplateDialog({
  guildId,
  open,
  onOpenChange,
  onSuccess,
}: {
  guildId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [name, setName] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [image, setImage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) {
      setErr("Название обязательно")
      return
    }
    setErr(null)
    setSubmitting(true)
    try {
      await createTemplate(guildId, {
        name: name.trim(),
        title: title.trim() || null,
        description: description.trim() || null,
        image: image.trim() || null,
      })
      setName("")
      setTitle("")
      setDescription("")
      setImage("")
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый шаблон</DialogTitle>
          <DialogDescription>Заполните поля эмбеда. Название обязательно.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Название шаблона *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Приветствие" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Заголовок эмбеда</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Описание</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Текст описания" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="image">URL картинки</Label>
            <Input id="image" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." />
          </div>
          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Создание…" : "Создать"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EditTemplateDialog({
  guildId,
  template,
  open,
  onOpenChange,
  onSuccess,
}: {
  guildId: string
  template: Template
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(template.name)
  const [title, setTitle] = useState(template.title ?? "")
  const [description, setDescription] = useState(template.description ?? "")
  const [image, setImage] = useState(template.image ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) {
      setErr("Название обязательно")
      return
    }
    setErr(null)
    setSubmitting(true)
    try {
      await updateTemplate(guildId, template.id, {
        name: name.trim(),
        title: title.trim() || null,
        description: description.trim() || null,
        image: image.trim() || null,
      })
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать шаблон</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Название *</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-title">Заголовок</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Описание</Label>
            <Input id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-image">URL картинки</Label>
            <Input id="edit-image" value={image} onChange={(e) => setImage(e.target.value)} />
          </div>
          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Сохранение…" : "Сохранить"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SendTemplateDialog({
  guildId,
  template,
  channels,
  open,
  onOpenChange,
  onSuccess,
}: {
  guildId: string
  template: Template
  channels: Channel[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [channelId, setChannelId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!channelId) {
      setErr("Выберите канал")
      return
    }
    setErr(null)
    setSubmitting(true)
    try {
      await sendFromTemplate(guildId, template.id, channelId)
      onSuccess()
      onOpenChange(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка отправки")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Отправить шаблон «{template.name}»</DialogTitle>
          <DialogDescription>Выберите канал для отправки сообщения от имени бота.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Канал</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите канал" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    # {ch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {channels.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">Нет текстовых каналов.</p>}
          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={submit} disabled={submitting || channels.length === 0}>
            {submitting ? "Отправка…" : "Отправить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SendCustomDialog({
  guildId,
  channels,
  open,
  onOpenChange,
}: {
  guildId: string
  channels: Channel[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [channelId, setChannelId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [image, setImage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!channelId) {
      setErr("Выберите канал")
      return
    }
    setErr(null)
    setSubmitting(true)
    try {
      await sendMessage(guildId, {
        channelId,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        image: image.trim() || undefined,
      })
      onOpenChange(false)
      setChannelId("")
      setTitle("")
      setDescription("")
      setImage("")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка отправки")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Отправить сообщение</DialogTitle>
          <DialogDescription>Заполните поля эмбеда и выберите канал. Сообщение отправится от имени бота.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Канал *</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите канал" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    # {ch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="custom-title">Заголовок</Label>
            <Input id="custom-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок эмбеда" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="custom-description">Описание</Label>
            <Input id="custom-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Текст" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="custom-image">URL картинки</Label>
            <Input id="custom-image" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." />
          </div>
          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={submit} disabled={submitting || channels.length === 0}>
            {submitting ? "Отправка…" : "Отправить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
