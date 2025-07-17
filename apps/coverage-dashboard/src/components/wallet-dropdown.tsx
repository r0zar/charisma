"use client"

import { useState, useEffect } from "react"
import { Settings, User, Menu, BarChart3, Home, Wallet, Palette } from "lucide-react"
import { useWallet } from "@/contexts"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"


function MenuContent({ onClose }: { onClose?: () => void }) {
  const { walletState, network, connectWallet, disconnectWallet, isConnecting } = useWallet()

  const handleWalletAction = () => {
    if (!walletState.connected) {
      connectWallet()
    } else {
      disconnectWallet()
    }
    onClose?.()
  }

  const menuItems = [
    {
      icon: Home,
      title: "Dashboard",
      href: "/",
    },
    {
      icon: BarChart3,
      title: "Reports",
      href: "/reports",
    },
    {
      icon: Settings,
      title: "Settings",
      href: "/settings",
    },
    {
      icon: Palette,
      title: "Themes",
      href: "/themes",
    },
  ]

  const visibleItems = menuItems.filter(item => !item.hidden)

  return (
    <div className="p-6 bg-slate-900/95">
      <div className="mb-4 text-center">
        <h3 className="text-lg font-bold text-white mb-2">Coverage Dashboard</h3>
        <p className="text-xs text-slate-400">Navigation & Settings</p>
      </div>

      {/* 2x2 Icon Grid */}
      <div className="grid grid-cols-2 gap-4">
        {visibleItems.map((item, index) => {
          const Icon = item.icon
          
          if (item.onClick) {
            return (
              <button
                key={index}
                onClick={item.onClick}
                disabled={item.disabled}
                className="flex flex-col items-center space-y-2 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
              >
                <Icon className="h-6 w-6 text-blue-400" />
                <span className="text-xs font-medium text-slate-200">{item.title}</span>
              </button>
            )
          }

          return (
            <Link
              key={index}
              href={item.href!}
              onClick={onClose}
              className="flex flex-col items-center space-y-2 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
            >
              <Icon className="h-6 w-6 text-blue-400" />
              <span className="text-xs font-medium text-slate-200">{item.title}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}


export function WalletDropdown() {
  const { walletState, network, connectWallet: _connectWallet, isConnecting: _isConnecting } = useWallet()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Always show menu button for navigation
  const trigger = (
    <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700/50">
      <Menu className="h-5 w-5" />
    </Button>
  )

  // Don't render drawer on server side
  if (!mounted) {
    return trigger
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="max-h-[60vh]">
        <DrawerTitle className="sr-only">Menu</DrawerTitle>
        <MenuContent onClose={() => setOpen(false)} />
      </DrawerContent>
    </Drawer>
  )
}