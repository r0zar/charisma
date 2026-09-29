/**
 * The side panel: the wallet itself. Opened from the Signet toolbar icon, out of reach of web pages.
 */
import { useState, type ReactNode } from "react"
import { colors, keyframes } from "../shared/styles/theme"
import "../shared/styles/style.css"

import { SignetProvider, useSignetContext } from "~shared/context/SignetContext"
import { WalletTab } from "~shared/wallet/WalletTab"
import { TransferTab } from "~shared/tabs/TransferTab"
import { StatusDisplay } from "./components/StatusDisplay"
import { HologramDisplay } from "./components/HologramDisplay"
import { ConsoleView } from "./components/ConsoleView"
import { SystemMetrics } from "./components/SystemMetrics"
import { DiagnosticsProvider } from "./components/diagnostics-context"
import { ErrorBoundary } from "./ErrorBoundary"

const SidePanelWithProvider = () => (
  <SignetProvider>
    <SidePanel />
  </SignetProvider>
)

export default SidePanelWithProvider

const PAGES = {
  WALLET: WalletTab,
  TRANSFER: TransferTab,
  DIAGNOSTICS: Diagnostics,
}
type Tab = keyof typeof PAGES

/** Line icons (Feather paths) for the tab bar */
const ICONS: Record<Tab, ReactNode> = {
  WALLET: <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></>,
  TRANSFER: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></>,
  DIAGNOSTICS: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
}

function SidePanel() {
  const { isWalletInitialized, currentAccount } = useSignetContext()
  const [tab, setTab] = useState<Tab>('WALLET')
  // Locked: only the wallet (unlock). Transfers and diagnostics need an active account.
  const tabs: Tab[] = isWalletInitialized && currentAccount ? ['WALLET', 'TRANSFER', 'DIAGNOSTICS'] : ['WALLET']
  const Page = PAGES[tabs.includes(tab) ? tab : 'WALLET']

  return (
    <div
      style={{
        margin: '0px',
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #0D1117 0%, #010409 100%)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {tabs.length > 1 && (
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(125, 249, 255, 0.2)', flexShrink: 0 }}>
          {tabs.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              title={name.charAt(0) + name.slice(1).toLowerCase()}
              aria-label={name.charAt(0) + name.slice(1).toLowerCase()}
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                padding: '12px 0',
                background: tab === name ? 'rgba(125, 249, 255, 0.08)' : 'transparent',
                border: 'none',
                borderBottom: tab === name ? `2px solid ${colors.cyber}` : '2px solid transparent',
                color: tab === name ? colors.cyber : colors.steel,
                filter: tab === name ? `drop-shadow(0 0 4px ${colors.cyber})` : 'none',
                cursor: 'pointer',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[name]}
              </svg>
            </button>
          ))}
        </div>
      )}

      <ErrorBoundary key={tab}>
        {Page === Diagnostics ? <Diagnostics /> : (
          <div className="signet-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <Page />
          </div>
        )}
      </ErrorBoundary>
    </div>
  )
}

/** The hologram, on real data: Stacks network, Blaze subnets and your balances on them, and the lock timer */
function Diagnostics() {
  return (
    <DiagnosticsProvider>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <StatusDisplay />

        <div style={{ position: 'relative', height: 'calc(100% - 80px)', overflow: 'hidden' }}>
          {/* Background grid lines */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(to right, rgba(125, 249, 255, 0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(125, 249, 255, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
            zIndex: 0
          }} />
          <HologramDisplay />
          <ConsoleView />
        </div>

        <SystemMetrics />

        <style>
          {keyframes.slideInUp}
          {keyframes.slideInRight}
          {keyframes.shimmer}
          {keyframes.scanLine}
          {keyframes.spin}
        </style>
      </div>
    </DiagnosticsProvider>
  )
}
