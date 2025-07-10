'use client';

import React, { ReactNode } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import {
  Bot,
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Wallet,
  RefreshCw,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBots } from '@/contexts/bot-context';
import { useBotStateMachine } from '@/contexts/bot-state-machine-context';
import { useToast } from '@/contexts/toast-context';
import { CurrentBotProvider } from '@/contexts/current-bot-context';
import { getStrategyDisplayName } from '@/lib/features/bots/strategy-parser';
import { BotAvatar } from '@/components/ui/bot-avatar';
import Link from 'next/link';

export default function BotDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { bots, loading } = useBots();
  const { startBot, pauseBot } = useBotStateMachine();
  const { showSuccess, showError } = useToast();

  const [mounted, setMounted] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const bot = React.useMemo(() => {
    return bots.find(b => b.id === params.id);
  }, [bots, params.id]);

  React.useEffect(() => {
    if (mounted && bots.length > 0 && !bot) {
      router.push('/bots');
    }
  }, [mounted, bots, bot, router]);

  const handleStart = async () => {
    if (!bot) return;
    await startBot(bot, 'User started via bot detail page');
  };

  const handlePause = async () => {
    if (!bot) return;
    await pauseBot(bot, 'User paused via bot detail page');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // Get current tab from pathname
  const getCurrentTab = () => {
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1];
    
    if (lastSegment === params.id) {
      return 'overview';
    }
    
    return lastSegment;
  };

  if (!mounted || loading || !bot) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-blue-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Loading Bot Details...</h2>
          <p className="text-muted-foreground">Fetching bot configuration and status</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="text-foreground">
            <Link href="/bots">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <BotAvatar bot={bot} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">{bot.name}</h1>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{getStrategyDisplayName(bot.strategy)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-border text-foreground"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {bot.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              className="border-yellow-600 text-yellow-400 hover:bg-yellow-500/10"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStart}
              className="border-green-600 text-green-400 hover:bg-green-500/10"
            >
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
          )}

        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={getCurrentTab()} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-card border-border">
          <TabsTrigger value="overview" asChild>
            <Link 
              href={`/bots/${bot.id}`}
              className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </Link>
          </TabsTrigger>
          <TabsTrigger value="strategy" asChild>
            <Link 
              href={`/bots/${bot.id}/strategy`}
              className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              <Settings className="w-4 h-4 mr-2" />
              Strategy
            </Link>
          </TabsTrigger>
          <TabsTrigger value="scheduling" asChild>
            <Link 
              href={`/bots/${bot.id}/scheduling`}
              className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Scheduling
            </Link>
          </TabsTrigger>
          <TabsTrigger value="wallet" asChild>
            <Link 
              href={`/bots/${bot.id}/wallet`}
              className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Wallet
            </Link>
          </TabsTrigger>
        </TabsList>

        {/* Page Content */}
        <div className="space-y-4">
          <CurrentBotProvider bot={bot} loading={loading}>
            {children}
          </CurrentBotProvider>
        </div>
      </Tabs>
    </div>
  );
}