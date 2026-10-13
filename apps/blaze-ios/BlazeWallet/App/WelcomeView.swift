import SwiftUI

/// No wallet on this iPhone yet: make a new seed phrase or bring one
struct WelcomeView: View {
    @Environment(Vault.self) private var vault
    @State private var path: [Route] = []

    private enum Route: Hashable { case create, bring }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 16) {
                Spacer()
                Image("BlazeFlame").resizable().scaledToFit().frame(width: 72)
                Text(verbatim: "Blaze Wallet").brandFont(.largeTitle, weight: .bold)
                Text("Your keys stay on this iPhone, behind Face ID.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.brand("ink-muted"))
                Spacer()
                if vault.walletRemoved {
                    Text("The wallet is no longer on this iPhone. Turning off the passcode removes it, and it doesn't move to a new iPhone. Import your seed phrase to restore it.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.brand("warning"))
                        .brandFont(.callout)
                }
                NavigationLink(value: Route.create) {
                    Text("Create a new wallet").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                NavigationLink(value: Route.bring) {
                    Text("Import a seed phrase").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                // The lighter accent keeps the label readable on the tinted button in both themes
                .tint(.brand("accent-text"))
            }
            .padding(24)
            .background(Color.brand("bg"))
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .create: NewSeedFlow(mode: .createWallet, resuming: vault.seedDraft)
                case .bring: ImportSeedView(mode: .createWallet)
                }
            }
        }
        // A wallet being set up when the app closed picks up at its words
        .onAppear { if vault.seedDraft?.mode == .createWallet, path.isEmpty { path = [.create] } }
    }
}
