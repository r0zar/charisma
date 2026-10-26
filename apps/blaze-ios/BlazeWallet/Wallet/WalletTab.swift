import SwiftUI
import WalletCore

/// Seed phrases, accounts and the vault's settings (the extension's WalletTab)
struct WalletTab: View {
    @Environment(Vault.self) private var vault
    @AppStorage(Theme.storageKey) private var theme = Theme.Choice.system
    @State private var sheet: Sheet?
    @State private var unlinking: SeedPhrase?
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
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    activeAccount
                    seedPhrases
                    vaultSection
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle("Wallet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { LockButton() }
            .sheet(item: $sheet, content: sheetView)
            // A seed phrase being added when the wallet locked, or the app closed, picks up at its words
            .onAppear { if vault.seedDraft?.mode == .addToWallet, sheet == nil { sheet = .newSeed } }
            .alert(error.map { ErrorWords.message($0) } ?? "", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
                Button("OK") {}
            }
            .confirmationDialog("Unlink this seed phrase from this iPhone?", isPresented: Binding(get: { unlinking != nil }, set: { if !$0 { unlinking = nil } }), titleVisibility: .visible, presenting: unlinking) { seed in
                Button("Unlink", role: .destructive) { run { try vault.act { $0.unlinkSeedPhrase(id: seed.id) } } }
            } message: { _ in
                Text("Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words.")
            }
        }
    }

    @ViewBuilder private var activeAccount: some View {
        if let account = vault.state?.activeAccount {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Account \(Int(account.index) + 1)").brandFont(.title3, weight: .heavy)
                    Spacer()
                    Text("Active").monoFont(.caption, weight: .medium).foregroundStyle(.brand("success"))
                }
                Text(verbatim: account.stxAddress)
                    .monoFont(.footnote)
                    .foregroundStyle(.brand("ink-body"))
                    .textSelection(.enabled)
                HStack(spacing: 10) {
                    CopyButton(text: account.stxAddress).buttonStyle(SecondaryButtonStyle())
                    Button("Receive", systemImage: "qrcode") { sheet = .receive(account) }
                        .buttonStyle(SecondaryButtonStyle())
                }
                .padding(.top, 6)
            }
            .padding(.top, 16)
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Text("No active account").brandFont(.title3, weight: .heavy)
                Text("Add an account from a seed phrase below.").brandFont(.subheadline).foregroundStyle(.brand("warning"))
            }
            .padding(.top, 16)
        }
    }

    @ViewBuilder private var seedPhrases: some View {
        SectionHeading("Seed phrases")
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
        HStack(spacing: 10) {
            Button("Generate new") { sheet = .newSeed }.buttonStyle(SecondaryButtonStyle())
            Button("Import") { sheet = .importSeed }.buttonStyle(SecondaryButtonStyle())
        }
        .padding(.top, 14)
    }

    @ViewBuilder private var vaultSection: some View {
        SectionHeading("Vault")
        DetailRow(label: "Keys") {
            Text("On this iPhone only, behind Face ID").brandFont(.subheadline)
        }
        DetailRow(label: "Auto-lock") {
            Text("After 15 idle minutes").brandFont(.subheadline)
        }
        DetailRow(label: "Theme") {
            Picker("Theme", selection: $theme) {
                Text("System").tag(Theme.Choice.system)
                Text("Light · Bitcoin").tag(Theme.Choice.light)
                Text("Dark · RPG").tag(Theme.Choice.dark)
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .tint(Color.brand("accent-text"))
        }
        Button("Lock") { vault.lock() }
            .buttonStyle(SecondaryButtonStyle())
            .padding(.top, 16)
    }

    @ViewBuilder private func sheetView(_ sheet: Sheet) -> some View {
        Group {
            switch sheet {
            case .newSeed:
                NavigationStack { NewSeedFlow(mode: .addToWallet, resuming: vault.seedDraft) { self.sheet = nil } }
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
        VStack(alignment: .leading, spacing: 0) {
            Text(verbatim: seed.name).brandFont(.callout, weight: .heavy).padding(.vertical, 10)
            ForEach(accounts) { account in
                AccountRow(account: account, isActive: account.id == activeAccountId) { use(account) }
                    .padding(.vertical, 10)
                    .overlay(alignment: .top) { Hairline() }
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
            .brandFont(.subheadline, weight: .bold)
            .buttonStyle(.plain)
            .padding(.vertical, 12)
            .overlay(alignment: .top) { Hairline() }
        }
        .overlay(alignment: .bottom) { Hairline(strong: true) }
    }

    @ViewBuilder private var actions: some View {
        Button("+ Account", action: addAccount).foregroundStyle(.brand("accent-text"))
        Spacer()
        Button("Show seed phrase", action: showWords).foregroundStyle(.brand("accent-text"))
        Spacer()
        Button("Unlink", role: .destructive, action: unlink).foregroundStyle(.brand("danger"))
    }
}

/// "Account N", its short address, and Active or Use
private struct AccountRow: View {
    let account: Account
    let isActive: Bool
    let use: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 1) {
                Text("Account \(Int(account.index) + 1)").brandFont(.subheadline, weight: .bold)
                Text(verbatim: Format.short(account.stxAddress)).monoFont(.caption).foregroundStyle(.brand("ink-muted"))
            }
            Spacer()
            if isActive {
                Text("Active").monoFont(.caption, weight: .medium).foregroundStyle(.brand("success"))
            } else {
                Button("Use", action: use)
                    .brandFont(.subheadline, weight: .bold)
                    .foregroundStyle(.brand("accent-text"))
                    .buttonStyle(.plain)
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
