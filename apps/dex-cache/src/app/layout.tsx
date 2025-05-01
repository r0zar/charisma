import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AppProvider } from "@/lib/context/app-context";
import Link from "next/link";
import { WalletConnector } from "@/components/wallet-connector";
import { Inter } from "next/font/google";
import Header from "@/components/Header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

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

      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <AppProvider>
          <div className="relative flex min-h-dvh flex-col">
            <Header />
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
          <Toaster />
        </AppProvider>
      </ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
