import SwiftUI
import WalletCore

/// The active account's tokens: one total per token across Standard and Blaze, live, and sending them
struct TokensTab: View {
    let account: Account

    @Environment(Vault.self) private var vault
    @State private var model: TokensModel
    @State private var sending: TokenRow?
    @State private var reason: TokenRow?
    @State private var showUnlisted = false

    init(account: Account) {
        self.account = account
        _model = State(initialValue: TokensModel(address: account.stxAddress))
    }

    var body: some View {
        NavigationStack {
            List {
                if let unsent = vault.unsent, unsent.address == account.stxAddress {
                    Section { UnsentSendView(unsent: unsent) }
                }
                totalSection
                if let error = model.error {
                    Section { ErrorText(error: error) }
                }
                if let priceError = model.priceError {
                    Section {
                        Text("Prices unavailable: \(ErrorWords.message(priceError))").foregroundStyle(.brand("warning"))
                    }
                }
                if model.rows != nil {
                    Section {
                        ForEach(model.listed) { row(for: $0) }
                    }
                    if !model.unlisted.isEmpty {
                        Section {
                            DisclosureGroup(isExpanded: $showUnlisted) {
                                ForEach(model.unlisted) { row(for: $0) }
                            } label: {
                                Text("\(model.unlisted.count) unlisted · not on Charisma's token list, may be scams")
                                    .brandFont(.subheadline)
                                    .foregroundStyle(.brand("ink-muted"))
                            }
                        }
                    }
                } else if model.error == nil {
                    Section {
                        HStack(spacing: 12) {
                            ProgressView()
                            Text("Loading balances…").foregroundStyle(.brand("ink-muted"))
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle("Tokens")
            .inAppLinks()
            .toolbar { LockButton() }
            .refreshable { await model.load() }
            .task { await model.load() }
            .task { await model.watch() }
            .sheet(item: $sending) { row in
                // STX's row is always there once rows are, and a row has to be on screen to be sent
                if let stx = model.stx { SendSheet(row: row, stx: stx, account: account).privacyCover() }
            }
            .alert(reason.map(Format.symbol) ?? "", isPresented: Binding(get: { reason != nil }, set: { if !$0 { reason = nil } }), presenting: reason) { _ in
                Button("OK") {}
            } message: { row in
                if let why = row.unsendable { Text(ErrorWords.unsendable(why, symbol: Format.symbol(row))) }
            }
        }
    }

    @ViewBuilder private var totalSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text("Total value").brandFont(.caption, weight: .semibold).foregroundStyle(.brand("ink-muted"))
                Text(model.rows != nil && model.prices != nil ? Format.usd(model.totalValue) : "…")
                    .monoFont(.largeTitle, weight: .medium)
                    .contentTransition(.numericText())
                    .animation(.default, value: model.totalValue)
                if model.rows != nil {
                    Text(summary).brandFont(.footnote).foregroundStyle(.brand("ink-muted"))
                }
            }
            .padding(.vertical, 6)
        }
    }

    private var summary: String {
        let tokens = String(localized: "\(model.listed.count) tokens")
        guard model.prices != nil, model.unpricedCount > 0 else { return tokens }
        return tokens + " · " + String(localized: "\(model.unpricedCount) without a price")
    }

    private func row(for row: TokenRow) -> some View {
        Button {
            if row.unsendable == nil { sending = row } else { reason = row }
        } label: {
            TokenRowView(row: row, value: model.value(of: row), pricesLoaded: model.prices != nil)
        }
        .buttonStyle(.plain)
    }

}

/// A send that was signed but never clearly sent: it may already be on the network, so nothing new should be signed on
/// top of it before checking. "Send again" sends these same bytes, so it can't go out twice.
private struct UnsentSendView: View {
    let unsent: Vault.UnsentSend

    @Environment(Vault.self) private var vault
    @State private var busy = false
    @State private var sent = false
    @State private var error: Error?
    private let hiro = Hiro()

    var body: some View {
        if sent {
            Text("It confirms on Stacks in a few minutes.")
        } else {
            Text("Your last send may have gone through already. Check the explorer before you send again.")
                .foregroundStyle(.brand("warning"))
        }
        Link(destination: Format.explorer(unsent.transaction.txid)) {
            Label("View on explorer", systemImage: "arrow.up.right.square")
        }
        ErrorText(error: error)
        if !sent {
            Button {
                Task { await sendAgain() }
            } label: {
                if busy { ProgressView() } else { Text("Send again") }
            }
            .disabled(busy)
        }
        Button("Done") { vault.unsent = nil }.disabled(busy)
    }

    private func sendAgain() async {
        guard !busy else { return }
        error = nil
        busy = true
        defer { busy = false }
        do {
            try vault.touch()
            _ = try await Send.broadcast(unsent.transaction, hiro: hiro)
            sent = true
        } catch {
            self.error = error
        }
    }
}
