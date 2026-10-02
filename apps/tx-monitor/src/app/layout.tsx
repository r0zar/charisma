import type { Metadata } from "next";
import { THEME_SCRIPT } from "@repo/brand/react";
import { AppProvider, WalletProvider } from "@/contexts";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Charisma TX Monitor",
  description: "Watch Stacks transactions from broadcast to confirmation, and get told when they land.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="antialiased bg-bg text-ink flex flex-col min-h-screen">
        <WalletProvider>
          <AppProvider>
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </AppProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
