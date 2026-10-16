import type { Metadata } from 'next';
import { THEME_SCRIPT } from '@repo/brand/react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Charisma Prices',
  description: 'Live and historical prices for every token on Charisma, with a free public API.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
