import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import { Footer } from "@/components/footer";
import { THEME_SCRIPT } from "@repo/brand/react";
import { Toaster } from "@/components/ui/sonner";

// Define metadata for better SEO
export const metadata: Metadata = {
  title: 'Charisma Tokens',
  description: 'Explore SIP-10 fungible tokens on the Stacks blockchain. Search, view and access token data via API.',
  keywords: 'Stacks, SIP-10, Fungible Token, Blockchain, Explorer, API, Cache, Charisma',
  openGraph: {
    title: 'Charisma Tokens',
    description: 'Explore SIP-10 fungible tokens on the Stacks blockchain',
    type: 'website',
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
        <a
          href="#main"
          className="sr-only focus:not-sr-only absolute left-2 top-2 z-50 rounded bg-surface-raised px-3 py-2 text-sm"
        >
          Skip to content
        </a>
          <div className="relative flex min-h-dvh flex-col">
            <Header />
            <main id="main" className="relative flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <Toaster />
      </body>
    </html>
  );
}
