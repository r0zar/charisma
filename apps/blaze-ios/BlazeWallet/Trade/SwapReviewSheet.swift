import StacksKit
import SwiftUI
import WalletCore

/// A swap ready to sign: what it sends, what it gets and the least it may return, the route, the networks and the
/// network fee. It's signed once. A broadcast that gets no answer is retried with the same transaction, never a new
/// signature, as sends are.
struct SwapReviewSheet: View {
    let review: Swap.Review
    let from: TokenRow
    let to: TokenInfo
    /// Whether the swap lands on Blaze: a deposit into the subnet, on the route's last hop
    let toBlaze: Bool
    /// STX's row: its Standard balance pays the network fee
    let stx: TokenRow
    let account: Account
    /// The same token from Standard to Blaze: the button says Upgrade
    var isUpgrade = false

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
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if let txid { sent(txid) } else { reviewing }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
            }
            .background(Color.brand("bg"))
            .safeAreaInset(edge: .bottom) {
                footer
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(Color.brand("bg"))
            }
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
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow("You send")
                Text(verbatim: "\(Format.amount(Int128(review.amountIn), of: from, precision: .exact)) \(Format.symbol(from))")
                    .monoFont(size: 30, relativeTo: .title)
                    .tracking(-0.8)
            }
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow("You get about")
                Text(verbatim: "\(tradeAmount(review.route.amountOut, decimals: to.decimals ?? 6)) \(toSymbol)")
                    .monoFont(size: 30, relativeTo: .title)
                    .tracking(-0.8)
                    .foregroundStyle(toBlaze ? AnyShapeStyle(Theme.blazeText) : AnyShapeStyle(Color.brand("ink")))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 20)
        .padding(.bottom, 14)
        DetailRow(label: "At least") {
            Text(verbatim: "\(tradeAmount(Double(review.minimumOut), decimals: to.decimals ?? 6)) \(toSymbol)").monoFont(.subheadline)
        }
        DetailRow(label: "Route") {
            Text(verbatim: review.route.path.filter { !BlazeOrder.subnets.contains($0.contractId) }.map { $0.symbol ?? $0.contractId }.joined(separator: " → "))
                .monoFont(.footnote)
        }
        DetailRow(label: "Networks") {
            HStack(spacing: 4) {
                Text("Standard")
                Text(verbatim: "→")
                if toBlaze { Text("Blaze").foregroundStyle(Theme.blazeText) } else { Text("Standard") }
            }
            .brandFont(.subheadline, weight: .semibold)
        }
        DetailRow(label: "Network fee") {
            Text(verbatim: "\(Format.stx(Int128(review.fee))) STX").monoFont(.subheadline)
        }
        DetailRow(label: "Safety") {
            Text("Every pool is on Charisma's vault list").brandFont(.subheadline, weight: .semibold).foregroundStyle(.brand("success"))
        }
        if let signed, error != nil {
            // It may be on the network even though no answer came back: the explorer shows whether it is
            VStack(alignment: .leading, spacing: 8) {
                Text("It may have gone through already. Check the explorer before you swap again.")
                    .brandFont(.footnote)
                    .foregroundStyle(.brand("warning"))
                Link(destination: Format.explorer(signed.txid)) {
                    Label("View on explorer", systemImage: "arrow.up.right")
                }
                .brandFont(.subheadline, weight: .bold)
                .foregroundStyle(.brand("accent-text"))
            }
            .padding(.top, 16)
        }
    }

    @ViewBuilder private func sent(_ txid: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 40)).foregroundStyle(.brand("success"))
            Text("It confirms on Stacks in a few minutes.").brandFont(.body)
            Link(destination: Format.explorer(txid)) {
                Label("View on explorer", systemImage: "arrow.up.right")
            }
            .brandFont(.subheadline, weight: .bold)
            .foregroundStyle(.brand("accent-text"))
        }
        .padding(.top, 28)
    }

    @ViewBuilder private var footer: some View {
        VStack(spacing: 10) {
            ErrorText(error: error, row: from)
            if txid != nil {
                Button("Done") { dismiss() }.buttonStyle(PrimaryButtonStyle())
            } else {
                Button {
                    Task { await send() }
                } label: {
                    if busy {
                        ProgressView().tint(.white)
                    } else if isUpgrade {
                        Text("Upgrade")
                    } else {
                        Text("Swap")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(busy)
            }
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
