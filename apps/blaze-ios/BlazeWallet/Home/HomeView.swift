import SwiftUI
import WalletCore

/// The wallet's home: the account, the total with its 24h change, Send · Receive · Trade · Blaze, then the account's
/// tokens, activity or NFTs as hairline rows. Settings (seed phrases, accounts and the vault) open from the account.
struct HomeView: View {
    let account: Account
    /// Opens Trade; `true` sets it up to move STX onto Blaze
    let openTrade: (_ toBlaze: Bool) -> Void

    @Environment(Vault.self) private var vault
    @State private var model: TokensModel
    @State private var activity: ActivityModel
    @State private var nfts: NftModel
    @State private var pane = Pane.tokens
    @State private var choosingSend = false
    /// The token picked to send, opened once the picker has gone
    @State private var picked: TokenRow?
    @State private var sending: TokenRow?
    @State private var reason: TokenRow?
    @State private var showUnlisted = false
    @State private var receiving = false
    @State private var settings = false

    /// What the list shows under the total
    private enum Pane: Hashable {
        case tokens, activity, nfts
    }

    init(account: Account, openTrade: @escaping (_ toBlaze: Bool) -> Void) {
        self.account = account
        self.openTrade = openTrade
        _model = State(initialValue: TokensModel(address: account.stxAddress))
        _activity = State(initialValue: ActivityModel(address: account.stxAddress))
        _nfts = State(initialValue: NftModel(address: account.stxAddress))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                if let unsent = vault.unsent, unsent.address == account.stxAddress {
                    // Its own view per transaction: a later unsent send starts from its warning, not from this one's "sent"
                    UnsentSendView(unsent: unsent)
                        .id(unsent.transaction.txid)
                        .padding(.horizontal, 20)
                        .padding(.top, 16)
                }
                hero
                ActionStrip {
                    StripButton(title: "Send", systemImage: "arrow.up.right") { choosingSend = true }
                    StripButton(title: "Receive", systemImage: "arrow.down.left") { receiving = true }
                    StripButton(title: "Trade", systemImage: "arrow.left.arrow.right", tint: AnyShapeStyle(Color.brand("accent-text"))) {
                        openTrade(false)
                    }
                    StripButton(title: "Blaze", systemImage: "flame.fill", tint: AnyShapeStyle(Theme.blazeText), divider: false) {
                        openTrade(true)
                    }
                }
                UnderlineTabs(options: [(Pane.tokens, "Tokens"), (Pane.activity, "Activity"), (Pane.nfts, "NFTs")], selection: $pane)
                    .padding(.top, 6)
                switch pane {
                case .tokens: tokenRows
                case .activity: activityRows
                case .nfts: nftRows
                }
            }
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .background(Color.brand("bg"))
        .ledgerTabBar()
        .inAppLinks()
        .refreshable { await reload() }
        .task { await model.load() }
        .task { await model.watch() }
        .task(id: pane) {
            if pane == .activity, activity.rows == nil { await activity.load() }
            if pane == .nfts, nfts.items == nil { await nfts.load() }
        }
        .sheet(isPresented: $choosingSend, onDismiss: {
            if let row = picked {
                picked = nil
                open(row)
            }
        }) {
            TokenPickerSheet(title: "Send", choices: sendChoices) { contractId in
                picked = model.listed.first { $0.contractId == contractId }
            }
            .privacyCover()
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

    /// The account (tap for Settings, where accounts are switched), Settings and Lock
    private var header: some View {
        HStack(spacing: 10) {
            Button {
                settings = true
            } label: {
                HStack(spacing: 10) {
                    Text(verbatim: "A\(Int(account.index) + 1)")
                        .monoFont(.caption, weight: .medium)
                        .frame(width: 32, height: 32)
                        .background(Color.brand("surface-selected"), in: RoundedRectangle(cornerRadius: 8))
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Account \(Int(account.index) + 1)").brandFont(.subheadline, weight: .bold)
                        Text(verbatim: Format.short(account.stxAddress)).monoFont(.caption).foregroundStyle(.brand("ink-muted"))
                    }
                    Image(systemName: "chevron.down").font(.caption.weight(.bold)).foregroundStyle(.brand("ink-muted"))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Spacer()
            IconButton(systemImage: "slider.horizontal.3", label: "Settings") { settings = true }
            IconButton(systemImage: "lock", label: "Lock") { vault.lock() }
        }
        .padding(.leading, 20)
        .padding(.trailing, 12)
        .padding(.top, 8)
    }

    /// The total in USD, and its change over 24 hours
    private var hero: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow("Total value")
            Text(verbatim: model.rows != nil && model.prices != nil ? Format.usd(model.totalValue) : "…")
                .monoFont(size: 44, relativeTo: .largeTitle)
                .tracking(-1.2)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .contentTransition(.numericText())
                .animation(.default, value: model.totalValue)
            if let change = model.change24h {
                let percent = abs(change.percent).formatted(.number.precision(.fractionLength(2)))
                Label {
                    Text("\(Format.usd(abs(change.dollars))) (\(percent)%) 24h")
                } icon: {
                    Image(systemName: change.dollars >= 0 ? "arrow.up.right" : "arrow.down.right")
                }
                .monoFont(.footnote)
                .foregroundStyle(change.dollars >= 0 ? Color.brand("success") : Color.brand("danger"))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 28)
        .padding(.bottom, 22)
    }

    @ViewBuilder private var tokenRows: some View {
        if let error = model.error {
            ErrorText(error: error).ledgerRow()
        }
        if let priceError = model.priceError {
            Text("Prices unavailable: \(ErrorWords.message(priceError))")
                .brandFont(.footnote)
                .foregroundStyle(.brand("warning"))
                .ledgerRow()
        }
        if model.rows != nil {
            ForEach(model.listed) { row(for: $0) }
            if !model.unlisted.isEmpty {
                Button {
                    withAnimation { showUnlisted.toggle() }
                } label: {
                    HStack(spacing: 8) {
                        Text("\(model.unlisted.count) unlisted · not on Charisma's token list, may be scams")
                            .brandFont(.footnote)
                            .foregroundStyle(.brand("ink-muted"))
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 8)
                        Image(systemName: "chevron.down")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.brand("ink-muted"))
                            .rotationEffect(.degrees(showUnlisted ? 180 : 0))
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .ledgerRow(vertical: 14)
                if showUnlisted {
                    ForEach(model.unlisted) { row(for: $0) }
                }
            }
        } else if model.error == nil {
            loading("Loading balances…")
        }
    }

    @ViewBuilder private var activityRows: some View {
        if let error = activity.error {
            ErrorText(error: error).ledgerRow()
        }
        if let rows = activity.rows {
            if rows.isEmpty {
                Text("No activity yet.").foregroundStyle(.brand("ink-muted")).ledgerRow(vertical: 16)
            } else {
                ForEach(rows) { ActivityRowView(row: $0, tokens: activity.tokens).ledgerRow() }
                if activity.hasMore {
                    Button("Show more") { Task { await activity.loadMore() } }
                        .brandFont(.subheadline, weight: .bold)
                        .foregroundStyle(.brand("accent-text"))
                        .disabled(activity.busy)
                        .ledgerRow(vertical: 14)
                }
            }
        } else if activity.error == nil {
            loading("Loading activity…")
        }
    }

    @ViewBuilder private var nftRows: some View {
        if let error = nfts.error {
            ErrorText(error: error).ledgerRow()
        }
        if let items = nfts.items {
            if items.isEmpty {
                Text("No NFTs yet.").foregroundStyle(.brand("ink-muted")).ledgerRow(vertical: 16)
            } else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 16) {
                    ForEach(items) { NftCard(nft: $0) }
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                if nfts.hasMore {
                    Button("Show more") { Task { await nfts.loadMore() } }
                        .brandFont(.subheadline, weight: .bold)
                        .foregroundStyle(.brand("accent-text"))
                        .disabled(nfts.busy)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 14)
                }
            }
        } else if nfts.error == nil {
            loading("Loading NFTs…")
        }
    }

    private func loading(_ text: LocalizedStringKey) -> some View {
        HStack(spacing: 12) {
            ProgressView()
            Text(text).foregroundStyle(.brand("ink-muted"))
        }
        .ledgerRow(vertical: 16)
    }

    private func row(for row: TokenRow) -> some View {
        Button {
            open(row)
        } label: {
            TokenRowView(row: row, value: model.value(of: row), pricesLoaded: model.prices != nil)
        }
        .buttonStyle(.plain)
        .ledgerRow()
    }

    /// Send a token, or say why it can't be sent
    private func open(_ row: TokenRow) {
        if row.unsendable == nil { sending = row } else { reason = row }
    }

    /// Every listed token, with what it holds on Standard (what a send spends)
    private var sendChoices: [TokenChoice] {
        model.listed.map { row in
            TokenChoice(
                id: row.contractId, symbol: Format.symbol(row), name: row.meta?.name ?? row.contractId,
                image: row.meta?.image, detail: Format.amount(row.standard, of: row, precision: .cut(6))
            )
        }
    }

    /// Pull to refresh: the balances, and the activity or NFTs when they're on screen
    private func reload() async {
        await model.load()
        if pane == .activity { await activity.load() }
        if pane == .nfts { await nfts.load() }
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
        VStack(alignment: .leading, spacing: 12) {
            if sent {
                Text("It confirms on Stacks in a few minutes.").brandFont(.subheadline)
            } else {
                Label {
                    Text("Your last send may have gone through already. Check the explorer before you send again.")
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill")
                }
                .brandFont(.subheadline, weight: .semibold)
                .foregroundStyle(.brand("warning"))
            }
            Link(destination: Format.explorer(unsent.transaction.txid)) {
                Label("View on explorer", systemImage: "arrow.up.right")
            }
            .brandFont(.subheadline, weight: .bold)
            .foregroundStyle(.brand("accent-text"))
            ErrorText(error: error)
            HStack(spacing: 10) {
                if !sent {
                    Button {
                        Task { await sendAgain() }
                    } label: {
                        if busy { ProgressView() } else { Text("Send again") }
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .disabled(busy)
                }
                Button("Done") { vault.unsent = nil }
                    .buttonStyle(SecondaryButtonStyle())
                    .disabled(busy)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.brand("warning-soft"), in: RoundedRectangle(cornerRadius: 12))
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
