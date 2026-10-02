import Link from "next/link"
import { ExternalLink } from "lucide-react"

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
  { href: "https://swap.charisma.rocks", label: "Charisma Swap", external: true },
  { href: "https://docs.charisma.rocks", label: "Documentation", external: true },
  { href: "https://github.com/r0zar/charisma", label: "GitHub", external: true },
]

const linkClass = "inline-flex items-center gap-1 text-sm text-on-chrome-muted transition-colors duration-200 hover:text-on-chrome"

/** Site footer: the lockup and the links that go somewhere real */
export function Footer() {
  return (
    <footer className="border-t border-line bg-chrome text-on-chrome-muted">
      <div className="container mx-auto flex flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
          <span className="text-[17px] font-bold tracking-tight text-on-chrome">Charisma <span className="text-chrome-accent">TX Monitor</span></span>
        </Link>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map(link => link.external ? (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {link.label}<ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <Link key={link.href} href={link.href} className={linkClass}>{link.label}</Link>
          ))}
        </nav>
        <p className="text-sm">© {new Date().getFullYear()} Charisma</p>
      </div>
    </footer>
  )
}
