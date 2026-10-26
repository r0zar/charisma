import StacksKit
import SwiftUI
import WalletCore

/// What the home asks Trade to set up when it opens it
enum TradeIntent: Equatable {
    /// STX from Standard onto Blaze
    case moveToBlaze
}

/// Trade, amount first: the pair on top (each side's token and network), the amount in the middle, typed on the
/// screen's own number pad. A token with a Blaze subnet gets a Standard / Blaze capsule on each side: from Blaze it's an
/// order a solver fills; onto Blaze from Standard, the route's last hop deposits it. Review shows what the trade does
/// before anything is signed.
struct TradeView: View {
    let account: Account
    @Binding var intent: TradeIntent?

    @Environment(Vault.self) private var vault
    @State private var holdings: TokensModel
    @State private var model = TradeModel()
    @State private var fromId: String? = TokenRow.stx
    @State private var toId: String?
    /// Each side's capsule. It only takes effect where the token has a Blaze subnet (see fromOnBlaze and toOnBlaze).
    @State private var fromBlaze = false
    @State private var toBlaze = false
    @State private var amountText = ""
    @State private var picking: Side?
    @State private var review: Swap.Review?
    @State private var orderReview: BlazeOrderReview?
    @State private var preparing = false
    @State private var reviewError: Error?

    private enum Side: String, Identifiable {
        case from, to

        var id: Self { self }
    }

    /// The trade on screen, when it can be quoted: both sides' tokens, and an amount of the From side
    private struct QuoteRequest: Equatable {
        let from: String
        let to: String
        let amount: UInt64
    }

    init(account: Account, intent: Binding<TradeIntent?>) {
        self.account = account
        _intent = intent
        _holdings = State(initialValue: TokensModel(address: account.stxAddress))
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 0) {
                    pair
                    amountBlock
                    networks
                    if let route = model.route {
                        Text("Route: \(routeText(route))")
                            .monoFont(.caption)
                            .foregroundStyle(.brand("ink-muted"))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 20)
                            .padding(.top, 16)
                    }
                    problems
                }
                .padding(.bottom, 12)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollIndicators(.hidden)
            .refreshable {
                await holdings.load()
                await model.loadTokens()
            }
            Keypad(decimalMark: Amount.decimalMark(.current), press: press)
                .padding(.horizontal, 24)
            Button {
                Task { await prepareReview() }
            } label: {
                if preparing {
                    ProgressView().tint(.white)
                } else if isUpgrade {
                    Text("Upgrade")
                } else if isDowngrade {
                    Text("Downgrade")
                } else if fromOnBlaze {
                    Text("Review order")
                } else {
                    Text("Review swap")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(request == nil || preparing || overBalance)
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
        .background(Color.brand("bg"))
        .ledgerTabBar()
        .task { await holdings.load() }
        .task { await holdings.watch() }
        .task { await model.loadTokens() }
        // A changed trade drops its old route at once, and quotes the new one after a short pause
        .task(id: request) {
            model.clearQuote()
            guard let request else { return }
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await model.quote(from: request.from, to: request.to, amount: request.amount)
        }
        .onChange(of: intent, initial: true) { _, wanted in apply(wanted) }
        .sheet(item: $picking) { side in
            TokenPickerSheet(title: side == .from ? "From" : "To", choices: choices(for: side)) { contractId in
                pick(side, contractId)
            }
        }
        .sheet(isPresented: Binding(get: { review != nil }, set: { if !$0 { review = nil } })) {
            if let review, let from = fromRow, let to = toInfo, let stx = holdings.stx {
                SwapReviewSheet(review: review, from: from, to: to, toBlaze: toOnBlaze, stx: stx, account: account, isUpgrade: isUpgrade)
                    .privacyCover()
            }
        }
        .sheet(item: $orderReview) { order in
            BlazeOrderReviewSheet(review: order, account: account).privacyCover()
        }
    }

    private var header: some View {
        HStack {
            Text("Swap").brandFont(.title2, weight: .black)
            Spacer()
            IconButton(systemImage: "lock", label: "Lock") { vault.lock() }
        }
        .padding(.leading, 20)
        .padding(.trailing, 12)
        .padding(.top, 8)
    }

    /// Both sides' tokens, each with its network, and the flip between them
    private var pair: some View {
        HStack(spacing: 6) {
            sideButton(.from)
            Button(action: flip) {
                Image(systemName: "arrow.left.arrow.right")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.brand("ink"))
                    .frame(width: 36, height: 36)
                    .background(Color.brand("bg"), in: Circle())
                    .overlay(Circle().stroke(Color.brand("line-strong"), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(toId == nil)
            .accessibilityLabel(Text("Switch tokens"))
            sideButton(.to)
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
    }

    private func sideButton(_ side: Side) -> some View {
        let onBlaze = side == .from ? fromOnBlaze : toOnBlaze
        let symbol = side == .from ? fromRow.map { Format.symbol($0) } : toInfo.flatMap { $0.symbol ?? $0.contractId }
        let image = side == .from ? fromRow?.meta?.image : toInfo?.image.flatMap { URL(string: $0) }
        return Button {
            picking = side
        } label: {
            HStack(spacing: 10) {
                if let symbol {
                    TokenAvatar(url: image, symbol: symbol, size: 32)
                        .overlay(alignment: .bottomTrailing) {
                            if onBlaze { BlazeBadge(size: 14).offset(x: 4, y: 4) }
                        }
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: symbol ?? String(localized: "Select token"))
                        .brandFont(.callout, weight: .heavy)
                        .foregroundStyle(.brand("ink"))
                        .lineLimit(1)
                    if symbol != nil {
                        if onBlaze {
                            Text("Blaze").brandFont(.caption, weight: .bold).foregroundStyle(Theme.blazeText)
                        } else {
                            Text("Standard").brandFont(.caption, weight: .bold).foregroundStyle(.brand("ink-muted"))
                        }
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.down").font(.caption.weight(.bold)).foregroundStyle(.brand("ink-muted"))
            }
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Color.brand("surface-hover"), in: RoundedRectangle(cornerRadius: 16))
            .overlay {
                if onBlaze { RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.blaze, lineWidth: 1) }
            }
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }

    /// The amount being typed, what it comes to, and the From side's balance
    private var amountBlock: some View {
        VStack(spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(verbatim: amountText.isEmpty ? "0" : amountText)
                    .monoFont(size: 64, weight: .medium, relativeTo: .largeTitle)
                    .tracking(-2.5)
                    .foregroundStyle(.brand(amountText.isEmpty ? "ink-faint" : "ink"))
                    .lineLimit(1)
                    .minimumScaleFactor(0.4)
                if let from = fromRow {
                    Text(verbatim: Format.symbol(from)).brandFont(.title2, weight: .heavy).foregroundStyle(.brand("ink-muted"))
                }
            }
            quoteLine
            if let from = fromRow {
                HStack(spacing: 8) {
                    Text("Balance: \(Format.amount(available(from), of: from, precision: .cut(6))) \(Format.symbol(from))")
                        .monoFont(.caption)
                        .foregroundStyle(.brand("ink-muted"))
                    Button("Max") {
                        if let decimals = from.meta?.decimals {
                            // On Blaze, the most one order can carry: one subnet's balance
                            let most = fromOnBlaze ? BlazeOrder.mostInOneOrder(from.blazeParts) : available(from)
                            amountText = Amount.editable(max(most, 0), decimals: decimals, locale: .current)
                        }
                    }
                    .monoFont(.caption, weight: .medium)
                    .foregroundStyle(.brand("accent-text"))
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 20)
        .padding(.top, 26)
    }

    @ViewBuilder private var quoteLine: some View {
        if model.quoting {
            Text(verbatim: "…").monoFont(.subheadline).foregroundStyle(.brand("ink-muted"))
        } else if let route = model.route, let to = toInfo {
            let out = "≈ \(tradeAmount(route.amountOut, decimals: to.decimals ?? 6)) \(to.symbol ?? to.contractId ?? "")"
            if toOnBlaze {
                Text("\(out) on Blaze").monoFont(.subheadline).foregroundStyle(Theme.blazeText)
            } else {
                Text(verbatim: out).monoFont(.subheadline).foregroundStyle(.brand("ink-body"))
            }
        }
    }

    /// Each side's Standard / Blaze capsule, for a token with a Blaze subnet
    @ViewBuilder private var networks: some View {
        let fromHas = blazeSubnet(fromId) != nil
        let toHas = blazeSubnet(toId) != nil
        if fromHas || toHas {
            VStack(spacing: 10) {
                if fromHas { networkRow("From", $fromBlaze) }
                if toHas { networkRow("To", $toBlaze) }
            }
            .padding(.horizontal, 20)
            .padding(.top, 22)
        }
    }

    private func networkRow(_ title: LocalizedStringKey, _ blaze: Binding<Bool>) -> some View {
        HStack {
            Text(title).brandFont(.subheadline, weight: .heavy).foregroundStyle(.brand("ink-body"))
            Spacer()
            NetworkCapsule(blaze: blaze)
        }
    }

    private var problems: some View {
        VStack(spacing: 6) {
            ErrorText(error: holdings.error)
            ErrorText(error: model.loadError)
            ErrorText(error: model.quoteError)
            ErrorText(error: reviewError)
            if overBalance {
                Text("More than your balance").brandFont(.footnote, weight: .semibold).foregroundStyle(.brand("danger"))
            } else if fromSpend == .split, let from = fromRow {
                Text("Your \(Format.symbol(from)) on Blaze is split between Blaze v1 and v2, and neither part holds this much. Upgrade it on Charisma Swap, or trade less.")
                    .brandFont(.footnote, weight: .semibold)
                    .foregroundStyle(.brand("warning"))
            }
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 20)
        .padding(.top, 12)
    }

    /// The number pad: digits up to the token's decimals, one decimal mark, delete
    private func press(_ key: Keypad.Key) {
        let mark = Amount.decimalMark(.current)
        switch key {
        case .delete:
            if !amountText.isEmpty { amountText.removeLast() }
        case .decimal:
            guard fromRow?.meta?.decimals != 0, !amountText.contains(mark) else { return }
            amountText = (amountText.isEmpty ? "0" : amountText) + mark
        case .digit(let digit):
            if amountText == "0" {
                amountText = "\(digit)"
                return
            }
            if let range = amountText.range(of: mark), let decimals = fromRow?.meta?.decimals,
               amountText[range.upperBound...].count >= decimals { return }
            guard amountText.count < 24 else { return }
            amountText += "\(digit)"
        }
    }

    /// The home's Blaze action: STX from Standard onto Blaze
    private func apply(_ wanted: TradeIntent?) {
        guard let wanted else { return }
        switch wanted {
        case .moveToBlaze:
            fromId = TokenRow.stx
            toId = TokenRow.stx
            fromBlaze = false
            toBlaze = true
            amountText = ""
        }
        intent = nil
    }

    /// The route's tokens, without the Blaze subnets (each is its base token, which the route lists too)
    private func routeText(_ route: Swap.Route) -> String {
        route.path.filter { !BlazeOrder.subnets.contains($0.contractId) }.map { $0.symbol ?? $0.contractId }.joined(separator: " → ")
    }

    /// The Blaze subnet a token trades through, when the wallet orders through one
    private func blazeSubnet(_ contractId: String?) -> String? {
        contractId.flatMap { model.blazeSubnets[$0] }
    }

    /// From trades on Blaze when its capsule says so and its token has a Blaze subnet
    private var fromOnBlaze: Bool { fromBlaze && blazeSubnet(fromId) != nil }

    /// The same token on both sides, Standard to Blaze: an upgrade (the route deposits it into its subnet)
    private var isUpgrade: Bool { fromId != nil && fromId == toId && !fromOnBlaze && toOnBlaze }

    /// The same token on both sides, Blaze to Standard: a downgrade (an order takes it out of its subnet)
    private var isDowngrade: Bool { fromId != nil && fromId == toId && fromOnBlaze && !toOnBlaze }

    /// To lands on Blaze when its capsule says so and its token has a Blaze subnet: from Standard that's a deposit, from Blaze an order
    private var toOnBlaze: Bool { toBlaze && blazeSubnet(toId) != nil }

    /// Which subnet pays the From side on Blaze: v1 first when it holds the amount, then v2, as Charisma Swap pays
    private var fromSpend: BlazeOrder.Spend? {
        guard fromOnBlaze, let from = fromRow, let micro = amountMicro else { return nil }
        return BlazeOrder.spend(Int128(micro), parts: from.blazeParts)
    }

    /// What the swap service quotes for the From side: the Blaze subnet that pays, or its token
    private var fromTradeId: String? {
        guard fromOnBlaze else { return fromId }
        if case .from(let subnet)? = fromSpend { return subnet }
        return nil
    }

    /// What the swap service quotes for the To side: its Blaze subnet, or its token
    private var toTradeId: String? { toOnBlaze ? blazeSubnet(toId) : toId }

    /// What the From side holds on its network: its v1 and v2 subnets, or its Standard balance
    private func available(_ row: TokenRow) -> Int128 {
        fromOnBlaze ? BlazeOrder.spendable(row.blazeParts) : row.standard
    }

    /// The From token's row: a token the router can reach that the wallet holds on Standard or on Blaze
    private var fromRow: TokenRow? {
        guard let fromId else { return nil }
        return holdings.listed.first { $0.contractId == fromId && ($0.standard > 0 || $0.blaze > 0) && model.routable.contains($0.contractId) }
    }

    private var toInfo: TokenInfo? {
        guard let toId else { return nil }
        return model.tokens.first { $0.contractId == toId }
    }

    /// The typed amount in smallest units, when it's a positive amount of the From token. Not checked against the balance
    /// here: overBalance does that, for both networks.
    private var amountMicro: UInt64? {
        guard let from = fromRow, let decimals = from.meta?.decimals,
              let value = try? Amount.parse(amountText, decimals: decimals, locale: .current), value > 0 else { return nil }
        return UInt64(exactly: value)
    }

    /// More than the From side holds: an order for it would never fill, and a Standard swap would fail on chain
    private var overBalance: Bool {
        guard let from = fromRow, let micro = amountMicro else { return false }
        return Int128(micro) > available(from)
    }

    private var request: QuoteRequest? {
        guard fromRow != nil, let from = fromTradeId, let to = toTradeId, let amount = amountMicro else { return nil }
        return QuoteRequest(from: from, to: to, amount: amount)
    }

    private func choices(for side: Side) -> [TokenChoice] {
        switch side {
        case .from:
            return holdings.listed.filter { ($0.standard > 0 || $0.blaze > 0) && model.routable.contains($0.contractId) }.map { row in
                TokenChoice(
                    id: row.contractId, symbol: Format.symbol(row), name: row.meta?.name ?? row.contractId,
                    image: row.meta?.image, detail: Format.amount(row.total, of: row, precision: .cut(6))
                )
            }
        case .to:
            return model.tokens.compactMap { info in
                guard let id = info.contractId else { return nil }
                return TokenChoice(id: id, symbol: info.symbol ?? id, name: info.name ?? id, image: info.image.flatMap { URL(string: $0) }, detail: nil)
            }
        }
    }

    /// Picking the other side's token swaps the two, except for a token with a Blaze side: the same token on both sides
    /// moves it between Standard and Blaze (an upgrade or a downgrade)
    private func pick(_ side: Side, _ contractId: String) {
        switch side {
        case .from:
            if contractId == toId {
                if blazeSubnet(contractId) != nil {
                    fromId = contractId
                    fromBlaze = !toBlaze
                    return
                }
                toId = fromId
            }
            fromId = contractId
        case .to:
            if contractId == fromId {
                if blazeSubnet(contractId) != nil {
                    toId = contractId
                    toBlaze = !fromBlaze
                    return
                }
                fromId = toId
            }
            toId = contractId
        }
    }

    private func flip() {
        guard let to = toId else { return }
        toId = fromId
        fromId = to
        (fromBlaze, toBlaze) = (toBlaze, fromBlaze)
        amountText = ""
    }

    /// A fresh route for what's on screen, checked against the vault list (a Standard swap also gets its call built and
    /// checked; a Blaze order gets its review)
    private func prepareReview() async {
        guard !preparing, let from = fromRow, let to = toInfo, let amount = amountMicro, !overBalance,
              let fromTrade = fromTradeId, let toTrade = toTradeId else { return }
        preparing = true
        reviewError = nil
        defer { preparing = false }
        do {
            let route = try await Swap.quote(from: fromTrade, to: toTrade, amount: amount)
            guard route.path.first?.contractId == fromTrade, route.path.last?.contractId == toTrade else {
                throw WalletError.unexpected("The route doesn't match the trade on screen")
            }
            if fromOnBlaze {
                orderReview = BlazeOrderReview(
                    route: route, from: from, to: to, amount: amount, subnet: fromTrade, outputToken: toTrade, toBlaze: toOnBlaze,
                    isDowngrade: isDowngrade
                )
            } else if let stx = holdings.stx {
                review = try await Swap.review(route: route, from: from, amount: amount, stx: stx, account: account, hiro: Hiro())
            }
        } catch {
            reviewError = error
        }
    }
}

/// An amount in a token's whole units: up to 6 decimals, for the Trade screen's displays
func tradeAmount(_ micro: Double, decimals: Int) -> String {
    (micro / pow(10, Double(decimals))).formatted(.number.precision(.fractionLength(0...6)))
}
