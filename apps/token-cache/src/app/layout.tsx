import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Define metadata for better SEO
export const metadata: Metadata = {
  title: 'SIP-10 Token Cache | Stacks Blockchain',
  description: 'Explore SIP-10 fungible tokens on the Stacks blockchain. Search, view and access token data via API.',
  keywords: 'Stacks, SIP-10, Fungible Token, Blockchain, Explorer, API',
  openGraph: {
    title: 'SIP-10 Token Cache',
    description: 'Explore SIP-10 fungible tokens on the Stacks blockchain',
    type: 'website',
  },
};
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
