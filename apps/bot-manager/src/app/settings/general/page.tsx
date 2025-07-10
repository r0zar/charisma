"use client"

import { Bug, Database, Flag,Globe, Palette, Server, Settings } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
          General application preferences and live environment configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Environment Info */}
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Server className="h-5 w-5" />
            Environment Information
          </h3>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">environment:</span>
              <Badge variant={
                metadata?.environment === 'production' ? 'default' : 
                metadata?.environment === 'staging' ? 'secondary' : 'outline'
              }>
                {metadata?.environment || 'unknown'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">runtime_context:</span>
              <span className="font-semibold">
                {metadata?.isServer ? 'server' : metadata?.isClient ? 'client' : 'unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">last_updated:</span>
              <span className="font-semibold">
                {metadata?.timestamp ? new Date(metadata.timestamp).toLocaleString() : 'unknown'}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* API Configuration */}
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Globe className="h-5 w-5" />
            API Configuration
          </h3>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">base_url:</span>
              <span className="font-semibold">{metadata?.apiBaseUrl || 'unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">timeout:</span>
              <span className="font-semibold">{metadata?.apiTimeout || 'unknown'}ms</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Cache Configuration */}
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cache Configuration
          </h3>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">cache_enabled:</span>
              <Badge variant={metadata?.cacheEnabled ? 'default' : 'secondary'}>
                {metadata?.cacheEnabled ? 'enabled' : 'disabled'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">cache_ttl:</span>
              <span className="font-semibold">{metadata?.cacheTtl || 'unknown'}s</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Debug Configuration */}
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Debug Configuration
          </h3>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">debug_data_loading:</span>
              <Badge variant={metadata?.debugDataLoading ? 'default' : 'outline'}>
                {metadata?.debugDataLoading ? 'on' : 'off'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">log_data_sources:</span>
              <Badge variant={metadata?.logDataSources ? 'default' : 'outline'}>
                {metadata?.logDataSources ? 'on' : 'off'}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Feature Flags */}
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Feature Flags
          </h3>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">enable_api_metadata:</span>
              <Badge variant={metadata?.featureFlags?.enableApiMetadata ? 'default' : 'secondary'}>
                {metadata?.featureFlags?.enableApiMetadata ? 'enabled' : 'disabled'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">enable_api_user:</span>
              <Badge variant={metadata?.featureFlags?.enableApiUser ? 'default' : 'secondary'}>
                {metadata?.featureFlags?.enableApiUser ? 'enabled' : 'disabled'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">enable_api_bots:</span>
              <Badge variant={metadata?.featureFlags?.enableApiBots ? 'default' : 'secondary'}>
                {metadata?.featureFlags?.enableApiBots ? 'enabled' : 'disabled'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">enable_api_market:</span>
              <Badge variant={metadata?.featureFlags?.enableApiMarket ? 'default' : 'secondary'}>
                {metadata?.featureFlags?.enableApiMarket ? 'enabled' : 'disabled'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">enable_api_notifications:</span>
              <Badge variant={metadata?.featureFlags?.enableApiNotifications ? 'default' : 'secondary'}>
                {metadata?.featureFlags?.enableApiNotifications ? 'enabled' : 'disabled'}
              </Badge>
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