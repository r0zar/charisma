import SwiftUI
import WalletCore

/// Bring an existing seed phrase: a name and its words
struct ImportSeedView: View {
    let mode: SeedMode
    var onDone: () -> Void = {}

    @Environment(Vault.self) private var vault
    @State private var name = ""
    @State private var words = ""
    @State private var saving = false
    @State private var error: Error?

    var body: some View {
        Form {
            Section("Name") {
                TextField("My seed phrase", text: $name)
            }
            Section {
                TextEditor(text: $words)
                    .seedWordInput()
                    .frame(minHeight: 120)
            } header: {
                Text("12 or 24 words")
            }
            Section {
                ErrorText(error: error)
                Button {
                    Task { await save() }
                } label: {
                    if saving { ProgressView() } else { Text("Import") }
                }
                .disabled(saving || name.trimmingCharacters(in: .whitespaces).isEmpty || words.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.brand("bg"))
        .navigationTitle("Import a seed phrase")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func save() async {
        error = nil
        saving = true
        defer { saving = false }
        do {
            try await mode.save(name: name, words: words, in: vault)
            onDone()
        } catch VaultError.cancelled {
            // Face ID dismissed: stay here
        } catch {
            self.error = error
        }
    }
}
