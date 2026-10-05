/**
 * The side panel: the wallet itself. Opened from the Blaze Wallet toolbar icon, out of reach of web pages.
 */
import { useState } from "react"
import { Activity, Coins, Lock, Wallet, type LucideIcon } from "lucide-react"
import "@repo/brand/tokens.css"
import "@repo/brand/fonts.css"
import "@repo/brand/components.css"
import { applySavedTheme } from "../shared/styles/theme"
import "../shared/styles/style.css"

import { SignetProvider, useSignetContext } from "~shared/context/SignetContext"
import { WalletTab } from "~shared/wallet/WalletTab"
import { TransferTab } from "~shared/tabs/TransferTab"
import { StatusTab } from "./StatusTab"
import { DiagnosticsProvider } from "./components/diagnostics-context"
import { ErrorBoundary } from "./ErrorBoundary"

applySavedTheme()

const SidePanelWithProvider = () => (
  <SignetProvider>
    <SidePanel />
  </SignetProvider>
)

export default SidePanelWithProvider

const TABS = {
  wallet: { label: "Wallet", icon: Wallet, Page: WalletTab },
  tokens: { label: "Tokens", icon: Coins, Page: TransferTab },
  status: { label: "Status", icon: Activity, Page: StatusTab },
} satisfies Record<string, { label: string; icon: LucideIcon; Page: () => JSX.Element }>
type Tab = keyof typeof TABS

function SidePanel() {
  const { isWalletInitialized, currentAccount, endSession } = useSignetContext()
  const [tab, setTab] = useState<Tab>("wallet")
  // Locked: only the wallet (unlock). Tokens and status need an active account.
  const unlocked = isWalletInitialized && !!currentAccount
  const { Page } = TABS[unlocked ? tab : "wallet"]

  return (
    <div className="w-app">
      {unlocked && (
        <nav className="w-header" aria-label="Blaze Wallet">
          {(Object.keys(TABS) as Tab[]).map(name => {
            const { label, icon: Icon } = TABS[name]
            return (
              <button key={name} type="button" className="w-tab" aria-current={tab === name ? "page" : undefined} onClick={() => setTab(name)}>
                <Icon size={16} aria-hidden /> {label}
              </button>
            )
          })}
          <button type="button" className="w-chrome-btn" onClick={() => endSession()} title="Lock the wallet" aria-label="Lock the wallet">
            <Lock size={16} aria-hidden />
          </button>
        </nav>
      )}
      <main className="w-main">
        {unlocked ? (
          // Status checks run once per unlock (and every 5 minutes), not on every tab switch
          <DiagnosticsProvider>
            <ErrorBoundary key={tab}><Page /></ErrorBoundary>
          </DiagnosticsProvider>
        ) : (
          <ErrorBoundary key={tab}><Page /></ErrorBoundary>
        )}
      </main>
    </div>
  )
}
