import Link from "next/link"
import { Github } from "lucide-react"
import { ThemeToggle } from "@repo/brand/react"
import { WalletDropdown } from "@/components/wallet-dropdown"

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/docs", label: "Docs" },
  { href: "/settings", label: "Settings" },
]

const iconClass = "inline-flex h-9 w-9 items-center justify-center rounded-xl text-on-chrome-muted transition-all duration-200 hover:bg-on-chrome/10 hover:text-on-chrome"

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-chrome text-on-chrome">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
              <span className="hidden text-[18px] font-bold tracking-tight sm:inline-block">
                Charisma <span className="text-chrome-accent">TX Monitor</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-on-chrome-muted transition-all duration-200 hover:bg-on-chrome/10 hover:text-on-chrome"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <a href="https://github.com/r0zar/charisma" target="_blank" rel="noopener noreferrer" aria-label="Charisma on GitHub" title="Charisma on GitHub" className={`hidden sm:inline-flex ${iconClass}`}>
              <Github className="h-[18px] w-[18px]" />
            </a>
            <ThemeToggle className={iconClass} />
            <WalletDropdown />
          </div>
        </div>
      </div>
    </header>
  )
}
