import StacksKit
import SwiftUI
import WalletCore

/// Trade: swap one token for another at the best route Charisma's swap service finds, as the extension's Trade tab.
/// Review shows what the swap does before anything is signed. Swap is the first trade style; the others join the
/// segmented control as they're built.
struct TradeView: View {
    let account: Account

    @Environment(Vault.self) private var vault
    @State private var holdings: TokensModel
    @State private var model = TradeModel()
    @State private var style = Style.swap
    @State private var fromId: String? = TokenRow.stx
    @State private var toId: String?
    @State private var amountText = ""
    @State private var picking: Side?
    @State private var review: Swap.Review?
    @State private var preparing = false
    @State private var reviewError: Error?

    private enum Style: String, CaseIterable, Identifiable {
        case swap = "Swap"

        var id: Self { self }
    }

    private enum Side: String, Identifiable {
        case from, to

        var id: Self { self }
    }

    /// The trade on screen, when it can be quoted: both tokens, and an amount of the From token
    private struct QuoteRequest: Equatable {
        let from: String
        let to: String
        let amount: UInt64
    }

    init(account: Account) {
        self.account = account
        _holdings = State(initialValue: TokensModel(address: account.stxAddress))
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Trade style", selection: $style) {
                        ForEach(Style.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                fromSection
                Section {
                    HStack {
                        Spacer()
                        Button(action: flip) {
                            Image(systemName: "arrow.up.arrow.down")
                        }
                        .disabled(toId == nil)
                        .accessibilityLabel("Switch tokens")
                        Spacer()
                    }
                }
                toSection
                if let error = holdings.error { Section { ErrorText(error: error) } }
                if let error = model.loadError { Section { ErrorText(error: error) } }
                Section {
                    ErrorText(error: model.quoteError)
                    ErrorText(error: reviewError)
                    Button {
                        Task { await prepareReview() }
                    } label: {
                        if preparing { ProgressView() } else { Text("Review swap") }
                    }
                    .disabled(request == nil || preparing)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle("Trade")
            .toolbar { LockButton() }
            .refreshable {
                await holdings.load()
                await model.loadTokens()
            }
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
            .sheet(item: $picking) { side in
                TokenPickerSheet(title: side == .from ? "From" : "To", choices: choices(for: side)) { contractId in
                    pick(side, contractId)
                }
            }
            .sheet(isPresented: Binding(get: { review != nil }, set: { if !$0 { review = nil } })) {
                if let review, let from = fromRow, let to = toInfo, let stx = holdings.stx {
                    SwapReviewSheet(review: review, from: from, to: to, stx: stx, account: account).privacyCover()
                }
            }
        }
    }

    private var fromSection: some View {
        Section("From") {
            HStack {
                Button {
                    picking = .from
                } label: {
                    tokenButton(fromRow.map { Format.symbol($0) })
                }
                TextField("0" + Amount.decimalMark(.current) + "0", text: $amountText)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .monoFont(.title3)
            }
            if let from = fromRow {
                HStack {
                    Text("Balance: \(Format.amount(from.standard, of: from, precision: .cut(6))) \(Format.symbol(from))")
                        .brandFont(.footnote)
                        .foregroundStyle(.brand("ink-muted"))
                    Spacer()
                    Button("Max") {
                        if let decimals = from.meta?.decimals {
                            amountText = Amount.editable(max(from.standard, 0), decimals: decimals, locale: .current)
                        }
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }

    private var toSection: some View {
        Section("To") {
            HStack {
                Button {
                    picking = .to
                } label: {
                    tokenButton(toInfo.map { $0.symbol ?? $0.contractId })
                }
                Spacer()
                Text(outputText)
                    .monoFont(.title3)
                    .foregroundStyle(.brand("ink"))
            }
            if let route = model.route {
                Text("Route: \(route.path.map { $0.symbol ?? $0.contractId }.joined(separator: " → "))")
                    .brandFont(.footnote)
                    .foregroundStyle(.brand("ink-muted"))
            }
        }
    }

    /// A token button's label: its symbol, or "Select token"
    private func tokenButton(_ symbol: String?) -> some View {
        HStack(spacing: 6) {
            Text(symbol ?? String(localized: "Select token")).brandFont(.body, weight: .semibold)
            Image(systemName: "chevron.down").font(.caption)
        }
        .foregroundStyle(.brand("ink"))
    }

    /// The From token's row: only a token the wallet can send, from its Standard balance
    private var fromRow: TokenRow? {
        guard let fromId else { return nil }
        return holdings.listed.first { $0.contractId == fromId && $0.standard > 0 }
    }

    private var toInfo: TokenInfo? {
        guard let toId else { return nil }
        return model.tokens.first { $0.contractId == toId }
    }

    /// The typed amount in smallest units, when it's a sendable amount of the From token
    private var amountMicro: UInt64? {
        guard let from = fromRow, let value = try? Send.amount(amountText, row: from, locale: .current) else { return nil }
        return UInt64(exactly: value)
    }

    private var request: QuoteRequest? {
        guard let from = fromRow, let to = toId, let amount = amountMicro else { return nil }
        return QuoteRequest(from: from.contractId, to: to, amount: amount)
    }

    private var outputText: String {
        if model.quoting { return "…" }
        guard let route = model.route, let to = toInfo else { return "—" }
        return tradeAmount(route.amountOut, decimals: to.decimals ?? 6)
    }

    private func choices(for side: Side) -> [TokenChoice] {
        switch side {
        case .from:
            return holdings.listed.filter { $0.standard > 0 }.map { row in
                TokenChoice(
                    id: row.contractId, symbol: Format.symbol(row), name: row.meta?.name ?? row.contractId,
                    detail: Format.amount(row.standard, of: row, precision: .cut(6))
                )
            }
        case .to:
            return model.tokens.compactMap { info in
                guard let id = info.contractId else { return nil }
                return TokenChoice(id: id, symbol: info.symbol ?? id, name: info.name ?? id, detail: nil)
            }
        }
    }

    private func pick(_ side: Side, _ contractId: String) {
        switch side {
        case .from:
            // Picking the other side's token swaps the two
            if contractId == toId { toId = fromId }
            fromId = contractId
        case .to:
            if contractId == fromId { fromId = toId }
            toId = contractId
        }
    }

    private func flip() {
        guard let to = toId else { return }
        toId = fromId
        fromId = to
        amountText = ""
    }

    /// A fresh route for what's on screen, checked against the vault list, then the review of its call
    private func prepareReview() async {
        guard !preparing, let from = fromRow, let stx = holdings.stx, let to = toInfo, let amount = amountMicro else { return }
        preparing = true
        reviewError = nil
        defer { preparing = false }
        do {
            let route = try await Swap.quote(from: from.contractId, to: to.contractId, amount: amount)
            guard route.path.first?.contractId == from.contractId, route.path.last?.contractId == to.contractId else {
                throw WalletError.unexpected("The route doesn't match the trade on screen")
            }
            review = try await Swap.review(route: route, from: from, amount: amount, stx: stx, account: account, hiro: Hiro())
        } catch {
            reviewError = error
        }
    }
}

/// An amount in a token's whole units: up to 6 decimals, for the Trade screen's displays
func tradeAmount(_ micro: Double, decimals: Int) -> String {
    (micro / pow(10, Double(decimals))).formatted(.number.precision(.fractionLength(0...6)))
}

/// One token the picker offers
struct TokenChoice: Identifiable, Hashable {
    let id: String
    let symbol: String
    let name: String
    /// An amount the wallet holds, when it does
    let detail: String?
}

/// Choose a token: searchable, with the amount held where there is one
private struct TokenPickerSheet: View {
    let title: String
    let choices: [TokenChoice]
    let onPick: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    var body: some View {
        NavigationStack {
            List {
                ForEach(filtered) { choice in
                    Button {
                        onPick(choice.id)
                        dismiss()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(choice.symbol).brandFont(.body, weight: .semibold)
                                Text(choice.name)
                                    .brandFont(.caption)
                                    .foregroundStyle(.brand("ink-muted"))
                                    .lineLimit(1)
                            }
                            Spacer()
                            if let detail = choice.detail {
                                Text(detail).monoFont(.callout)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
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
