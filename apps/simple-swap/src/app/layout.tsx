import { type Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Charisma DEX - Token Swap",
  description: "Swap tokens seamlessly on the Charisma Decentralized Exchange",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gradient-to-b from-[#2a1d0e] to-dark-100 text-dark-800 dark:text-dark-800 antialiased">
        {children}
      </body>
    </html>
  );
}
