import SwiftUI

/// No wallet → Welcome; locked → the lock screen; unlocked → the wallet. While the app isn't active a cover hides
/// everything, so the app switcher's snapshot never shows balances or words.
struct RootView: View {
    @Environment(Vault.self) private var vault

    var body: some View {
        Group {
            switch vault.phase {
            case .checking: checking
            case .empty: WelcomeView()
            case .locked: LockView()
            case .unlocked: MainView()
            }
        }
        .brandFont(.body)
        .privacyCover()
        .task { vault.start() }
        .task(id: vault.locksAt) {
            // The 15-minute idle lock, right when it's due. Each action moves `locksAt`, which restarts this; a
            // wake-up a moment early just sleeps the rest.
            while let locksAt = vault.locksAt {
                guard (try? await Task.sleep(for: .seconds(max(0.1, locksAt.timeIntervalSinceNow)))) != nil else { return }
                vault.lockIfIdle()
            }
        }
    }

    @ViewBuilder private var checking: some View {
        if let error = vault.startError {
            VStack(spacing: 16) {
                ErrorText(error: error)
                Button("Try again") { vault.start() }.buttonStyle(.borderedProminent)
            }
            .padding()
        } else {
            ProgressView()
        }
    }
}

/// The unlocked wallet: its home and Status with an active account; only the Wallet settings without one (every seed
/// phrase unlinked). Settings open from the home's gear.
struct MainView: View {
    @Environment(Vault.self) private var vault
    /// Kept for the whole unlock (MainView goes away on lock), so Status doesn't check again on every tab switch
    @State private var status = StatusModel()
    @State private var tab = AppTab.wallet
    /// What the home's Trade and Blaze actions ask Trade to set up
    @State private var tradeIntent: TradeIntent?

    private enum AppTab: Hashable {
        case wallet, trade, status
    }

    var body: some View {
        if let account = vault.state?.activeAccount {
            TabView(selection: $tab) {
                Tab("Wallet", systemImage: "wallet.bifold", value: AppTab.wallet) {
                    HomeView(account: account) { toBlaze in
                        tradeIntent = toBlaze ? .moveToBlaze : nil
                        tab = .trade
                    }
                    .id(account.id)
                }
                Tab("Trade", systemImage: "arrow.left.arrow.right", value: AppTab.trade) {
                    TradeView(account: account, intent: $tradeIntent).id(account.id)
                }
                Tab("Status", systemImage: "waveform.path.ecg", value: AppTab.status) {
                    StatusTab(account: account, model: status).id(account.id)
                }
            }
            .tint(Color.brand("accent-text"))
        } else {
            WalletTab()
        }
    }
}

/// The Lock button every tab's toolbar has
struct LockButton: ToolbarContent {
    @Environment(Vault.self) private var vault

    var body: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button("Lock", systemImage: "lock") { vault.lock() }
        }
    }
}
