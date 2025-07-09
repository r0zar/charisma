'use client';

import React, { useState } from 'react';
import { 
  Settings, 
  Cog, 
  Bot, 
  Shield, 
  Bell, 
  Globe, 
  Palette, 
  Database, 
  Key, 
  AlertTriangle,
  CheckCircle,
  Moon,
  Sun,
  Monitor,
  Wifi,
  WifiOff,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Download,
  Upload,
  Trash2,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useSettings } from '@/contexts/settings-context';
import { useNotifications } from '@/contexts/notification-context';

export default function SettingsPage() {
  const { 
    settings, 
    updateGeneralSettings, 
    updateNetworkSettings, 
    updateBotDefaults, 
    updateNotifications, 
    updateNotificationChannel, 
    updateSecuritySettings, 
    updateAdvancedSettings,
    resetSettings,
    exportSettings,
    importSettings,
    regenerateApiKey,
    loading,
    error
  } = useSettings();

  const { showSuccess, showError, showWarning } = useNotifications();
  const [showApiKey, setShowApiKey] = useState(false);
  
  const handleExportData = () => {
    try {
      const settingsData = exportSettings();
      const blob = new Blob([settingsData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bot-manager-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess('Settings exported successfully');
    } catch (error) {
      showError('Failed to export settings', 'Please try again');
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (importSettings(content)) {
            showSuccess('Settings imported successfully');
          } else {
            showError('Failed to import settings', 'Please check the file format');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(settings.security.apiKey)
      .then(() => showSuccess('API key copied to clipboard'))
      .catch(() => showError('Failed to copy API key'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-primary animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Loading Settings...</h2>
          <p className="text-muted-foreground">Please wait while we load your preferences</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings & Configuration</h1>
          <p className="text-muted-foreground">Manage app preferences and bot defaults • Changes are saved automatically</p>
        </div>
        {error && (
          <Alert className="bg-destructive/10 border-destructive/30 max-w-md">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 bg-card border-border">
          <TabsTrigger value="general" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">General</TabsTrigger>
          <TabsTrigger value="bot-defaults" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Bot Defaults</TabsTrigger>
          <TabsTrigger value="notifications" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Notifications</TabsTrigger>
          <TabsTrigger value="security" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Security</TabsTrigger>
          <TabsTrigger value="advanced" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Appearance */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Theme</Label>
                    <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={settings.general.isDarkMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateGeneralSettings({ isDarkMode: true })}
                    >
                      <Moon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={!settings.general.isDarkMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateGeneralSettings({ isDarkMode: false })}
                    >
                      <Sun className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">Reduce spacing for more content</p>
                  </div>
                  <Switch 
                    checked={settings.general.compactMode}
                    onCheckedChange={(checked) => updateGeneralSettings({ compactMode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Auto-refresh</Label>
                    <p className="text-sm text-muted-foreground">Automatically refresh data every 30 seconds</p>
                  </div>
                  <Switch 
                    checked={settings.general.autoRefresh}
                    onCheckedChange={(checked) => updateGeneralSettings({ autoRefresh: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Network */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Network
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-card-foreground">Stacks Network</Label>
                  <Select 
                    value={settings.network.network} 
                    onValueChange={(value) => updateNetworkSettings({ network: value as any })}
                  >
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="mainnet">Mainnet</SelectItem>
                      <SelectItem value="testnet">Testnet</SelectItem>
                      <SelectItem value="devnet">Devnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-card-foreground">RPC Endpoint</Label>
                  <Input
                    value={settings.network.rpcEndpoint}
                    onChange={(e) => updateNetworkSettings({ rpcEndpoint: e.target.value })}
                    placeholder="https://stacks-node-api.mainnet.stacks.co"
                    className="bg-input border-border text-foreground"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Connection Status</Label>
                    <p className="text-sm text-muted-foreground">Current network connection</p>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <Wifi className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bot-defaults" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Default Bot Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-card-foreground">Default Gas Price (microSTX)</Label>
                  <Input
                    type="number"
                    value={settings.botDefaults.defaultGasPrice}
                    onChange={(e) => updateBotDefaults({ defaultGasPrice: parseInt(e.target.value) })}
                    className="bg-input border-border text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Default gas price for new bots</p>
                </div>

                <div>
                  <Label className="text-card-foreground">Default Slippage Tolerance (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={settings.botDefaults.defaultSlippage}
                    onChange={(e) => updateBotDefaults({ defaultSlippage: parseFloat(e.target.value) })}
                    className="bg-input border-border text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Default slippage tolerance for new bots</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-card-foreground">Auto-restart on Error</Label>
                  <p className="text-sm text-muted-foreground">Automatically restart bots when they encounter errors</p>
                </div>
                <Switch
                  checked={settings.botDefaults.autoRestart}
                  onCheckedChange={(checked) => updateBotDefaults({ autoRestart: checked })}
                />
              </div>

              <div>
                <Label className="text-card-foreground">Default Strategy</Label>
                <Select 
                  value={settings.botDefaults.defaultStrategy}
                  onValueChange={(value) => updateBotDefaults({ defaultStrategy: value as any })}
                >
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder="Select default strategy" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="yield-farming">Yield Farming</SelectItem>
                    <SelectItem value="dca">Dollar Cost Averaging</SelectItem>
                    <SelectItem value="arbitrage">Arbitrage Trading</SelectItem>
                    <SelectItem value="liquidity-mining">Liquidity Mining</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert className="bg-blue-500/10 border-blue-500/30">
                <Info className="w-4 h-4 text-blue-400" />
                <AlertDescription className="text-blue-300">
                  These settings will be applied to all newly created bots. Existing bots will keep their current configuration.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Trade Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified when trades are executed</p>
                  </div>
                  <Switch
                    checked={settings.notifications.trade}
                    onCheckedChange={(checked) => updateNotifications({ trade: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Error Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified when bots encounter errors</p>
                  </div>
                  <Switch
                    checked={settings.notifications.error}
                    onCheckedChange={(checked) => updateNotifications({ error: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Status Change Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified when bot status changes</p>
                  </div>
                  <Switch
                    checked={settings.notifications.status}
                    onCheckedChange={(checked) => updateNotifications({ status: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Performance Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified about performance milestones</p>
                  </div>
                  <Switch
                    checked={settings.notifications.performance}
                    onCheckedChange={(checked) => updateNotifications({ performance: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Security Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified about security events</p>
                  </div>
                  <Switch
                    checked={settings.notifications.security}
                    onCheckedChange={(checked) => updateNotifications({ security: checked })}
                  />
                </div>
              </div>

              <Separator className="bg-border" />

              <div>
                <Label className="text-card-foreground">Notification Channel</Label>
                <Select 
                  value={settings.notificationChannel}
                  onValueChange={(value) => updateNotificationChannel(value as any)}
                >
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="browser">Browser Notifications</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-card-foreground">API Key</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.security.apiKey}
                    disabled
                    className="bg-input border-border text-foreground"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="border-border text-foreground"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyApiKey}
                    className="border-border text-foreground"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Used for API access and webhook authentication</p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    regenerateApiKey();
                    showSuccess('API key regenerated successfully');
                    showWarning('Previous API key has been invalidated');
                  }}
                  className="border-yellow-600 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate Key
                </Button>
              </div>

              <Alert className="bg-red-500/10 border-red-500/30">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <AlertDescription className="text-red-300">
                  Keep your API key secure. Regenerating it will invalidate all existing integrations.
                </AlertDescription>
              </Alert>

              <Separator className="bg-border" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Auto-lock Timeout</Label>
                    <p className="text-sm text-muted-foreground">Automatically lock the app after inactivity</p>
                  </div>
                  <Select value={settings.security.autoLockTimeout} onValueChange={(value) => updateSecuritySettings({ autoLockTimeout: value as any })}>
                    <SelectTrigger className="w-32 bg-input border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Require Confirmation</Label>
                    <p className="text-sm text-muted-foreground">Require confirmation for sensitive actions</p>
                  </div>
                  <Switch checked={settings.security.requireConfirmation} onCheckedChange={(checked) => updateSecuritySettings({ requireConfirmation: checked })} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-card-foreground">Data Export</Label>
                  <p className="text-sm text-muted-foreground">Export all bot data and settings</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleExportData}
                  className="border-border text-foreground"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-card-foreground">Data Import</Label>
                  <p className="text-sm text-muted-foreground">Import bot data and settings</p>
                </div>
                <Button
                  variant="outline"
                  className="border-border text-foreground"
                  onClick={handleImportData}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Data
                </Button>
              </div>

              <Separator className="bg-border" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Debug Mode</Label>
                    <p className="text-sm text-muted-foreground">Enable detailed logging and debugging</p>
                  </div>
                  <Switch checked={settings.advanced.debugMode} onCheckedChange={(checked) => updateAdvancedSettings({ debugMode: checked })} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-card-foreground">Performance Monitoring</Label>
                    <p className="text-sm text-muted-foreground">Collect anonymous performance metrics</p>
                  </div>
                  <Switch checked={settings.advanced.performanceMonitoring} onCheckedChange={(checked) => updateAdvancedSettings({ performanceMonitoring: checked })} />
                </div>
              </div>

              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <AlertDescription className="text-yellow-300">
                  Debug mode may impact performance and should only be enabled for troubleshooting.
                </AlertDescription>
              </Alert>

              <Separator className="bg-border" />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-card-foreground">Reset Settings</Label>
                  <p className="text-sm text-muted-foreground">Reset all settings to default values</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetSettings();
                    showSuccess('Settings reset to defaults');
                  }}
                  className="border-red-600 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset All
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}