import { PublicShell } from "@/components/public-shell"

/**
 * Shop placeholder (Misha TZ §1): the nav item and the hero "Enter the Shop"
 * button stay, but land here until the store launches. Deliberately just the
 * one line, centered, in the site's neon style.
 */
export function ComingSoonPage() {
  return (
    <PublicShell activeNav="shop">
      <div className="grid place-items-center" style={{ minHeight: "60vh" }}>
        <h1
          className="text-4xl sm:text-5xl font-bold uppercase"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            background: "linear-gradient(120deg, #8b92ff, #56e6ff)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: "drop-shadow(0 0 22px rgba(88,101,242,0.55))",
          }}
        >
          Coming soon...
        </h1>
      </div>
    </PublicShell>
  )
}
