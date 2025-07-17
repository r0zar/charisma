import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AppProvider, SkinProvider, WalletProvider } from "@/contexts";
import { Header } from "@/components/header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Coverage Dashboard",
  description: "Real-time code coverage monitoring across all packages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const skin = localStorage.getItem('skin');
                  if (skin === 'ocean') {
                    document.documentElement.classList.add('ocean');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground flex flex-col min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          storageKey="theme"
          themes={["light", "dark", "ocean", "sunset", "forest", "lavender"]}
          disableTransitionOnChange={false}
        >
          <SkinProvider>
            <WalletProvider>
              <AppProvider>
                <Header />
                <main className="flex-1">
                  {children}
                </main>
              </AppProvider>
            </WalletProvider>
          </SkinProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}