import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '../contexts/wallet-context';

export const metadata: Metadata = {
  title: 'SimpleSwap | Fast Decentralized Exchange',
  description: 'Swap tokens on Stacks with the fastest and most secure decentralized exchange',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="min-h-screen bg-background font-sans antialiased">
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
