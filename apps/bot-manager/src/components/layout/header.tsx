'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { 
  Bell,
  Search,
  RefreshCw,
  Settings,
  User,
  Wallet,
  LogOut,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useBots } from '@/contexts/bot-context';
import { useWallet } from '@/contexts/wallet-context';
import { useNotifications } from '@/contexts/notification-context';
import { useGlobalState } from '@/contexts/global-state-context';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/bots': 'Bot Management',
  '/activity': 'Activity & History',
  '/analytics': 'Analytics',
  '/settings': 'Settings'
};

export function Header() {
  const pathname = usePathname();
  const { refreshData, loading, botStats } = useBots();
  const { walletState, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();
  const { appState } = useGlobalState();

  const currentPageTitle = pageTitles[pathname] || 'Bot Manager';

  const handleRefresh = async () => {
    await refreshData();
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const handleWalletAction = async () => {
    if (walletState.connected) {
      disconnectWallet();
    } else {
      await connectWallet();
    }
  };

  // Get notifications from global state
  const notifications = appState?.notifications || [];
  const unreadCount = notifications.filter(n => !n.read).length;
  const recentNotifications = notifications
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5); // Show last 5 notifications

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'error': return '🔴';
      case 'warning': return '🟡';
      case 'success': return '🟢';
      case 'info': return '🔵';
      default: return '📢';
    }
  };

  const handleNotificationClick = (notification: any) => {
    // Mark as read and potentially navigate to actionUrl
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    // In a real app, you'd update the notification's read status
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/30 bg-transparent backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/0">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        {/* Left: Page Title */}
        <div className="flex items-center gap-4">
          <div className="ml-12 lg:ml-0">
            <h1 className="text-xl font-semibold text-foreground">{currentPageTitle}</h1>
            <p className="text-sm text-muted-foreground">
              {botStats.totalBots} bots • {botStats.activeBots} active
            </p>
          </div>
        </div>

        {/* Center: Search (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search bots, transactions..."
              className="pl-10 bg-background/5 border-border/30 text-foreground placeholder:text-muted-foreground backdrop-blur-xl shadow-2xl ring-1 ring-background/10"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
            className="h-10 w-10 flex flex-col items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative h-10 w-10 flex flex-col items-center justify-center">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs bg-red-500 text-white"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-background/5 backdrop-blur-2xl border-border/30 shadow-2xl ring-1 ring-background/10">
              <DropdownMenuLabel className="text-foreground">
                Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/30" />
              {recentNotifications.length === 0 ? (
                <DropdownMenuItem className="text-muted-foreground cursor-default">
                  <div className="flex items-center justify-center w-full py-4">
                    <p className="text-sm">No notifications</p>
                  </div>
                </DropdownMenuItem>
              ) : (
                recentNotifications.map((notification) => (
                  <DropdownMenuItem 
                    key={notification.id}
                    className={`text-muted-foreground hover:text-foreground hover:bg-background/10 hover:backdrop-blur-xl cursor-pointer ${!notification.read ? 'bg-background/5' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="flex-shrink-0 mt-0.5">
                        <span className="text-sm">{getNotificationIcon(notification.type)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`font-medium text-sm ${!notification.read ? 'text-foreground' : ''}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2" />
                          )}
                        </div>
                        {notification.message && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              {notifications.length > 5 && (
                <>
                  <DropdownMenuSeparator className="bg-border/30" />
                  <DropdownMenuItem className="text-center text-muted-foreground hover:text-foreground hover:bg-background/10">
                    <span className="w-full text-sm">View all notifications</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="relative h-10 w-10 rounded-lg">
                <Avatar className="h-6 w-6 border border-border">
                  <AvatarImage src="/placeholder-user.jpg" alt="User" />
                  <AvatarFallback className="bg-card text-foreground text-xs">
                    {walletState.connected ? walletState.address.charAt(0).toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-background/5 backdrop-blur-2xl border-border/30 shadow-2xl ring-1 ring-background/10" align="end" forceMount>
              <DropdownMenuLabel className="font-normal text-foreground">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">
                    {walletState.connected ? 'Wallet Connected' : 'Not Connected'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {walletState.connected ? formatAddress(walletState.address) : 'Connect wallet to get started'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem className="text-muted-foreground hover:text-foreground hover:bg-background/10 hover:backdrop-blur-xl">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-muted-foreground hover:text-foreground hover:bg-background/10 hover:backdrop-blur-xl"
                onClick={handleWalletAction}
                disabled={isConnecting}
              >
                <Wallet className="mr-2 h-4 w-4" />
                <span>
                  {isConnecting ? 'Connecting...' : walletState.connected ? 'Disconnect Wallet' : 'Connect Wallet'}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-muted-foreground hover:text-foreground hover:bg-background/10 hover:backdrop-blur-xl">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-muted-foreground hover:text-foreground hover:bg-background/10 hover:backdrop-blur-xl">
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Help</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem 
                className="text-muted-foreground hover:text-foreground hover:bg-background/10 hover:backdrop-blur-xl"
                onClick={() => walletState.connected && disconnectWallet()}
                disabled={!walletState.connected}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{walletState.connected ? 'Log out' : 'Not connected'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Search */}
      <div className="md:hidden border-t border-border/30 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search bots, transactions..."
            className="pl-10 bg-background/5 border-border/30 text-foreground placeholder:text-muted-foreground backdrop-blur-xl shadow-2xl ring-1 ring-background/10"
          />
        </div>
      </div>
    </header>
  );
}