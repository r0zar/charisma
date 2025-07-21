"use client"

import Link from "next/link"
import { WalletDropdown } from "@/components/wallet-dropdown"

export function Header() {
  return (
    <header className="border-b border-border bg-background shadow-sm">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-bold">
          Balance Collection
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/dashboard" className="text-sm hover:text-foreground/80">
            Dashboard
          </Link>
          <Link href="/discovery" className="text-sm hover:text-foreground/80">
            Discovery
          </Link>
          <Link href="/snapshots" className="text-sm hover:text-foreground/80">
            Snapshots
          </Link>
          <Link href="/collection" className="text-sm hover:text-foreground/80">
            Collection
          </Link>
          <Link href="/settings" className="text-sm hover:text-foreground/80">
            Settings
          </Link>
        </nav>

        {/* Wallet (serves as unified mobile menu) */}
        <WalletDropdown />
      </div>
    </header>
  )
}