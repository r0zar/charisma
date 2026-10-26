/**
 * The side panel: the wallet itself. Opened from the Blaze Wallet toolbar icon, out of reach of web pages.
 * Home and Status sit on the bottom bar; Settings (seed phrases, accounts and the vault) opens from the gear.
 */
import { useState } from "react"
import { Activity, ArrowLeft, ArrowLeftRight, Lock, Settings, Wallet, type LucideIcon } from "lucide-react"
import "@repo/brand/tokens.css"
import "@repo/brand/fonts.css"
import "@repo/brand/components.css"
import { applySavedTheme } from "../shared/styles/theme"
import "../shared/styles/style.css"

import { SignetProvider, useSignetContext } from "~shared/context/SignetContext"
import { t } from "~shared/i18n"
import { short } from "~shared/ui"
import { WalletTab } from "~shared/wallet/WalletTab"
import { HomeTab } from "~shared/home/HomeTab"
import { TradeTab } from "~shared/trade/TradeTab"
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

type Screen = "home" | "trade" | "status" | "settings"

const BOTTOM_BAR = {
  home: { label: "tabWallet", icon: Wallet },
  trade: { label: "tabTrade", icon: ArrowLeftRight },
  status: { label: "tabStatus", icon: Activity },
} satisfies Record<"home" | "trade" | "status", { label: string; icon: LucideIcon }>

function SidePanel() {
  const { isWalletInitialized, currentAccount, endSession } = useSignetContext()
  const [screen, setScreen] = useState<Screen>("home")

  // Locked, or no active account yet: only the wallet's own page (unlock, or add an account)
  if (!isWalletInitialized || !currentAccount) {
    return (
      <div className="w-app">
        <main className="w-main">
          <ErrorBoundary><WalletTab /></ErrorBoundary>
        </main>
      </div>
    )
  }

  const page = screen === "settings" ? <WalletTab />
    : screen === "status" ? <StatusTab />
    : screen === "trade" ? <TradeTab />
    : <HomeTab address={currentAccount.stxAddress} />

  // Status checks run once per unlock (and every 5 minutes), not on every screen switch
  return (
    <DiagnosticsProvider>
      <div className="w-app">
        <header className="w-topbar">
          {screen === "settings" ? (
            <>
              <button type="button" className="w-chrome-btn" onClick={() => setScreen("home")} title={t("back")} aria-label={t("back")}>
                <ArrowLeft size={18} aria-hidden />
              </button>
              <strong className="w-topbar-title">{t("settingsTitle")}</strong>
            </>
          ) : (
            <div className="w-topbar-title">
              <strong>{t("accountName", currentAccount.index + 1)}</strong>
              <span>{short(currentAccount.stxAddress)}</span>
            </div>
          )}
          {screen !== "settings" && (
            <button type="button" className="w-chrome-btn" onClick={() => setScreen("settings")} title={t("settingsTitle")} aria-label={t("settingsTitle")}>
              <Settings size={18} aria-hidden />
            </button>
          )}
          <button type="button" className="w-chrome-btn" onClick={() => endSession()} title={t("lockTheWallet")} aria-label={t("lockTheWallet")}>
            <Lock size={18} aria-hidden />
          </button>
        </header>

        <main className="w-main">
          <ErrorBoundary key={screen}>{page}</ErrorBoundary>
        </main>

        {screen !== "settings" && (
          <nav className="w-bottombar" aria-label="Blaze Wallet">
            {(Object.keys(BOTTOM_BAR) as (keyof typeof BOTTOM_BAR)[]).map(name => {
              const { label, icon: Icon } = BOTTOM_BAR[name]
              return (
                <button key={name} type="button" className="w-bottom-tab" aria-current={screen === name ? "page" : undefined} onClick={() => setScreen(name)}>
                  <Icon size={20} aria-hidden />
                  <span>{t(label)}</span>
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </DiagnosticsProvider>
  )
}
