'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Bot,
  BarChart3,
  Activity,
  Settings,
  Home,
  TrendingUp,
  Wallet,
  History,
  Plus,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useBots } from '@/contexts/bot-context';

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
    name: 'Activity',
    href: '/activity',
    icon: Activity,
    description: 'Transaction history'
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Performance insights'
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
      <div className="flex items-center gap-2 px-4 py-6 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Bot Manager</h1>
          <p className="text-xs text-muted-foreground">DeFi Automation</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 border-b border-border">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-card rounded-lg">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{botStats.totalBots}</p>
          </div>
          <div className="p-3 bg-card rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <p className="text-lg font-semibold text-green-400">{botStats.activeBots}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-2 px-3 py-4 text-sm font-medium rounded-lg transition-colors min-h-[80px] justify-center',
                isActive
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <item.icon className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium text-xs">{item.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
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

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="w-4 h-4" />
          <span>Gas: {botStats.totalGas.toFixed(1)} STX</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <TrendingUp className="w-4 h-4" />
          <span>Value: ${botStats.totalValue.toFixed(2)}</span>
        </div>
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