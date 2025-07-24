"use client"

import { useState, useEffect } from "react"
import { Settings, LogOut, User, Menu, Dice6, Home, Wallet, Palette } from "lucide-react"
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
      icon: Dice6,
      title: "Lottery",
      href: "/lottery",
    },
    {
      icon: Settings,
      title: "Settings",
      href: "/settings",
    },
    {
      icon: Wallet,
      title: walletState.connected ? "Disconnect" : "Connect",
      onClick: handleWalletAction,
      disabled: isConnecting,
    },
    {
      icon: Settings,
      title: "Network",
      href: "/settings",
      hidden: !walletState.connected,
    },
    {
      icon: Palette,
      title: "Theme",
      href: "/settings/appearance",
    },
  ]

  const visibleItems = menuItems.filter(item => !item.hidden)

  return (
    <div className="p-6">
      {/* Connection Status */}
      {walletState.connected && (
        <div className="mb-6 text-center">
          <Badge variant={network === "mainnet" ? "default" : "secondary"} className="mb-2">
            {network}
          </Badge>
          <div className="text-xs font-mono text-muted-foreground">
            {walletState.address.slice(0, 8)}...{walletState.address.slice(-6)}
          </div>
        </div>
      )}

      {/* 3x3 Icon Grid */}
      <div className="grid grid-cols-3 gap-4">
        {visibleItems.map((item, index) => {
          const Icon = item.icon

          if (item.onClick) {
            return (
              <button
                key={index}
                onClick={item.onClick}
                disabled={item.disabled}
                className="flex flex-col items-center space-y-2 p-4 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{item.title}</span>
              </button>
            )
          }

          return (
            <Link
              key={index}
              href={item.href!}
              onClick={onClose}
              className="flex flex-col items-center space-y-2 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs font-medium">{item.title}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}


export function WalletDropdown() {
  const { walletState, network, connectWallet, isConnecting } = useWallet()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Always show menu button (handles both navigation and wallet for all screen sizes)
  const trigger = walletState.connected ? (
    <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
      <Avatar className="h-8 w-8">
        <AvatarFallback>
          <User className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <Badge
        variant={network === "mainnet" ? "default" : "secondary"}
        className="absolute -top-1 -right-1 h-4 w-4 text-xs p-0 flex items-center justify-center"
      >
        {network === "mainnet" ? "M" : "T"}
      </Badge>
    </Button>
  ) : (
    <Button variant="ghost" >
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