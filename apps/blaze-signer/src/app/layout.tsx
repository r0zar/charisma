import type { Metadata } from "next"
import "../styles/globals.css"

export const metadata: Metadata = {
  title: 'Blaze Protocol',
  description: 'Secure off-chain signing with on-chain verification for Stacks Blockchain',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://blaze-signer.charisma.network'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://blaze-signer.charisma.network',
    title: 'Blaze Protocol | Off-Chain Signing for Stacks',
    description: 'Secure off-chain message signing with on-chain verification for Stacks Blockchain',
    siteName: 'Blaze Protocol',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Blaze Protocol - Secure Off-Chain Signing for Stacks',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blaze Protocol | Off-Chain Signing for Stacks',
    description: 'Secure off-chain message signing with on-chain verification for Stacks Blockchain',
    images: ['/twitter-image.png'],
    creator: '@charisma_tech',
  },
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