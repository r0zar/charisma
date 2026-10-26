import SwiftUI
import WalletCore

/// The wallet's home, as the extension's: the total with its 24h change, Send and Receive, then the account's tokens
/// or its activity. Settings (seed phrases, accounts and the vault) open from the gear.
struct HomeView: View {
    let account: Account

    @Environment(Vault.self) private var vault
    @State private var model: TokensModel
    @State private var activity: ActivityModel
    @State private var pane = Pane.tokens
    @State private var sending: TokenRow?
    @State private var reason: TokenRow?
    @State private var showUnlisted = false
    @State private var receiving = false
    @State private var settings = false

    /// What the list shows under the total
    private enum Pane: String, CaseIterable, Identifiable {
        case tokens = "Tokens"
        case activity = "Activity"

        var id: Self { self }
    }

    init(account: Account) {
        self.account = account
        _model = State(initialValue: TokensModel(address: account.stxAddress))
        _activity = State(initialValue: ActivityModel(address: account.stxAddress))
    }

    var body: some View {
        NavigationStack {
            List {
                if let unsent = vault.unsent, unsent.address == account.stxAddress {
                    // Its own view per transaction: a later unsent send starts from its warning, not from this one's "sent"
                    Section { UnsentSendView(unsent: unsent).id(unsent.transaction.txid) }
                }
                hero
                actions
                Section {
                    Picker("Show", selection: $pane) {
                        ForEach(Pane.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                switch pane {
                case .tokens: tokenRows
                case .activity: activityRows
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle("Wallet")
            .inAppLinks()
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Settings", systemImage: "gearshape") { settings = true }
                }
                LockButton()
            }
            .refreshable { await reload() }
            .task { await model.load() }
            .task { await model.watch() }
            .task(id: pane) {
                if pane == .activity, activity.rows == nil { await activity.load() }
            }
            .sheet(item: $sending) { row in
                // STX's row is always there once rows are, and a row has to be on screen to be sent
                if let stx = model.stx { SendSheet(row: row, stx: stx, account: account).privacyCover() }
            }
            .sheet(isPresented: $receiving) {
                ReceiveSheet(address: account.stxAddress).privacyCover()
            }
            .sheet(isPresented: $settings) {
                // Settings brings its own navigation; its words sit above the privacy cover, as the wallet's other sheets do
                WalletTab().privacyCover()
            }
            .alert(reason.map(Format.symbol) ?? "", isPresented: Binding(get: { reason != nil }, set: { if !$0 { reason = nil } }), presenting: reason) { _ in
                Button("OK") {}
            } message: { row in
                if let why = row.unsendable { Text(ErrorWords.unsendable(why, symbol: Format.symbol(row))) }
            }
        }
    }

    /// The total in USD, and its change over 24 hours
    private var hero: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text("Total value").brandFont(.caption, weight: .semibold).foregroundStyle(.brand("ink-muted"))
                Text(model.rows != nil && model.prices != nil ? Format.usd(model.totalValue) : "…")
                    .monoFont(.largeTitle, weight: .medium)
                    .contentTransition(.numericText())
                    .animation(.default, value: model.totalValue)
                if let change = model.change24h {
                    let percent = abs(change.percent).formatted(.number.precision(.fractionLength(2)))
                    Label {
                        Text("\(Format.usd(abs(change.dollars))) (\(percent)%) 24h")
                    } icon: {
                        Image(systemName: change.dollars >= 0 ? "arrow.up" : "arrow.down")
                    }
                    .monoFont(.callout)
                    .foregroundStyle(change.dollars >= 0 ? Color.brand("success") : Color.brand("danger"))
                }
            }
            .padding(.vertical, 6)
        }
    }

    /// Send opens the token list, where a token is tapped to send it. Receive shows the address.
    private var actions: some View {
        Section {
            HStack(spacing: 12) {
                Button {
                    pane = .tokens
                } label: {
                    Label("Send", systemImage: "arrow.up").frame(maxWidth: .infinity)
                }
                Button {
                    receiving = true
                } label: {
                    Label("Receive", systemImage: "arrow.down").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
        }
    }

    @ViewBuilder private var tokenRows: some View {
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

    @ViewBuilder private var activityRows: some View {
        if let error = activity.error {
            Section { ErrorText(error: error) }
        }
        if let rows = activity.rows {
            if rows.isEmpty {
                Section { Text("No activity yet.").foregroundStyle(.brand("ink-muted")) }
            } else {
                Section {
                    ForEach(rows) { ActivityRowView(row: $0, tokens: activity.tokens) }
                    if activity.hasMore {
                        Button("Show more") { Task { await activity.loadMore() } }
                            .disabled(activity.busy)
                    }
                }
            }
        } else if activity.error == nil {
            Section {
                HStack(spacing: 12) {
                    ProgressView()
                    Text("Loading activity…").foregroundStyle(.brand("ink-muted"))
                }
            }
        }
    }

    private func row(for row: TokenRow) -> some View {
        Button {
            if row.unsendable == nil { sending = row } else { reason = row }
        } label: {
            TokenRowView(row: row, value: model.value(of: row), pricesLoaded: model.prices != nil)
        }
        .buttonStyle(.plain)
    }

    /// Pull to refresh: the balances, and the activity when it's the list on screen
    private func reload() async {
        await model.load()
        if pane == .activity { await activity.load() }
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
