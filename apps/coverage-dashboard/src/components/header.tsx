"use client"

import Link from "next/link"
import { WalletDropdown } from "@/components/wallet-dropdown"
import { Shield, Activity } from "lucide-react"

export function Header() {
  return (
    <header className="border-b border-slate-700/50 bg-slate-900/50 shadow-xl backdrop-blur-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-bold flex items-center gap-3 text-white hover:text-blue-400 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg">Coverage Dashboard</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/" className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Dashboard
          </Link>
        </nav>

        {/* Wallet (serves as unified mobile menu) */}
        <WalletDropdown />
      </div>
    </header>
  )
}