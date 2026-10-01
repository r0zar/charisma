import type { Metadata } from 'next';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { THEME_SCRIPT } from '@repo/brand/react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Charisma Brand', template: '%s · Charisma Brand' },
  description: 'The Charisma crest, colours, type and components: one crest, two realms.',
  metadataBase: new URL('https://brand.charisma.rocks'),
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* no data-theme: follow the device until the visitor picks */}
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-[1160px] px-5 sm:px-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
