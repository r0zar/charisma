import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from '@/components/ui/sonner';
import { ClientProviders } from '@/contexts/client-providers';
import { listTokens, type TokenCacheData } from '@/lib/contract-registry-adapter';
import { THEME_SCRIPT } from '@repo/brand/react';

// Revalidate token metadata every 5 minutes (300 seconds)
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Charisma Swap | More liquidity sources than any other swap on Stacks',
  description: 'One swap reaches Bitflow, ALEX, Velar, Arkadiko, fak.fun, StackingDAO, Hermetica and Charisma pools: 95% of the liquidity on Stacks\' top DEXes.',
  icons: {
    icon: '/favicon.ico',
  },
  // The share image is app/opengraph-image.tsx (and twitter-image.tsx)
  openGraph: {
    title: 'Charisma Swap | More liquidity sources than any other swap on Stacks',
    description: 'One swap reaches Bitflow, ALEX, Velar, Arkadiko, fak.fun, StackingDAO, Hermetica and Charisma pools: 95% of the liquidity on Stacks\' top DEXes.',
    url: 'https://swap.charisma.rocks',
    siteName: 'Charisma Swap',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Charisma Swap | More liquidity sources than any other swap on Stacks',
    description: 'One swap reaches Bitflow, ALEX, Velar, Arkadiko, fak.fun, StackingDAO, Hermetica and Charisma pools: 95% of the liquidity on Stacks\' top DEXes.',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch token metadata on the server side
  let initialTokens: TokenCacheData[] = [];
  try {
    console.log('[RootLayout] Fetching token metadata for SSR...');
    initialTokens = await listTokens();
    console.log(`[RootLayout] Fetched ${initialTokens.length} tokens for SSR`);
  } catch (error) {
    console.error('[RootLayout] Failed to fetch tokens for SSR:', error);
    // Continue without tokens - context will fetch them client-side as fallback
  }

  return (
    // no data-theme: follow the device until the visitor picks System, Light or Dark in the header
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ClientProviders initialTokens={initialTokens}>
          {children}
          <Toaster />
        </ClientProviders>
      </body>
      <Analytics />
    </html>
  );
}
