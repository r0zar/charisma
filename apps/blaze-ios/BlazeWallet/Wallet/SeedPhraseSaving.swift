import SwiftUI
import WalletCore

/// Where new seed words go: the first ones create the wallet (Face ID once), later ones join it
enum SeedMode {
    case createWallet
    case addToWallet

    @MainActor
    func save(name: String, words: String, in vault: Vault) async throws {
        switch self {
        case .createWallet: try await vault.create(name: name, words: words)
        case .addToWallet: try vault.act { try $0.addSeedPhrase(name: name, words: words) }
        }
    }
}

extension View {
    /// Seed words come from the English list: no capitals, autocorrect or full-width letters
    func seedWordInput() -> some View {
        keyboardType(.asciiCapable)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .monoFont(.body)
    }
}

/// Numbered words, two columns
struct SeedWordsGrid: View {
    let words: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 10) {
            ForEach(Array(words.enumerated()), id: \.offset) { index, word in
                HStack(spacing: 8) {
                    Text(verbatim: String(index + 1)).monoFont(.caption).foregroundStyle(.brand("ink-faint")).frame(width: 24, alignment: .trailing)
                    Text(word).monoFont(.body)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
