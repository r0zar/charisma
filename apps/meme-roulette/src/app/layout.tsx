import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import AppShell from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/sonner';
import { spaceGrotesk, dmMono, inter } from '@/styles/fonts';

export const metadata: Metadata = {
  title: 'Meme Roulette | Group Token Pumper',
  description: 'Use CHA to collectively pump a chosen meme token on the Stacks blockchain!',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://charisma-meme-roulette.vercel.app'),
  keywords: ['meme tokens', 'group pump', 'CHA', 'charisma', 'stacks blockchain', 'crypto'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://charisma-meme-roulette.vercel.app',
    title: 'Meme Roulette | Group Token Pumper',
    description: 'Collectively pump meme tokens on Stacks blockchain!',
    siteName: 'Meme Roulette',
    images: [
      {
        url: '/og-image.png',
        width: 1024,
        height: 1024,
        alt: 'Meme Roulette - Group Token Pumper',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Meme Roulette | Group Token Pumper',
    description: 'Collectively pump meme tokens on Stacks blockchain!',
    creator: '@CharismaBTC',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${spaceGrotesk.variable} ${dmMono.variable} ${inter.variable}`}>
      <body className="font-body bg-background text-foreground antialiased">
        <Providers>
          <AppShell>
            {children}
          </AppShell>
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
