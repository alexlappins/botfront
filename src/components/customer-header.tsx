import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { LOGOUT_URL } from "@/lib/api"
import { cn } from "@/lib/utils"

export function CustomerHeader({ title }: { title: string }) {
  const location = useLocation()
  const links = [
    { to: "/store", label: "Магазин" },
    { to: "/my-templates", label: "Мои шаблоны" },
    { to: "/my-purchases", label: "Покупки" },
    { to: "/my-servers", label: "Мои серверы" },
  ] as const

  return (
    <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg sm:text-xl font-semibold">{title}</h1>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button variant="outline" size="sm" asChild>
              <a href={LOGOUT_URL}>Выйти</a>
            </Button>
          </div>
        </div>

        <nav className="mt-3 flex flex-wrap gap-2">
          {links.map((l) => {
            const active = location.pathname === l.to || location.pathname.startsWith(`${l.to}/`)
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-colors border",
                  active
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]"
                    : "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
                )}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
