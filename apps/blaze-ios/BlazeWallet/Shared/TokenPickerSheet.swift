import SwiftUI

/// One token a picker offers
struct TokenChoice: Identifiable, Hashable {
    let id: String
    let symbol: String
    let name: String
    /// The token's picture from Charisma's list, when it has one
    let image: URL?
    /// An amount the wallet holds, when it does
    let detail: String?
}

/// Choose a token: searchable hairline rows, with the amount held where there is one (Trade's two sides, the home's Send)
struct TokenPickerSheet: View {
    let title: LocalizedStringKey
    let choices: [TokenChoice]
    let onPick: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(filtered) { choice in
                        Button {
                            onPick(choice.id)
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                TokenAvatar(url: choice.image, symbol: choice.symbol, size: 36)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(verbatim: choice.symbol).brandFont(.callout, weight: .bold)
                                    Text(verbatim: choice.name)
                                        .brandFont(.footnote)
                                        .foregroundStyle(.brand("ink-muted"))
                                        .lineLimit(1)
                                }
                                Spacer(minLength: 8)
                                if let detail = choice.detail {
                                    Text(verbatim: detail).monoFont(.footnote).foregroundStyle(.brand("ink-body"))
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .ledgerRow()
                    }
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Color.brand("bg"))
            .searchable(text: $query)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }

    private var filtered: [TokenChoice] {
        let search = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !search.isEmpty else { return choices }
        return choices.filter {
            $0.symbol.lowercased().contains(search) || $0.name.lowercased().contains(search) || $0.id.lowercased().contains(search)
        }
    }
}
