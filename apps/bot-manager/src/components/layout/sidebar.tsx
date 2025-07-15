'use client';

import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import {
  Bell,
  Bot,
  Home,
  Menu,
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

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { botStats } = useBots();
  const hasAlphaAccess = useAlphaAccess();
  const { openSearch } = useSearch();
  const [isOpen, setIsOpen] = useState(true);
  const [snapPoint, setSnapPoint] = useState(120);
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

  const toggleDrawer = () => {
    if (snapPoint === 120) {
      setSnapPoint(1); // Expand to 85% height
    } else {
      setSnapPoint(120); // Collapse to nav bar only (120px)
    }
  };

  const MobileNavigationBar = () => (
    <div className="flex items-center justify-between p-4 bg-background border-t border-border/30">
      {/* Left: Page Title */}
      <div className="flex flex-col min-w-0 flex-1">
        <h1 className="text-sm font-semibold text-foreground truncate">{currentPageTitle}</h1>
        <p className="text-xs text-muted-foreground">
          {botStats.totalBots} bots • {botStats.activeBots} active
        </p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-center border-b border-border/25">
        <div className="relative w-full h-28 max-w-full mx-auto overflow-hidden antialiased">
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
      </div>

      {/* Quick Stats */}
      <div className="p-4 border-b border-border/25">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-1 bg-card rounded-lg flex flex-row items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              {/* <span className="text-xs text-muted-foreground">Total</span> */}
            </div>
            <p className="text-lg font-semibold text-foreground">{botStats.totalBots}</p>
          </div>
          <div className="p-1 bg-card rounded-lg flex flex-row items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              {/* <span className="text-xs text-muted-foreground">Active</span> */}
            </div>
            <p className="text-lg font-semibold text-green-500">{botStats.activeBots}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-border/25 pl-2'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
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
      </nav>

      {/* Create Bot Button */}
      <div className="p-4 border-t border-border/25">
        {hasAlphaAccess ? (
          <Button
            asChild
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Link href="/bots/create">
              <Plus className="w-4 h-4 mr-2" />
              Create Bot
            </Link>
          </Button>
        ) : (
          <Button
            disabled
            className="w-full bg-muted text-muted-foreground cursor-not-allowed"
            title="Bot creation is currently in alpha. Add #alpha to the URL for access."
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Bot (Alpha)
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Drawer.Root 
        open
        snapPoints={[120, 0.85]} 
        activeSnapPoint={snapPoint === 120 ? 120 : 0.85}
        fadeFromIndex={1} 
        modal={false} 
        dismissible={false}
        onSnapPointChange={(point) => setSnapPoint(point === 120 ? 120 : 1)}
      >
        <Drawer.Content className="bg-background flex flex-col h-fit">
          {/* Navigation Bar - Always Visible */}
          <div className="cursor-pointer" onClick={toggleDrawer}>
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-300 my-2" />
            <MobileNavigationBar />
          </div>
          
          {/* Expandable Content */}
          <div className="flex-1 overflow-y-auto p-4 max-h-[60vh]">
            <SidebarContent />
          </div>
        </Drawer.Content>
      </Drawer.Root>

      {/* Floating Action Button */}
      <Button
        onClick={toggleDrawer}
        className="fixed bottom-32 right-4 z-50 h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        size="icon"
      >
        <Menu className="w-5 h-5" />
      </Button>
    </>
  );
}