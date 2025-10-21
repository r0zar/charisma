import type { Metadata } from "next";
import { Inter, Audiowide, Orbitron } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AppProvider, WalletProvider, LotteryProvider } from "@/contexts";
import { Header } from "@/components/header";
import { Analytics } from "@vercel/analytics/next"
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap"
});
const audiowide = Audiowide({
  variable: "--font-audiowide",
  subsets: ["latin"],
  display: "swap",
  weight: ["400"]
});
const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"]
});

export const metadata: Metadata = {
  title: "Charisma Lottery | Blockchain-Powered Prize Draws",
  description: "Participate in provably fair lottery draws on the Stacks blockchain. Purchase tickets with STONE tokens and win exclusive prizes. Transparent, secure, and decentralized.",
  keywords: ["lottery", "blockchain", "Stacks", "STONE", "Web3", "cryptocurrency", "prize draw", "decentralized lottery"],
  openGraph: {
    title: "Charisma Lottery",
    description: "Blockchain-powered lottery with provably fair draws and exclusive prizes",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head></head>
      <body
        className={`${inter.variable} ${audiowide.variable} ${orbitron.variable} antialiased bg-background text-foreground flex flex-col min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="theme"
          themes={["light", "dark"]}
          disableTransitionOnChange={false}
        >
          <WalletProvider>
            <AppProvider>
              <LotteryProvider>
                <Header />
                <main className="flex-1">
                  {children}
                </main>
                <Analytics />
              </LotteryProvider>
            </AppProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}