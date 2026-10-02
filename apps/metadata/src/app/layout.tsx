// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/context/app-context";
import { Analytics } from "@vercel/analytics/next"
import { THEME_SCRIPT } from "@repo/brand/react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: "Charisma Metadata | Token Management",
  description: "Create and manage token metadata for blockchain tokens",
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html
    lang="en"
    suppressHydrationWarning
    className="supports-[prefers-reduced-motion:no-preference]:scroll-smooth"
  >
    <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
    <body className="font-sans antialiased">
      {/* accessibility: keyboard users can bypass nav */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only absolute left-2 top-2 z-50 rounded bg-surface-raised px-3 py-2 text-sm"
      >
        Skip to content
      </a>

      <AppProvider>
        <div className="relative flex min-h-dvh flex-col">
          <SiteHeader />

          {/* the 32px grid behind the top of the page: the texture token, so it shows by night only */}
          <div
            className="pointer-events-none absolute inset-x-0 top-16 h-[720px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--texture) 1px, transparent 1px), linear-gradient(to bottom, var(--texture) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <main id="main" className="relative flex-1">
            <div className="pb-16 pt-6 md:pt-10">{children}</div>
          </main>

          <SiteFooter />
        </div>
      </AppProvider>
    </body>
    <Analytics />
  </html>
);

export default RootLayout;
