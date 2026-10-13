import SafariServices
import SwiftUI

/// A web page shown inside the app. Opening Safari instead would leave the app, and leaving locks the wallet.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

extension View {
    /// Links in this view open in a web page inside the app (SafariView), not in Safari: leaving the app locks the wallet
    func inAppLinks() -> some View {
        modifier(InAppLinks())
    }
}

private struct InAppLinks: ViewModifier {
    @State private var page: URL?

    func body(content: Content) -> some View {
        content
            .environment(\.openURL, OpenURLAction { url in
                page = url
                return .handled
            })
            .sheet(isPresented: Binding(get: { page != nil }, set: { if !$0 { page = nil } })) {
                if let page { SafariView(url: page).ignoresSafeArea().privacyCover() }
            }
    }
}
