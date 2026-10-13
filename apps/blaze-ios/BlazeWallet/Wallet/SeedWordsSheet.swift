import SwiftUI

/// A seed phrase's words, shown after a fresh Face ID check
struct SeedWordsSheet: View {
    let name: String
    let words: [String]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Anyone who sees these words controls your funds. Write them down on paper and keep them private.")
                        .foregroundStyle(.brand("warning"))
                }
                Section { SeedWordsGrid(words: words) }
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle(name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}
