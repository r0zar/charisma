"use client"

import Link from "next/link"
import { WalletDropdown } from "@/components/wallet-dropdown"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/contexts"
import { Dice1Icon, Dices, Wallet } from "lucide-react"

export function Header() {
  const { walletState, connectWallet } = useWallet()

  return (
    <header className="border-b border-border bg-background shadow-sm">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-bold">
          <Dices className="h-6 w-6" />
        </Link>

        {/* Mobile + Desktop Navigation */}
        <nav className="flex items-center space-x-3 sm:space-x-6">
          <Link href="/lottery" className="text-xs sm:text-sm hover:text-foreground/80">
            Lottery
          </Link>
          <Link href="/results" className="text-xs sm:text-sm hover:text-foreground/80">
            Winners
          </Link>
        </nav>

        {/* Wallet - conditional rendering */}
        {walletState.connected ? (
          <WalletDropdown />
        ) : (
          <Button onClick={connectWallet} className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Connect Wallet</span>
            <span className="sm:hidden">Connect</span>
          </Button>
        )}
      </div>
    </header>
  )
}