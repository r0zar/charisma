import React from 'react';
import { Metadata } from 'next';
import { TrendingUp } from 'lucide-react';
import PriceSystemHealthCards from '@/components/pricing/PriceSystemHealthCards';
import PriceDiscoveryInfo from '@/components/pricing/PriceDiscoveryInfo';
import PriceTableContainer from '@/components/pricing/PriceTableContainer';

// Revalidate every 30 seconds for real-time pricing
export const revalidate = 30;

// Define metadata for better SEO
export const metadata: Metadata = {
  title: 'Token Prices | Charisma Invest',
  description: 'Real-time token prices powered by liquidity pool reserves and sBTC anchoring. Multi-path price discovery with confidence scoring.',
  keywords: 'Stacks, Token Prices, sBTC, Price Discovery, DEX, Liquidity Pools, Real-time Prices, Charisma',
  openGraph: {
    title: 'Charisma Invest - Token Prices',
    description: 'Real-time token prices with multi-path discovery and confidence scoring',
    url: 'https://invest.charisma.rocks/prices',
    siteName: 'Charisma Invest',
    images: [
      {
        url: '/og-image.png',
        width: 953,
        height: 529,
        alt: 'Charisma Invest Token Pricing Interface',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Charisma Invest - Token Prices',
    description: 'Real-time token prices with multi-path discovery and confidence scoring',
    images: ['/og-image.png'],
  },
};

export default async function PricesPage() {
  return (
    <main className="flex-1 container py-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Token Prices</h1>
        </div>
      </div>
      
      <p className="text-muted-foreground mb-6 max-w-3xl">
        Real-time token prices derived from liquidity pool reserves using sBTC as the price anchor. 
        Our multi-path discovery system analyzes multiple trading routes to provide accurate, 
        manipulation-resistant pricing with confidence scoring.
      </p>

      {/* System Health Cards */}
      <PriceSystemHealthCards />

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-8 mt-8">
        {/* Sidebar - Price Discovery Information */}
        <aside className="w-full lg:w-1/4 space-y-6">
          <PriceDiscoveryInfo />
        </aside>

        {/* Main Content - Price Table */}
        <main className="w-full lg:w-3/4">
          <PriceTableContainer />
        </main>
      </div>
    </main>
  );
}