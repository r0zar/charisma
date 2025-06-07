import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '../contexts/wallet-context';
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from '@/components/ui/sonner';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        <WalletProvider>
          {children}
          <Toaster />
        </WalletProvider>
      </body>
      <Analytics />
    </html>
  );
}
