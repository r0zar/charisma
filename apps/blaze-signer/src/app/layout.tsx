"use client"

import "./globals.css"
import { WalletProvider } from "@/context/wallet-context"
import { Toaster } from "@/components/ui/sonner"
import { Header } from "@/components/header"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Toaster />
          <Header />
          <main className="min-h-screen bg-background">
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  )
}