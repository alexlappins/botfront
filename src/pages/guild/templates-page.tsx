import { useState } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useGuildData } from "@/contexts/guild-data-context"
import { deleteTemplate } from "@/lib/api"
import type { Template } from "@/lib/api"
import {
  CreateTemplateDialog,
  EditTemplateDialog,
  SendTemplateDialog,
} from "@/components/guild-dialogs"
import { Plus, Send, Pencil, Trash2 } from "lucide-react"

export function GuildTemplatesPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const { templates, channels, load } = useGuildData()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)
  const [sendTemplate, setSendTemplate] = useState<Template | null>(null)

  if (!guildId) return null

  async function handleDelete(t: Template) {
    if (!confirm(`Delete template "${t.name}"?`)) return
    try {
      await deleteTemplate(guildId!, t.id)
      load()
    } catch {
      // error handled in context
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Message Templates</CardTitle>
            <CardDescription>
              Create a template and send it to any channel with one click.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create template
          </Button>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No templates. Create your first one.</p>
          ) : (
            <ul className="space-y-3">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{t.name}</p>
                    {t.title && <p className="text-sm text-[hsl(var(--muted-foreground))] truncate">{t.title}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSendTemplate(t)}>
                      <Send className="h-4 w-4 mr-1" />
                      Send
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditTemplate(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-[hsl(var(--destructive))]" onClick={() => handleDelete(t)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CreateTemplateDialog
        guildId={guildId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => { setCreateOpen(false); load() }}
      />
      {editTemplate && (
        <EditTemplateDialog
          guildId={guildId}
          template={editTemplate}
          open={!!editTemplate}
          onOpenChange={(open) => !open && setEditTemplate(null)}
          onSuccess={() => { setEditTemplate(null); load() }}
        />
      )}
      {sendTemplate && (
        <SendTemplateDialog
          guildId={guildId}
          template={sendTemplate}
          channels={channels}
          open={!!sendTemplate}
          onOpenChange={(open) => !open && setSendTemplate(null)}
          onSuccess={() => setSendTemplate(null)}
        />
      )}
    </>
  )
}
