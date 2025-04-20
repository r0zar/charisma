import type { Metadata } from "next"
import "../styles/globals.css"

export const metadata: Metadata = {
  title: 'Blaze Signer',
  description: 'Test interface for the Blaze-signer smart contract',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-background">
          {children}
        </main>
      </body>
    </html>
  )
}