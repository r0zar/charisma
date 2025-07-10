"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Settings, Palette, Globe } from "lucide-react"
import Link from "next/link"
import { useGlobalState } from "@/contexts/global-state-context"

export default function GeneralSettingsPage() {
  const { appState } = useGlobalState();
  const metadata = appState?.metadata;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Application Settings
        </CardTitle>
        <CardDescription>
          General application preferences and information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* App Info */}
        <div>
          <h3 className="text-lg font-medium mb-3">Application Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">Version</p>
              <p className="text-lg font-semibold">{metadata?.version || 'Unknown'}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">Profile</p>
              <p className="text-lg font-semibold">{metadata?.profile || 'Unknown'}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">Bot Count</p>
              <p className="text-lg font-semibold">{metadata?.botCount || 0}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">Realistic Mode</p>
              <p className="text-lg font-semibold">{metadata?.realistic ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">Generated</p>
              <p className="text-lg font-semibold">{metadata?.generatedAt ? new Date(metadata.generatedAt).toLocaleDateString() : 'Unknown'}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">Seed</p>
              <p className="text-lg font-semibold">{metadata?.seed || 'Unknown'}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Quick Actions */}
        <div>
          <h3 className="text-lg font-medium mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/settings/appearance">
              <Button variant="outline" className="w-full justify-start">
                <Palette className="mr-2 h-4 w-4" />
                Change Theme
              </Button>
            </Link>
            <Link href="/settings/network">
              <Button variant="outline" className="w-full justify-start">
                <Globe className="mr-2 h-4 w-4" />
                Network Settings
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}