import type { Metadata } from 'next';
import { THEME_SCRIPT } from '@repo/brand/react';
import { WalletProvider } from '@/components/wallet';
import './globals.css';

export const metadata: Metadata = {
  title: 'Charisma Recovery',
  description: 'Burn your iouWELSH, iouROO or synSTX and get the original tokens back 1:1.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-screen antialiased"><WalletProvider>{children}</WalletProvider></body>
    </html>
  );
}
