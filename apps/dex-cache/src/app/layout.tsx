import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AppProvider } from "@/lib/context/app-context";
import Link from "next/link";
import { WalletConnector } from "@/components/wallet-connector";

export const metadata: Metadata = {
  title: "Charisma DEX Cache",
  description: "Cache service for Charisma DEX",
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html
    lang="en"
    className="supports-[prefers-reduced-motion:no-preference]:scroll-smooth"
  >
    <body
      className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only absolute left-2 top-2 z-50 rounded bg-background px-3 py-2 text-sm"
      >
        Skip to content
      </a>

      <AppProvider>
        <div className="relative flex min-h-dvh flex-col">
          <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur supports-[backdrop-blur]:bg-background/60">
            <div className="container flex h-16 items-center justify-between py-4">
              <div className="flex items-center gap-6 md:gap-10">
                <Link
                  href="/"
                  className="flex items-center space-x-2 transition-opacity hover:opacity-80"
                >
                  <span className="font-bold tracking-tight text-foreground">
                    DEX Cache
                  </span>
                </Link>
              </div>

              <div className="relative flex items-center gap-4">
                <WalletConnector className="ml-auto" />
              </div>
            </div>
          </header>

          <main id="main" className="relative flex-1">
            {children}
          </main>

          <footer className="mt-auto border-t border-border/40 py-6 md:py-0">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
              <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                © {new Date().getFullYear()} Charisma. All rights reserved.
              </p>
            </div>
          </footer>
        </div>
      </AppProvider>
    </body>
  </html>
);

export default RootLayout;
