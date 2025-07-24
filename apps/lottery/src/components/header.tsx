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
          <Dices />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/lottery" className="text-sm hover:text-foreground/80">
            Lottery
          </Link>
          <Link href="/results" className="text-sm hover:text-foreground/80">
            Results
          </Link>
        </nav>

        {/* Wallet - conditional rendering */}
        {walletState.connected ? (
          <WalletDropdown />
        ) : (
          <Button onClick={connectWallet} className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        )}
      </div>
    </header>
  )
}