import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider, ThemeSwitcher } from "@repo/ui/theme"
import "../styles/globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Blaze Signer Test Interface",
  description: "Test interface for the Blaze-signer Clarity smart contract - A secure way to handle off-chain signatures for Stacks blockchain transactions.",
  keywords: ["Stacks", "Blockchain", "Smart Contract", "Signature", "Clarity", "Web3"],
  authors: [{ name: "Blaze Team" }],
  viewport: "width=device-width, initial-scale=1",
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="light" storageKey="blaze-theme">
          <main className="min-h-screen bg-background">
            {/* <ThemeSwitcher /> */}
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}