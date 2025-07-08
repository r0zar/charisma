"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Settings, Monitor, Palette, Network } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Footer } from "@/components/footer"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  // Determine active tab from pathname
  const getActiveTab = () => {
    if (pathname.includes('/general')) return 'general'
    if (pathname.includes('/appearance')) return 'appearance'
    if (pathname.includes('/network')) return 'network'
    return 'general' // default
  }

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* Settings page background textures */}
      <div className="fixed inset-0 bg-diamond-pattern opacity-30 pointer-events-none"></div>
      <div className="fixed inset-0 bg-luxury-texture opacity-50 pointer-events-none"></div>
      
      <div className="container mx-auto p-6 max-w-4xl flex-1 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your application preferences and wallet settings
          </p>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={getActiveTab()} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <Link href="/settings/general">
              <TabsTrigger value="general" className="flex items-center gap-2 w-full">
                <Monitor className="h-4 w-4" />
                <span className="hidden sm:inline">General</span>
              </TabsTrigger>
            </Link>
            <Link href="/settings/appearance">
              <TabsTrigger value="appearance" className="flex items-center gap-2 w-full">
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">Appearance</span>
              </TabsTrigger>
            </Link>
            <Link href="/settings/network">
              <TabsTrigger value="network" className="flex items-center gap-2 w-full">
                <Network className="h-4 w-4" />
                <span className="hidden sm:inline">Network</span>
              </TabsTrigger>
            </Link>
          </TabsList>

          {/* Content */}
          <div className="space-y-6">
            {children}
          </div>
        </Tabs>
      </div>

      <Footer />
    </div>
  )
}