import { useState } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useGuildData } from "@/contexts/guild-data-context"
import { SendCustomDialog } from "@/components/guild-dialogs"
import { Send } from "lucide-react"

export function GuildOverviewPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const { channels } = useGuildData()
  const [sendOpen, setSendOpen] = useState(false)

  if (!guildId) return null

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Send Message</CardTitle>
          <CardDescription>
            Send an embed from the bot to a selected channel. Fill in the title, description and optionally specify an image.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send message
          </Button>
        </CardContent>
      </Card>
      <SendCustomDialog
        guildId={guildId}
        channels={channels}
        open={sendOpen}
        onOpenChange={setSendOpen}
      />
    </>
  )
}
