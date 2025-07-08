import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/30">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-muted-foreground">
              © 2025 Stone Lottery. Built by <a href="https://charisma.rocks" className="text-primary hover:text-primary/80 transition-colors">Charisma</a>.
            </p>
          </div>
          <div className="flex space-x-6">
            <Link href="/lottery" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Lottery
            </Link>
            <Link href="/analytics" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Analytics
            </Link>
            <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Settings
            </Link>
            <Link href="/settings/appearance" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Themes
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}