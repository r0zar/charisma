'use client';

import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import {
  Bell,
  Search
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import React from 'react';

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
import { useAppAuth } from '@/contexts/auth-context';
import { useBots } from '@/contexts/bot-context';
import { useNotificationsData } from '@/contexts/notifications-context';
import { useSearch } from '@/contexts/search-context';

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

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { botStats } = useBots();
  const { isAuthenticated } = useAppAuth();
  const { openSearch } = useSearch();
  const {
    notifications: liveNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loading: notificationsLoading
  } = useNotificationsData();

  const currentPageTitle = pageTitles[pathname] || 'Tokemon';



  // Get notifications from the new context
  const unreadCount = getUnreadCount();
  const recentNotifications = (Array.isArray(liveNotifications) ? liveNotifications : [])
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

  const handleNotificationClick = async (notification: any) => {
    // Mark as read when clicked
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    // Navigate to actionUrl if present
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  return (
    <header className="hidden">
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
          <button
            onClick={openSearch}
            className="relative flex-1 flex items-center gap-3 px-4 py-2 bg-background/5 border border-border/30 text-foreground placeholder:text-muted-foreground backdrop-blur-xl shadow-2xl ring-1 ring-background/10 rounded-lg hover:bg-background/10 transition-colors"
          >
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground text-sm">Search for anything...</span>
            <div className="ml-auto flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted/50 rounded text-xs text-muted-foreground">
                {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-muted/50 rounded text-xs text-muted-foreground">K</kbd>
            </div>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Search Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={openSearch}
            className="h-10 w-10 flex flex-col items-center justify-center"
          >
            <Search className="w-4 h-4" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative h-10 w-10 flex flex-col items-center justify-center">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs bg-destructive text-destructive-foreground"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-background/5 backdrop-blur-2xl border-border/30 shadow-2xl ring-1 ring-background/10">
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
                    width: '2.5rem',  // 40px to match h-10 w-10
                    height: '2.5rem', // 40px to match h-10 w-10
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
                className="h-10 bg-background/5 backdrop-blur-2xl border-border/30 hover:bg-background/10 hover:border-primary/50 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Sign In
              </Button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>

    </header>
  );
}