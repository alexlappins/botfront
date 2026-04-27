import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LOGIN_URL } from "@/lib/api"

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[hsl(263,70%,15%)] to-[hsl(222,47%,11%)]">
      <Card className="w-full max-w-md border-[hsl(var(--border))] bg-[hsl(var(--card)/0.95)]">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[hsl(var(--primary))] flex items-center justify-center text-3xl">
            💬
          </div>
          <CardTitle className="text-2xl">Bot dashboard</CardTitle>
          <CardDescription>
            Sign in with Discord to manage servers and send messages on behalf of the bot.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button asChild size="lg" className="w-full bg-[#5865F2] hover:bg-[#4752C4]">
            <a href={LOGIN_URL}>Sign in with Discord</a>
          </Button>
          <p className="text-xs text-center text-[hsl(var(--muted-foreground))]">
            Profile and guilds list access will be requested.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
