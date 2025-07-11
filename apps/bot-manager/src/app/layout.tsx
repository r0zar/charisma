import "./globals.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { SkinProvider, WalletProvider } from "@/contexts";
import { BotProvider } from "@/contexts/bot-context";
import { BotStateMachineProvider } from "@/contexts/bot-state-machine-context";
import { GlobalStateProvider } from "@/contexts/global-state-context";
import { NotificationsProvider } from "@/contexts/notifications-context";
import { SettingsProvider } from "@/contexts/settings-context";
import { ToastProvider } from "@/contexts/toast-context";
import { dataLoader } from "@/lib/modules/storage/loader";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tokemon - DeFi Bot Manager",
  description: "Tokemon DeFi bot management application for automated trading on the Stacks blockchain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Load app state with simplified logic and dynamic metadata
  const appState = dataLoader.loadAppState();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const skin = localStorage.getItem('skin') || 'default';
                  const theme = localStorage.getItem('theme') || 'light';
                  
                  // Remove all theme and skin classes
                  document.documentElement.classList.remove('dark', 'ocean', 'sunset', 'forest', 'lavender');
                  
                  // Apply theme class first
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                  
                  // Apply skin class (only if not default and not dark)
                  if (skin !== 'default' && skin !== 'dark') {
                    document.documentElement.classList.add(skin);
                  }
                  
                  // Add CSS for loading overlay
                  const style = document.createElement('style');
                  style.textContent = \`
                    #loading-overlay {
                      position: fixed;
                      top: 0;
                      left: 0;
                      width: 100%;
                      height: 100%;
                      background: \${theme === 'dark' ? '#0a0a0a' : '#fafafa'};
                      z-index: 9999;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    #loading-spinner {
                      width: 32px;
                      height: 32px;
                      border: 2px solid \${theme === 'dark' ? '#404040' : '#e2e8f0'};
                      border-top: 2px solid \${theme === 'dark' ? '#3b82f6' : '#2563eb'};
                      border-radius: 50%;
                      animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  \`;
                  document.head.appendChild(style);
                  
                  // Create loading overlay outside React's DOM tree
                  function createOverlay() {
                    const overlay = document.createElement('div');
                    overlay.id = 'loading-overlay';
                    overlay.style.cssText = \`
                      position: fixed;
                      top: 0;
                      left: 0;
                      width: 100%;
                      height: 100%;
                      background: #000000;
                      z-index: 9999;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                    \`;
                    
                    const spinner = document.createElement('div');
                    spinner.style.cssText = \`
                      width: 32px;
                      height: 32px;
                      border: 2px solid #404040;
                      border-top: 2px solid #3b82f6;
                      border-radius: 50%;
                      animation: spin 1s linear infinite;
                    \`;
                    
                    overlay.appendChild(spinner);
                    document.body.appendChild(overlay);
                    
                    // Remove overlay after React hydrates
                    window.addEventListener('load', () => {
                      setTimeout(() => {
                        if (overlay && overlay.parentNode) {
                          overlay.style.opacity = '0';
                          overlay.style.filter = 'blur(4px)';
                          setTimeout(() => {
                            if (overlay && overlay.parentNode) {
                              overlay.remove();
                            }
                          }, 800);
                        }
                      }, 100);
                    });
                  }
                  
                  // Create overlay when DOM is ready
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', createOverlay);
                  } else {
                    createOverlay();
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
          defaultTheme="light"
          enableSystem={false}
          storageKey="theme"
          themes={["light", "dark"]}
          disableTransitionOnChange={false}
        >
          <SettingsProvider>
            <ToastProvider>
              <GlobalStateProvider initialData={appState}>
                <SkinProvider>
                  <WalletProvider>
                    <BotProvider>
                      <BotStateMachineProvider>
                        <NotificationsProvider>
                          <div className="flex h-screen bg-background">
                            <Sidebar />
                            <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
                              <Header />
                              <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background">
                                {children}
                              </main>
                            </div>
                          </div>
                        </NotificationsProvider>
                      </BotStateMachineProvider>
                    </BotProvider>
                  </WalletProvider>
                </SkinProvider>
              </GlobalStateProvider>
            </ToastProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}