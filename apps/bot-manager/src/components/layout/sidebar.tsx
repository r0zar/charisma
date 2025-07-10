'use client';

import {
  Bot,
  Home,
  Menu,
  Plus,
  Settings,
  TrendingUp
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useBots } from '@/contexts/bot-context';
import { cn } from '@/lib/utils';

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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-center border-b border-border">
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
      <div className="p-4 border-b border-border">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-1 bg-card rounded-lg flex flex-row items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              {/* <span className="text-xs text-muted-foreground">Total</span> */}
            </div>
            <p className="text-lg font-semibold text-foreground">{botStats.totalBots}</p>
          </div>
          <div className="p-1 bg-card rounded-lg flex flex-row items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              {/* <span className="text-xs text-muted-foreground">Active</span> */}
            </div>
            <p className="text-lg font-semibold text-green-400">{botStats.activeBots}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href  }/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-border pl-2'
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
      <div className="p-4 border-t border-border">
        <Button
          asChild
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Link href="/bots/create">
            <Plus className="w-4 h-4 mr-2" />
            Create Bot
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn('hidden lg:block', className)}>
        <div className="fixed inset-y-0 left-0 w-64 bg-background border-r border-border">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden fixed top-4 left-4 z-50 bg-background/80 backdrop-blur-sm border border-border"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-background border-border">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}