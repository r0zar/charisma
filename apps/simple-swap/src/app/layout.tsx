import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from '@/components/ui/sonner';
import { ClientProviders } from '@/contexts/client-providers';
import { listTokens, type TokenCacheData } from '@/lib/contract-registry-adapter';

// Revalidate token metadata every 5 minutes (300 seconds)
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Charisma Swap | Fast Decentralized Exchange on Stacks',
  description: 'Swap tokens securely and efficiently on the Stacks blockchain with Charisma Swap.',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Charisma Swap | Fast Decentralized Exchange on Stacks',
    description: 'Swap tokens securely and efficiently on the Stacks blockchain with Charisma Swap.',
    url: 'https://charisma.rocks',
    siteName: 'Charisma Swap',
    images: [
      {
        url: '/og-image.png',
        width: 920,
        height: 483,
        alt: 'Charisma Swap Logo and Interface Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Charisma Swap | Fast Decentralized Exchange on Stacks',
    description: 'Swap tokens securely and efficiently on the Stacks blockchain with Charisma Swap.',
    images: ['/og-image.png'],
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
    <html lang="en" className="dark">
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
