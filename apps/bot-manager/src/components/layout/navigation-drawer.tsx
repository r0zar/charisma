'use client';

import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import {
  AlertCircle,
  Bell,
  Bot,
  Home,
  Pause,
  Plus,
  Search,
  Settings,
  TrendingUp
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState } from 'react';
import { Drawer } from 'vaul';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBots } from '@/contexts/bot-context';
import { useNotificationsData } from '@/contexts/notifications-context';
import { useSearch } from '@/contexts/search-context';
import { useAlphaAccess } from '@/hooks/use-alpha-access';
import { cn } from '@/lib/utils';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/bots': 'Bot Management',
  '/activity': 'Activity & History',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
  '/settings/general': 'General Settings',
  '/settings/appearance': 'Appearance Settings',
  '/settings/network': 'Network Settings',
  '/profile': 'Profile'
};

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    description: 'Overview and metrics'
  },
  {
    name: 'Bots',
    href: '/bots',
    icon: Bot,
    description: 'Manage your bots'
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'App configuration'
  }
];

export function NavigationDrawer() {
  const pathname = usePathname();
  const { botStats, bots } = useBots();
  const hasAlphaAccess = useAlphaAccess();
  const { openSearch } = useSearch();
  const snapPoints = ['20px', '80px', 0.8];
  const [snap, setSnap] = useState<number | string | null>(snapPoints[1]);
  const [open, setOpen] = useState(true);
  const {
    notifications: liveNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationsData();

  const currentPageTitle = pageTitles[pathname] || 'Tokemon';
  const unreadCount = getUnreadCount();

  const recentNotifications = (Array.isArray(liveNotifications) ? liveNotifications : [])
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'error': return '🔴';
      case 'warning': return '🟡';
      case 'success': return '🟢';
      case 'info': return '🔵';
      default: return '📢';
    }
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const MobileNavigationBar = () => (
    <div className="flex items-center justify-between p-4 bg-background">
      {/* Left: Page Title */}
      <div className="flex flex-col min-w-0 flex-1">
        <h1 className="text-sm font-semibold text-foreground truncate">{currentPageTitle}</h1>
        <p className="text-xs text-muted-foreground">
          {botStats.totalBots} bots • {botStats.activeBots} active
        </p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Create Bot Button */}
        {hasAlphaAccess ? (
          <Button
            asChild
            variant="outline"
            size="icon"
            className="h-9 w-9 flex flex-col items-center justify-center"
          >
            <Link href="/bots/create">
              <Plus className="w-4 h-4" />
            </Link>
          </Button>
        ) : (
          <Button
            disabled
            variant="outline"
            size="icon"
            className="h-9 w-9 flex flex-col items-center justify-center opacity-50"
            title="Bot creation is currently in alpha. Add #alpha to the URL for access."
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}

        {/* Search Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={openSearch}
          className="h-9 w-9 flex flex-col items-center justify-center"
        >
          <Search className="w-4 h-4" />
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative h-9 w-9 flex flex-col items-center justify-center">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-xs bg-destructive text-destructive-foreground"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-background/95 backdrop-blur-2xl border-border/30 shadow-2xl ring-1 ring-background/10">
            <DropdownMenuLabel className="text-foreground flex items-center justify-between">
              <span>Notifications {unreadCount > 0 && `(${unreadCount} unread)`}</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-6 px-2 text-xs"
                >
                  Mark all read
                </Button>
              )}
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
                  className={`group text-muted-foreground hover:text-foreground hover:bg-background/10 hover:backdrop-blur-xl cursor-pointer ${!notification.read ? 'bg-background/5' : ''}`}
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
                        <div className="flex items-center gap-1">
                          {!notification.read && (
                            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="h-4 w-4 p-0 text-xs opacity-0 group-hover:opacity-100 hover:text-destructive"
                          >
                            ×
                          </Button>
                        </div>
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
            {Array.isArray(liveNotifications) && liveNotifications.length > 5 && (
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
        <SignedIn>
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: {
                  width: '2.25rem',
                  height: '2.25rem',
                },
              },
            }}
          />
        </SignedIn>

        <SignedOut>
          <SignInButton
            mode="modal"
            signUpForceRedirectUrl="/dashboard"
            forceRedirectUrl="/dashboard"
          >
            <Button
              variant="outline"
              size="sm"
              className="h-9 bg-background/5 backdrop-blur-2xl border-border/30 hover:bg-background/10 hover:border-primary/50 transition-all duration-200"
            >
              Sign In
            </Button>
          </SignInButton>
        </SignedOut>
      </div>
    </div>
  );

  const DrawerExpandedContent = () => (
    <div className="flex flex-col h-full p-4 space-y-6">
      {/* Header Section - Horizontal layout for wider space */}
      <div className="flex items-center gap-6">
        <div className="relative w-20 h-20 flex-shrink-0">
          <Image
            src="/tokemon.png"
            alt="Tokemon"
            fill
            className="object-contain object-center"
            priority
            quality={90}
            style={{ imageRendering: 'auto' }}
          />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">Bot Management</h2>
          <p className="text-sm text-muted-foreground">Manage your DeFi automation bots</p>
        </div>
      </div>

      {/* Quick Stats - Horizontal layout */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card rounded-lg p-3 text-center">
          <Bot className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xl font-semibold text-foreground">{botStats.totalBots}</p>
          <p className="text-xs text-muted-foreground">Bots</p>
        </div>
        <div className="bg-card rounded-lg p-3 text-center">
          <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-semibold text-green-500">{botStats.activeBots}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="bg-card rounded-lg p-3 text-center">
          <Pause className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
          <p className="text-xl font-semibold text-yellow-500">{botStats.totalBots - botStats.activeBots}</p>
          <p className="text-xs text-muted-foreground">Paused</p>
        </div>
        <div className="bg-card rounded-lg p-3 text-center">
          <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
          <p className="text-xl font-semibold text-red-500">0</p>
          <p className="text-xs text-muted-foreground">Errors</p>
        </div>
      </div>

      {/* Recent Bots and Navigation - Side by side on larger screens */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bots Section - Hidden on mobile */}
        <div className="hidden lg:block">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">Recent Bots</h3>
            <Link href="/bots" className="text-xs text-primary hover:text-primary/80">
              View All
            </Link>
          </div>
          {bots.length > 0 ? (
            <div className="grid grid-cols-2 2xl:grid-cols-3 4xl:grid-cols-4 gap-3">
              {bots.slice(0, 4).map((bot) => (
                <Link
                  key={bot.id}
                  href={`/bots/${bot.id}`}
                  className="bg-card border border-border/30 rounded-lg p-4 hover:bg-accent/50 transition-colors group h-[100px] flex flex-col"
                >
                  {/* Top row: Avatar + Name + Status */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-10 h-10 rounded-lg">
                        <AvatarImage src={bot.image} alt={bot.name} />
                        <AvatarFallback className="bg-primary/20 rounded-lg">
                          <Bot className="w-5 h-5 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute -top-1 -right-1 w-3 h-3 rounded-full border border-background",
                        bot.status === 'active' ? "bg-green-500" :
                          bot.status === 'paused' ? "bg-yellow-500" :
                            bot.status === 'error' ? "bg-red-500" : "bg-gray-500"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm leading-tight truncate">
                        {bot.name}
                      </div>
                      <div className="text-xs text-muted-foreground leading-tight truncate">
                        {bot.status === 'active' ? 'Running automated strategy' :
                          bot.status === 'paused' ? 'Strategy paused' :
                            bot.status === 'error' ? 'Needs attention' :
                              bot.status === 'setup' ? 'Configuration required' :
                                'Ready to deploy'}
                      </div>
                    </div>
                    {bot.schedulingInfo?.isOverdue && (
                      <div className="text-xs text-red-500 font-medium bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded">
                        Overdue
                      </div>
                    )}
                  </div>

                  {/* Bottom row: Stats on left, timing on right */}
                  <div className="flex items-end justify-between mt-auto">
                    <div className="flex items-center gap-1.5">
                      {bot.executionCount > 0 && (
                        <>
                          <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">
                            {bot.executionCount} runs
                          </div>
                          {bot.executionStats && bot.executionStats.totalExecutions > 0 && (
                            <div className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded font-medium">
                              {Math.round((bot.executionStats.successfulExecutions / bot.executionStats.totalExecutions) * 100)}%
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {bot.nextExecution ?
                        `Next: ${new Date(bot.nextExecution).toLocaleDateString()}` :
                        bot.lastExecution || bot.lastActive ?
                          `Last: ${new Date(bot.lastExecution || bot.lastActive).toLocaleDateString()}` :
                          'No activity'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Bot className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p>No bots created yet</p>
            </div>
          )}
        </div>

        {/* Navigation Section */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Quick Navigation</h3>
          <div className="grid grid-cols-2 gap-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg transition-colors border',
                    isActive
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 border-border/30'
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <div className="font-medium text-sm leading-tight">{item.name}</div>
                    <div className="text-xs text-muted-foreground/70 leading-tight">{item.description}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );

  return (
    <>
      <Drawer.Root
        open={open}
        onOpenChange={setOpen}
        snapPoints={snapPoints}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        modal={false}
        dismissible={false}
      >
        {/* @ts-ignore */}
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
          <Drawer.Content className="bg-background/95 backdrop-blur-md border-t border-border/30 flex flex-col rounded-t-[10px] h-full fixed bottom-0 left-0 right-0 z-50">
            <Drawer.Title className="sr-only">Navigation Drawer</Drawer.Title>
            <div className="flex flex-col h-full">
              {/* Drag Handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Content based on snap state */}
              <div className="flex-1 overflow-hidden">
                {/* Always show navigation bar for navbar and large states */}
                {(snap === snapPoints[1] || snap === snapPoints[2]) && (
                  <div className="flex-shrink-0">
                    <MobileNavigationBar />
                  </div>
                )}

                {/* Large state (70%) - Show additional drawer content below navbar */}
                {snap === snapPoints[2] && (
                  <div className="flex-1 overflow-hidden">
                    <DrawerExpandedContent />
                  </div>
                )}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}