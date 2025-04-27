import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import AppShell from '@/components/layout/AppShell';
import { Toaster } from 'sonner';
import { spaceGrotesk, dmMono, inter } from '@/styles/fonts';

export const metadata: Metadata = {
  title: 'Group Token Pumper',
  description: 'Use CHA to collectively pump a chosen meme token!',
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
          <Toaster position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
