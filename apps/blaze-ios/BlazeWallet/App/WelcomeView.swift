import SwiftUI

/// No wallet on this iPhone yet: make a new seed phrase or bring one
struct WelcomeView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Spacer()
                Image("BlazeFlame").resizable().scaledToFit().frame(width: 72)
                Text(verbatim: "Blaze Wallet").brandFont(.largeTitle, weight: .bold)
                Text("Your keys stay on this iPhone, behind Face ID.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.brand("ink-muted"))
                Spacer()
                NavigationLink { NewSeedFlow(mode: .createWallet) } label: {
                    Text("Create a new wallet").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                NavigationLink { ImportSeedView(mode: .createWallet) } label: {
                    Text("Import a seed phrase").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                // The lighter accent keeps the label readable on the tinted button in both themes
                .tint(.brand("accent-text"))
            }
            .padding(24)
            .background(Color.brand("bg"))
        }
    }
}
