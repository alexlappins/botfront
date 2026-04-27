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
      setErr("Name is required")
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
      setErr(e instanceof Error ? e.message : "Error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Template</DialogTitle>
          <DialogDescription>Fill in the embed fields. Name is required.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Template name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Welcome" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Embed title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description text" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="image">Image URL</Label>
            <Input id="image" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." />
          </div>
          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button>
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
      setErr("Name is required")
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
      setErr(e instanceof Error ? e.message : "Error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-image">Image URL</Label>
            <Input id="edit-image" value={image} onChange={(e) => setImage(e.target.value)} />
          </div>
          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button>
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
      setErr("Select a channel")
      return
    }
    setErr(null)
    setSubmitting(true)
    try {
      await sendFromTemplate(guildId, template.id, channelId)
      onSuccess()
      onOpenChange(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Send error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send template "{template.name}"</DialogTitle>
          <DialogDescription>Select a channel to send the message from the bot.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Channel</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a channel" />
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
          {channels.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No text channels.</p>}
          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || channels.length === 0}>
            {submitting ? "Sending…" : "Send"}
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
      setErr("Select a channel")
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
      setErr(e instanceof Error ? e.message : "Send error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
          <DialogDescription>Fill in the embed fields and choose a channel. The message will be sent from the bot.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Channel *</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a channel" />
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
            <Label htmlFor="custom-title">Title</Label>
            <Input id="custom-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Embed title" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="custom-description">Description</Label>
            <Input id="custom-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Text" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="custom-image">Image URL</Label>
            <Input id="custom-image" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." />
          </div>
          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || channels.length === 0}>
            {submitting ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
