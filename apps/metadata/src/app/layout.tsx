// src/app/layout.tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AppProvider } from "@/lib/context/app-context";
import Link from "next/link";
import { WalletConnector } from "@/components/wallet-connector";

export const metadata: Metadata = {
  title: "Charisma Metadata | Token Management",
  description: "Create and manage token metadata for blockchain tokens",
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html
    lang="en"
    className="supports-[prefers-reduced-motion:no-preference]:scroll-smooth"
  >
    <body
      className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
    >
      {/* accessibility: keyboard users can bypass nav */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only absolute left-2 top-2 z-50 rounded bg-background px-3 py-2 text-sm"
      >
        Skip to content
      </a>

      <AppProvider>
        <div className="relative flex min-h-dvh flex-col">
          {/* ── Navbar ───────────────────────────────────────────── */}
          <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur supports-[backdrop-blur]:bg-background/60">
            <div className="container flex h-16 items-center justify-between py-4">
              {/* Logo + nav */}
              <div className="flex items-center gap-6 md:gap-10">
                <Link
                  href="/"
                  className="flex items-center space-x-2 transition-opacity hover:opacity-80"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-primary via-primary/80 to-primary/50">
                    <span className="text-sm font-bold text-primary-foreground">
                      CM
                    </span>
                  </div>
                  <span className="hidden tracking-tight text-foreground sm:inline-block">
                    <span className="font-bold">Charisma</span>{" "}
                    <span className="text-primary">Metadata</span>
                  </span>
                </Link>

                <nav
                  aria-label="Primary"
                  className="hidden gap-6 md:flex items-center"
                >
                  <Link
                    href="/tokens"
                    className="flex items-center space-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline decoration-primary/50 underline-offset-4"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <circle cx="8" cy="8" r="6" />
                      <path d="M18.09 10.37A6 6 0 1 1 10.34 18.13" />
                      <path d="m16 16-1 1" />
                    </svg>
                    <span>Tokens</span>
                  </Link>
                  <Link
                    href="/docs"
                    className="flex items-center space-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline decoration-primary/50 underline-offset-4"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                    <span>Documentation</span>
                  </Link>
                </nav>
              </div>

              {/* Wallet + mobile menu */}
              <div className="relative flex items-center gap-4">
                <WalletConnector className="ml-auto" />

                <button
                  className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background/80 transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
                  aria-label="Toggle menu"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          {/* ― radial fade ornament ― */}
          <div
            className="absolute inset-0 -z-10 h-full w-full bg-background [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--pattern-color) 1px, transparent 1px), linear-gradient(to bottom, var(--pattern-color) 1px, transparent 1px)",
              backgroundSize: "4rem 4rem",
            }}
          />

          {/* ── Main ─────────────────────────────────────────────── */}
          <main id="main" className="relative flex-1">
            <div className="pb-0 pt-6 md:pt-10">{children}</div>
          </main>

          {/* ── Footer ───────────────────────────────────────────── */}
          <footer className="mt-auto border-t border-border/40 py-6 md:py-0">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
              <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                © {new Date().getFullYear()} Charisma. All rights reserved.
              </p>

              <div className="flex items-center space-x-1">
                <a
                  href="https://github.com/r0zar/charisma"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background/80 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                    <path d="M9 18c-4.51 2-5-2-7-2" />
                  </svg>
                </a>

                <a
                  href="https://x.com/CharismaBTC"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background/80 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
                  </svg>
                </a>
              </div>
            </div>
          </footer>
        </div>
      </AppProvider>
    </body>
  </html>
);

export default RootLayout;
