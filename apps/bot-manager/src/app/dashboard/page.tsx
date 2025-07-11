'use client';

import { ArrowRight, Bot, Plus, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/wallet-context';

export default function DashboardPage() {
  const { walletState, connectWallet, isConnecting } = useWallet();

  // Authentication guard - require wallet connection
  if (!walletState.connected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to Tokemon</h1>
          <p className="text-muted-foreground mb-6">
            Connect your wallet to access your bot management dashboard
          </p>
          <Button
            onClick={connectWallet}
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 h-full flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto space-y-8">
        {/* SVG Illustration */}
        <div className="mx-auto w-48 h-48 mb-0">
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full text-primary/20"
            fill="currentColor"
          >
            {/* Dashboard icon background */}
            <circle cx="100" cy="100" r="80" className="text-muted/10 fill-current" />

            {/* Chart bars */}
            <rect x="60" y="120" width="12" height="40" className="text-primary fill-current opacity-30" rx="2" />
            <rect x="78" y="100" width="12" height="60" className="text-primary fill-current opacity-50" rx="2" />
            <rect x="96" y="80" width="12" height="80" className="text-primary fill-current opacity-70" rx="2" />
            <rect x="114" y="90" width="12" height="70" className="text-primary fill-current opacity-60" rx="2" />
            <rect x="132" y="110" width="12" height="50" className="text-primary fill-current opacity-40" rx="2" />

            {/* Trend line */}
            <path
              d="M 60 140 Q 85 120 100 100 T 140 130"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className="text-primary opacity-60"
              strokeLinecap="round"
            />

            {/* Data points */}
            <circle cx="70" cy="135" r="3" className="text-primary fill-current" />
            <circle cx="100" cy="100" r="3" className="text-primary fill-current" />
            <circle cx="130" cy="125" r="3" className="text-primary fill-current" />
          </svg>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <TrendingUp className="w-4 h-4" />
            Coming Soon
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Personalized Dashboard
          </h1>

          <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            We're building an amazing analytics dashboard with detailed insights,
            performance metrics, and personalized recommendations for your bots.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
          <Button asChild size="lg" className="min-w-[200px]">
            <Link href="/bots" className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Manage Your Bots
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg" className="min-w-[200px]">
            <Link href="/bots/create" className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Bot
            </Link>
          </Button>
        </div>

        {/* Additional info */}
        <div className="pt-8 border-t border-border/10">
          <p className="text-sm text-muted-foreground">
            In the meantime, you can manage your bots, create new strategies, and configure settings.
          </p>
        </div>
      </div>
    </div>
  );
}