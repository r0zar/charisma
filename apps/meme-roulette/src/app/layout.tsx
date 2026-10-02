import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import AppShell from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/sonner';
import { THEME_SCRIPT } from '@repo/brand/react';
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: 'Meme Roulette by Charisma',
  description: 'Back a meme with CHA. When the wheel spins, the whole pot pumps the winner, and everyone gets it.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://lol.charisma.rocks'),
  keywords: ['meme tokens', 'group pump', 'CHA', 'charisma', 'stacks blockchain', 'crypto'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://lol.charisma.rocks',
    title: 'Meme Roulette by Charisma',
    description: 'Back a meme. The pot pumps the winner.',
    siteName: 'Meme Roulette',
    images: [
      {
        url: '/og.jpg',
        width: 1200,
        height: 630,
        alt: 'Meme Roulette: a 3D roulette wheel of memes, mid-spin',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Meme Roulette by Charisma',
    description: 'Back a meme. The pot pumps the winner.',
    creator: '@CharismaBTC',
    images: ['/og.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="font-sans antialiased">
        <Providers>
          <AppShell>
            {children}
          </AppShell>
          <Toaster position='bottom-right' />
        </Providers>
      </body>
      <Analytics />
    </html>
  );
}
