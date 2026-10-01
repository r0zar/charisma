import type { Metadata } from 'next';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { THEME_SCRIPT } from '@repo/brand/react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Charisma: open-source DeFi on Stacks',
  description: 'Swap at the best price, earn from liquidity, launch a token and trade instantly on Blaze. Open-source apps that belong to no one and work for everyone.',
  metadataBase: new URL('https://charisma.rocks'),
  openGraph: { title: 'Charisma', description: 'Open-source DeFi on Stacks that belongs to no one and works for everyone.', url: 'https://charisma.rocks', siteName: 'Charisma' },
  twitter: { card: 'summary_large_image', site: '@CharismaBTC' },
  icons: { icon: '/favicon.ico', apple: '/brand/favicons/apple-touch-icon.png' },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* no data-theme: follow the device until the visitor picks */}
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-screen antialiased">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
