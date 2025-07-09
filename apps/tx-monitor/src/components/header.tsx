"use client"

import Link from "next/link"
import { Database, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            <Link href="/" className="text-lg font-semibold hover:text-foreground/80">
              Tx Monitor
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/dashboard" className="text-sm hover:text-foreground/80">
              Dashboard
            </Link>
            <Link href="/settings" className="text-sm hover:text-foreground/80">
              Settings
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Dashboard
              </Button>
            </Link>
            <Button variant="outline" size="sm" asChild>
              <a href="https://github.com/r0zar/charisma" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}