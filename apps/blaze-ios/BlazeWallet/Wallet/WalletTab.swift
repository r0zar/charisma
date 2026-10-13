import SwiftUI
import WalletCore

/// Seed phrases, accounts and the vault's settings (the extension's WalletTab)
struct WalletTab: View {
    @Environment(Vault.self) private var vault
    @AppStorage(Theme.storageKey) private var theme = Theme.Choice.system
    @State private var sheet: Sheet?
    @State private var unlinking: SeedPhrase?
    @State private var unlinkingWallet = false
    @State private var error: Error?

    private enum Sheet: Identifiable {
        case newSeed, importSeed, receive(Account), words(name: String, phrase: String)

        var id: String {
            switch self {
            case .newSeed: "new"
            case .importSeed: "import"
            case .receive(let account): "receive-\(account.id)"
            case .words(let name, _): "words-\(name)"
            }
        }
    }

    var body: some View {
        NavigationStack {
            List {
                activeAccount
                seedPhrases
                vaultSection
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle("Wallet")
            .toolbar { LockButton() }
            .sheet(item: $sheet, content: sheetView)
            .alert(error.map { ErrorWords.message($0) } ?? "", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
                Button("OK") {}
            }
            .confirmationDialog("Unlink this seed phrase from this iPhone?", isPresented: Binding(get: { unlinking != nil }, set: { if !$0 { unlinking = nil } }), titleVisibility: .visible, presenting: unlinking) { seed in
                Button("Unlink", role: .destructive) { run { try vault.act { $0.unlinkSeedPhrase(id: seed.id) } } }
            } message: { _ in
                Text("Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words.")
            }
            .confirmationDialog("Unlink this wallet from this iPhone?", isPresented: $unlinkingWallet, titleVisibility: .visible) {
                Button("Unlink wallet", role: .destructive) { run { try vault.unlinkWallet() } }
            } message: {
                Text("Every seed phrase and account is removed from this iPhone. Your funds stay safe on the blockchain; you'll need your seed phrases to get back in.")
            }
        }
    }

    @ViewBuilder private var activeAccount: some View {
        Section {
            if let account = vault.state?.activeAccount {
                HStack {
                    Text("Account \(Int(account.index) + 1)").brandFont(.headline, weight: .semibold)
                    Spacer()
                    Text("Active").brandFont(.caption, weight: .semibold).foregroundStyle(.brand("success"))
                }
                Text(account.stxAddress).monoFont(.callout).textSelection(.enabled)
                HStack {
                    CopyButton(text: account.stxAddress)
                    Spacer()
                    Button("Receive", systemImage: "qrcode") { sheet = .receive(account) }
                }
                .buttonStyle(.borderless)
            } else {
                Text("No active account").brandFont(.headline, weight: .semibold)
                Text("Add an account from a seed phrase below.").foregroundStyle(.brand("warning"))
            }
        }
    }

    @ViewBuilder private var seedPhrases: some View {
        Section("Seed phrases") {
            ForEach(vault.state?.seedPhrases ?? []) { seed in
                SeedPhraseCard(
                    seed: seed,
                    accounts: vault.state?.accounts(of: seed.id) ?? [],
                    activeAccountId: vault.state?.activeAccountId,
                    use: { account in run { try vault.act { try $0.activate(accountId: account.id) } } },
                    addAccount: { run { _ = try vault.act { try $0.addAccount(seedPhraseId: seed.id) } } },
                    showWords: { reveal(seed) },
                    unlink: { unlinking = seed }
                )
            }
            Button("Generate new") { sheet = .newSeed }
            Button("Import") { sheet = .importSeed }
        }
    }

    @ViewBuilder private var vaultSection: some View {
        Section("Vault") {
            LabeledContent { Text("On this iPhone only, behind Face ID") } label: { Text("Keys") }
            LabeledContent { Text("After 15 idle minutes") } label: { Text("Auto-lock") }
            Picker("Theme", selection: $theme) {
                Text("System").tag(Theme.Choice.system)
                Text("Light · Bitcoin").tag(Theme.Choice.light)
                Text("Dark · RPG").tag(Theme.Choice.dark)
            }
            Button("Lock") { vault.lock() }
            Button("Unlink wallet", role: .destructive) { unlinkingWallet = true }
        }
    }

    @ViewBuilder private func sheetView(_ sheet: Sheet) -> some View {
        Group {
            switch sheet {
            case .newSeed:
                NavigationStack { NewSeedFlow(mode: .addToWallet) { self.sheet = nil } }
            case .importSeed:
                NavigationStack { ImportSeedView(mode: .addToWallet) { self.sheet = nil } }
            case .receive(let account):
                ReceiveSheet(address: account.stxAddress)
            case .words(let name, let phrase):
                SeedWordsSheet(name: name, words: phrase.split(separator: " ").map(String.init))
            }
        }
        // Sheets draw above the root's cover: the 24 new words and Show seed phrase must never reach a snapshot
        .privacyCover()
    }

    /// Runs a wallet change, showing its error instead of losing it
    private func run(_ change: () throws -> Void) {
        error = nil
        do { try change() } catch { self.error = error }
    }

    private func reveal(_ seed: SeedPhrase) {
        Task {
            error = nil
            do {
                sheet = .words(name: seed.name, phrase: try await vault.revealWords(of: seed.id))
            } catch VaultError.cancelled {
                // Dismissed
            } catch {
                self.error = error
            }
        }
    }
}

/// One seed phrase: its accounts (Use / Active), + Account, Show seed phrase and Unlink
private struct SeedPhraseCard: View {
    let seed: SeedPhrase
    let accounts: [Account]
    let activeAccountId: String?
    let use: (Account) -> Void
    let addAccount: () -> Void
    let showWords: () -> Void
    let unlink: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(seed.name).brandFont(.headline, weight: .semibold)
            ForEach(accounts) { account in
                AccountRow(account: account, isActive: account.id == activeAccountId) { use(account) }
            }
            // In one row when the language fits it, otherwise one under another
            ViewThatFits {
                HStack {
                    actions
                }
                VStack(alignment: .leading, spacing: 10) {
                    actions
                }
            }
        }
        .buttonStyle(.borderless)
        .padding(.vertical, 4)
    }

    @ViewBuilder private var actions: some View {
        Button("+ Account", action: addAccount)
        Spacer()
        Button("Show seed phrase", action: showWords)
        Spacer()
        Button("Unlink", role: .destructive, action: unlink)
    }
}

/// "Account N", its short address, and Active or Use
private struct AccountRow: View {
    let account: Account
    let isActive: Bool
    let use: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text("Account \(Int(account.index) + 1)")
                Text(Format.short(account.stxAddress)).monoFont(.caption).foregroundStyle(.brand("ink-muted"))
            }
            Spacer()
            if isActive {
                Text("Active").brandFont(.caption, weight: .semibold).foregroundStyle(.brand("success"))
            } else {
                Button("Use", action: use)
            }
        }
    }
}

/// Copies text, then says so for two seconds
struct CopyButton: View {
    let text: String
    @State private var copied = false

    var body: some View {
        Button(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc") {
            UIPasteboard.general.string = text
            copied = true
            Task {
                try? await Task.sleep(for: .seconds(2))
                copied = false
            }
        }
    }
}
