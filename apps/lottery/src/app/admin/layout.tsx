"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Settings, LayoutDashboard, Play, Wrench, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { AdminProvider, useAdmin } from "./admin-context"

const ADMIN_TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { id: "current-draw", label: "Current Draw", icon: Play, path: "/admin/current-draw" },
  { id: "configuration", label: "Configuration", icon: Settings, path: "/admin/configuration" },
  { id: "debug", label: "Debug & Repair", icon: Wrench, path: "/admin/debug" },
  { id: "system", label: "System", icon: AlertTriangle, path: "/admin/system" }
]

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { success, error } = useAdmin()
  const pathname = usePathname()
  const router = useRouter()
  const [adminKey, setAdminKey] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedKey = localStorage.getItem('admin-key')
    if (savedKey) {
      setAdminKey(savedKey)
      verifyAuthentication(savedKey)
    } else {
      setLoading(false)
    }
  }, [])

  const verifyAuthentication = async (key: string) => {
    try {
      const response = await fetch('/api/admin/lottery-config', {
        headers: { 'x-admin-key': key }
      })

      if (response.ok) {
        setIsAuthenticated(true)
        setLocalError(null)
      } else {
        setIsAuthenticated(false)
        localStorage.removeItem('admin-key')
      }
    } catch (err) {
      setIsAuthenticated(false)
      localStorage.removeItem('admin-key')
    } finally {
      setLoading(false)
    }
  }

  const handleAuthentication = async () => {
    try {
      const response = await fetch('/api/admin/lottery-config', {
        headers: { 'x-admin-key': adminKey }
      })

      if (response.ok) {
        setIsAuthenticated(true)
        localStorage.setItem('admin-key', adminKey)
        setLocalError(null)
      } else {
        setLocalError(`Invalid admin key (${response.status})`)
      }
    } catch (err) {
      setLocalError('Authentication failed')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('admin-key')
    setAdminKey('')
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div className="text-lg">Loading admin panel...</div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Settings className="h-5 w-5" />
              Admin Access
            </CardTitle>
            <CardDescription>
              Enter your admin key to access the lottery management panel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-key">Admin Key</Label>
              <Input
                id="admin-key"
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter admin key"
                onKeyDown={(e) => e.key === 'Enter' && handleAuthentication()}
              />
            </div>

            {localError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {localError}
              </div>
            )}

            <div className="space-y-2">
              <Button onClick={handleAuthentication} className="w-full">
                Access Admin Panel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  localStorage.removeItem('admin-key')
                  setAdminKey('')
                  setLocalError(null)
                }}
                className="w-full text-xs"
              >
                Clear Saved Key
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeTab = ADMIN_TABS.find(tab =>
    tab.path === pathname || (tab.path !== "/admin" && pathname.startsWith(tab.path))
  ) || ADMIN_TABS[0]

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
          <Settings className="h-10 w-10 text-primary" />
          Lottery Admin Panel
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage lottery configuration, jackpots, and draws
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b">
        <div className="flex gap-1">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab.id === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.path)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <Button
          onClick={handleLogout}
          variant="ghost"
          size="sm"
        >
          Logout
        </Button>
      </div>

      {/* Global Status Messages */}
      {(error || localError) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error || localError}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Tab Content */}
      {children}
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminProvider>
  )
}
