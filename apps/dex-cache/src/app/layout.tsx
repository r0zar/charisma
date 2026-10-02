import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/context/app-context";
import Header from "@/components/Header";
import { Footer } from "@/components/footer";
import { THEME_SCRIPT } from "@repo/brand/react";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next"
import { getHostUrl } from "@modules/discovery";

export const metadata: Metadata = {
  title: "Charisma Invest | Maximize Your Stacks Yield",
  description: "Explore liquidity pools, automated strategies, and maximize your yield opportunities on Stacks with Charisma Invest.",
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: "Charisma Invest | Maximize Your Stacks Yield",
    description: "Explore liquidity pools, automated strategies, and maximize your yield opportunities on Stacks with Charisma Invest.",
    url: getHostUrl('invest'),
    siteName: 'Charisma Invest',
    images: [
      {
        url: '/og-image.png',
        width: 953,
        height: 529,
        alt: 'Charisma Invest Interface for Yield Maximization Strategies',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Charisma Invest | Maximize Your Stacks Yield",
    description: "Explore liquidity pools, automated strategies, and maximize your yield opportunities on Stacks with Charisma Invest.",
    images: ['/og-image.png'],
  },
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html suppressHydrationWarning
    lang="en"
    className="supports-[prefers-reduced-motion:no-preference]:scroll-smooth"
  >
    <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
    <body className="font-sans antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only absolute left-2 top-2 z-50 rounded bg-surface-raised px-3 py-2 text-sm"
      >
        Skip to content
      </a>

        <AppProvider>
          <div className="relative flex min-h-dvh flex-col">
            <Header />
            <main id="main" className="relative flex-1">
              {children}
            </main>

            <Footer />
          </div>
          <Toaster />
        </AppProvider>
    </body>
    <Analytics />
  </html>
);

export default RootLayout;
