import SwiftUI

/// What the app switcher and Control Centre show: the flame on the brand background, never the wallet
struct PrivacyCover: View {
    var body: some View {
        ZStack {
            Color.brand("bg").ignoresSafeArea()
            Image("BlazeFlame").resizable().scaledToFit().frame(width: 64)
        }
    }
}

extension View {
    /// Covers this view while the app isn't active. Sheets draw above the root view, so each sheet's root needs
    /// its own cover: snapshots must never show balances or seed words.
    func privacyCover() -> some View {
        modifier(PrivacyCoverModifier())
    }
}

private struct PrivacyCoverModifier: ViewModifier {
    @Environment(\.scenePhase) private var scenePhase

    func body(content: Content) -> some View {
        content.overlay {
            if scenePhase != .active { PrivacyCover() }
        }
    }
}
