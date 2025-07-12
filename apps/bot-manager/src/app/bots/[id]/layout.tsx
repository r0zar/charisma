'use client';

import {
  ArrowLeft,
  BarChart3,
  Bot,
  Calendar,
  Pause,
  Play,
  RefreshCw,
  Settings,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import React, { ReactNode } from 'react';

import { BotAvatar } from '@/components/ui/bot-avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBots } from '@/contexts/bot-context';
import { useBotStateMachine } from '@/contexts/bot-state-machine-context';
import { CurrentBotProvider } from '@/contexts/current-bot-context';
import { getStrategyDisplayName } from '@/lib/services/bots/strategy-parser';

export default function BotDetailLayout({ children, }: { children: ReactNode; }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { bots, loading } = useBots();
  const { startBot, pauseBot } = useBotStateMachine();

  const [mounted, setMounted] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [publicBots, setPublicBots] = React.useState<any[]>([]);
  const [publicLoading, setPublicLoading] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Load public bots for viewing other users' bots
  React.useEffect(() => {
    const loadPublicBots = async () => {
      if (process.env.NEXT_PUBLIC_ENABLE_API_BOTS !== 'true') return;

      setPublicLoading(true);
      try {
        const response = await fetch('/api/v1/bots/public');
        if (response.ok) {
          const data = await response.json();
          setPublicBots(data.bots || []);
        }
      } catch (error) {
        console.error('Failed to load public bots:', error);
      } finally {
        setPublicLoading(false);
      }
    };

    if (mounted) {
      loadPublicBots();
    }
  }, [mounted]);

  const bot = React.useMemo(() => {
    // First check user's own bots
    const userBot = bots.find(b => b.id === params.id);
    if (userBot) return userBot;

    // Then check public bots
    const publicBot = publicBots.find(b => b.id === params.id);
    return publicBot;
  }, [bots, publicBots, params.id]);

  const isPublicBot = React.useMemo(() => {
    return !bots.find(b => b.id === params.id) && publicBots.find(b => b.id === params.id);
  }, [bots, publicBots, params.id]);

  React.useEffect(() => {
    if (mounted && bots.length > 0 && publicBots.length > 0 && !bot) {
      router.push('/bots');
    }
  }, [mounted, bots, publicBots, bot, router]);

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

  if (!mounted || loading || publicLoading || !bot) {
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
    <div className="p-2 sm:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <Button asChild variant="ghost" size="icon" className="text-foreground flex-shrink-0">
            <Link href="/bots">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <BotAvatar bot={bot} size="md" className="sm:hidden" />
            <BotAvatar bot={bot} size="lg" className="hidden sm:block" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">{bot.name}</h1>
                {isPublicBot && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full flex-shrink-0">
                    Public Bot
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{getStrategyDisplayName(bot.strategy)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-border text-foreground flex-1 sm:flex-none"
          >
            <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="ml-1 sm:ml-2 hidden xs:inline">Refresh</span>
          </Button>

          {!isPublicBot && (
            bot.status === 'active' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                className="border-yellow-600 text-yellow-400 hover:bg-yellow-500/10 flex-1 sm:flex-none"
              >
                <Pause className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="ml-1 sm:ml-2 hidden xs:inline">Pause</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStart}
                className="border-green-600 text-green-400 hover:bg-green-500/10 flex-1 sm:flex-none"
              >
                <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="ml-1 sm:ml-2 hidden xs:inline">Start</span>
              </Button>
            )
          )}

        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={getCurrentTab()} className="space-y-3 sm:space-y-4">
        <TabsList className={`grid w-full bg-card border-border text-xs sm:text-sm ${isPublicBot ? 'grid-cols-2' : 'grid-cols-4'}`}>
          <TabsTrigger value="overview" asChild>
            <Link
              href={`/bots/${bot.id}`}
              className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-3"
            >
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline sm:text-sm">Overview</span>
            </Link>
          </TabsTrigger>
          <TabsTrigger value="strategy" asChild>
            <Link
              href={`/bots/${bot.id}/strategy`}
              className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-3"
            >
              <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline sm:text-sm">Strategy</span>
            </Link>
          </TabsTrigger>
          {!isPublicBot && (
            <>
              <TabsTrigger value="scheduling" asChild>
                <Link
                  href={`/bots/${bot.id}/scheduling`}
                  className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-3"
                >
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline sm:text-sm">Schedule</span>
                </Link>
              </TabsTrigger>
              <TabsTrigger value="wallet" asChild>
                <Link
                  href={`/bots/${bot.id}/wallet`}
                  className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-3"
                >
                  <Wallet className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline sm:text-sm">Wallet</span>
                </Link>
              </TabsTrigger>
            </>
          )}
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