import SwiftUI

/// Asks for Face ID on appear, and again from the button
struct LockView: View {
    @Environment(Vault.self) private var vault
    @Environment(\.scenePhase) private var scenePhase
    @State private var error: Error?
    /// The lock screen asks by itself once: Face ID's own prompt makes the app inactive and active again
    @State private var asked = false

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image("BlazeFlame").resizable().scaledToFit().frame(width: 72)
            Text(verbatim: "Blaze Wallet").brandFont(.largeTitle, weight: .bold)
            Spacer()
            ErrorText(error: error)
            Button { Task { await unlock() } } label: {
                Label("Unlock", systemImage: "faceid").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(24)
        .background(Color.brand("bg"))
        .task(id: scenePhase) {
            // Leaving the app again earns another automatic ask when it comes back
            if scenePhase == .background { asked = false }
            // Face ID can only ask while the app is in front; a lock from the background waits for it
            guard scenePhase == .active, vault.asksOnAppear, !asked else { return }
            asked = true
            await unlock()
        }
    }

    private func unlock() async {
        error = nil
        do {
            try await vault.unlock()
        } catch VaultError.cancelled {
            // Dismissed: stay on the lock screen
        } catch {
            self.error = error
        }
    }
}
