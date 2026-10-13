import SwiftUI

@main
struct BlazeWalletApp: App {
    @State private var vault = Vault()
    @AppStorage(Theme.storageKey) private var theme = Theme.Choice.system
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(vault)
                .preferredColorScheme(theme.colorScheme)
                .tint(.brand("accent"))
        }
        .onChange(of: scenePhase) { _, phase in
            // Leaving the app locks the wallet; coming back asks for Face ID straight away
            if phase == .background { vault.lock(askOnReturn: true) }
        }
    }
}
