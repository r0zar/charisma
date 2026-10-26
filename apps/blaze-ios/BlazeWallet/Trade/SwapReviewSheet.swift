import StacksKit
import SwiftUI
import WalletCore

/// A swap ready to sign: what it sends, the least it may return, the route, and the network fee. It's signed once. A
/// broadcast that gets no answer is retried with the same transaction, never a new signature, as sends are.
struct SwapReviewSheet: View {
    let review: Swap.Review
    let from: TokenRow
    let to: TokenInfo
    /// STX's row: its Standard balance pays the network fee
    let stx: TokenRow
    let account: Account

    @Environment(Vault.self) private var vault
    @Environment(\.dismiss) private var dismiss
    @State private var signed: StacksTransaction?
    @State private var txid: String?
    @State private var busy = false
    @State private var error: Error?
    private let hiro = Hiro()

    private var toSymbol: String { to.symbol ?? to.contractId ?? "—" }

    var body: some View {
        NavigationStack {
            Form {
                if let txid { sent(txid) } else { reviewing }
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle(txid != nil ? "Swap sent" : "Review swap")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if txid == nil {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) }
                }
            }
            // A signed swap stays on screen until it's sent or the person chooses Cancel
            .interactiveDismissDisabled(busy || (signed != nil && txid == nil))
            .inAppLinks()
        }
    }

    @ViewBuilder private var reviewing: some View {
        Section {
            LabeledContent {
                Text(verbatim: "\(Format.amount(Int128(review.amountIn), of: from, precision: .exact)) \(Format.symbol(from))")
                    .monoFont(.body)
            } label: { Text("You send") }
            LabeledContent {
                Text(verbatim: "\(tradeAmount(review.route.amountOut, decimals: to.decimals ?? 6)) \(toSymbol)")
                    .monoFont(.body)
            } label: { Text("You get about") }
            LabeledContent {
                Text(verbatim: "\(tradeAmount(Double(review.minimumOut), decimals: to.decimals ?? 6)) \(toSymbol)")
                    .monoFont(.body)
            } label: { Text("At least") }
            LabeledContent {
                Text(review.route.path.map { $0.symbol ?? $0.contractId }.joined(separator: " → "))
                    .monoFont(.caption)
                    .multilineTextAlignment(.trailing)
            } label: { Text("Route") }
            LabeledContent { Text(verbatim: "\(Format.stx(Int128(review.fee))) STX").monoFont(.body) } label: { Text("Network fee") }
            LabeledContent { Text("Every pool is on Charisma's vault list").foregroundStyle(.brand("success")) } label: { Text("Safety") }
        }
        Section {
            ErrorText(error: error, row: from)
            Button {
                Task { await send() }
            } label: {
                if busy { ProgressView() } else { Text("Swap") }
            }
            .disabled(busy)
            if signed != nil, error != nil {
                // It may be on the network even though no answer came back: the explorer shows whether it is
                Text("It may have gone through already. Check the explorer before you swap again.")
                    .brandFont(.footnote)
                    .foregroundStyle(.brand("ink-muted"))
                if let signed {
                    Link(destination: Format.explorer(signed.txid)) {
                        Label("View on explorer", systemImage: "arrow.up.right.square")
                    }
                }
            }
        }
    }

    @ViewBuilder private func sent(_ txid: String) -> some View {
        Section {
            Text("It confirms on Stacks in a few minutes.")
            Link(destination: Format.explorer(txid)) {
                Label("View on explorer", systemImage: "arrow.up.right.square")
            }
        }
        Section {
            Button("Done") { dismiss() }
        }
    }

    private func send() async {
        guard !busy else { return }
        error = nil
        busy = true
        defer { busy = false }
        do {
            try vault.touch()
            let transaction: StacksTransaction
            if let signed {
                transaction = signed
            } else {
                transaction = try await Swap.sign(review, from: account, hiro: hiro)
                signed = transaction
            }
            // Signing waits on the network: if the wallet locked meanwhile, nothing goes out
            try vault.touch()
            txid = try await Swap.broadcast(transaction, hiro: hiro)
            // Only this swap's own warning: another account's unclear send still needs checking
            if vault.unsent?.transaction == transaction { vault.unsent = nil }
        } catch {
            // Signed but not clearly sent: kept outside this sheet, so a lock can't lose it. A refusal is clear.
            if let signed, !Self.isRefusal(error) { vault.unsent = .init(transaction: signed, address: account.stxAddress) }
            self.error = error
        }
    }

    private static func isRefusal(_ error: Error) -> Bool {
        if case .rejected = error as? WalletError { return true }
        return false
    }
}
