'use client';

import { Bell } from 'lucide-react';
import React, { useState } from 'react';
import { Drawer } from 'vaul';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNotificationsData } from '@/contexts/notifications-context';
import { cn } from '@/lib/utils';

interface NotificationsDrawerProps {
  isNavigating?: boolean;
}

export function NotificationsDrawer({ isNavigating = false }: NotificationsDrawerProps) {
  const [open, setOpen] = useState(false);
  const {
    notifications: liveNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationsData();

  const unreadCount = getUnreadCount();

  const recentNotifications = (Array.isArray(liveNotifications) ? liveNotifications : [])
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className={cn(
            "relative h-9 w-9 flex flex-col items-center justify-center overflow-hidden", 
            isNavigating ? "skeleton-loading" : ""
          )}
        >
          <Bell className={cn("w-4 h-4", isNavigating ? "invisible" : "")} />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-xs bg-destructive text-destructive-foreground"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </Drawer.Trigger>

      <Drawer.Portal as any>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="bg-background/95 backdrop-blur-3xl border-l border-border/30 flex flex-col fixed right-0 top-0 bottom-0 z-50 w-[400px] max-w-[90vw] shadow-2xl rounded-l-[10px]">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-border/30">
              <div className="flex items-center justify-between">
                <Drawer.Title className="text-lg font-semibold text-foreground">
                  Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
                </Drawer.Title>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="h-8 px-3 text-xs"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {recentNotifications.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">No notifications</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {recentNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 hover:bg-background/10 cursor-pointer transition-colors group",
                        !notification.read ? 'bg-background/5' : ''
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={cn(
                              "font-medium text-sm leading-tight",
                              !notification.read ? 'text-foreground' : 'text-muted-foreground'
                            )}>
                              {notification.title}
                            </h4>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!notification.read && (
                                <div className="w-2 h-2 bg-primary rounded-full" />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                                className="h-6 w-6 p-0 text-xs opacity-0 group-hover:opacity-100 hover:text-destructive"
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                          {notification.message && (
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {notification.message}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground/70 mt-2">
                            {new Date(notification.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {Array.isArray(liveNotifications) && liveNotifications.length > 10 && (
              <div className="p-4 border-t border-border/30">
                <Button
                  variant="ghost"
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  View all notifications
                </Button>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}