import StacksKit
import SwiftUI
import WalletCore

/// A Blaze order ready to place: what it spends, what it pays out, and the route it's quoted on
struct BlazeOrderReview: Identifiable {
    let id = UUID()
    let route: Swap.Route
    let from: TokenRow
    let to: TokenInfo
    /// Smallest units of the input
    let amount: UInt64
    /// The Blaze subnet the order spends
    let subnet: String
    /// The token the order pays out: the base token, or the output's Blaze subnet
    let outputToken: String
    /// Whether the output lands on Blaze
    let toBlaze: Bool
    /// The same token from Blaze to Standard: the button says Downgrade
    var isDowngrade = false
}

/// A Blaze order: what it spends and pays out, and the route it's quoted on. Placing it signs it and hands it to
/// Charisma's order service, which a solver fills about a minute later. An order has no network fee.
struct BlazeOrderReviewSheet: View {
    let review: BlazeOrderReview
    let account: Account

    @Environment(Vault.self) private var vault
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var placed = false
    @State private var error: Error?

    private var toSymbol: String { review.to.symbol ?? review.to.contractId ?? "—" }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if placed { placedView } else { reviewing }
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
            .navigationTitle(placed ? "Order placed" : "Review order")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !placed {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) }
                }
            }
            .interactiveDismissDisabled(busy)
            .inAppLinks()
        }
    }

    @ViewBuilder private var reviewing: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow("You send")
                Text(verbatim: "\(Format.amount(Int128(review.amount), of: review.from, precision: .exact)) \(Format.symbol(review.from))")
                    .monoFont(size: 30, relativeTo: .title)
                    .tracking(-0.8)
            }
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow("You get about")
                Text(verbatim: "\(tradeAmount(review.route.amountOut, decimals: review.to.decimals ?? 6)) \(toSymbol)")
                    .monoFont(size: 30, relativeTo: .title)
                    .tracking(-0.8)
                    .foregroundStyle(review.toBlaze ? AnyShapeStyle(Theme.blazeText) : AnyShapeStyle(Color.brand("ink")))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 20)
        .padding(.bottom, 14)
        DetailRow(label: "Route") {
            Text(verbatim: review.route.path.filter { !BlazeOrder.subnets.contains($0.contractId) }.map { $0.symbol ?? $0.contractId }.joined(separator: " → "))
                .monoFont(.footnote)
        }
        DetailRow(label: "Networks") {
            HStack(spacing: 4) {
                Text("Blaze").foregroundStyle(Theme.blazeText)
                Text(verbatim: "→")
                if review.toBlaze { Text("Blaze").foregroundStyle(Theme.blazeText) } else { Text("Standard") }
            }
            .brandFont(.subheadline, weight: .semibold)
        }
        DetailRow(label: "Network fee") {
            Text("None").brandFont(.subheadline, weight: .semibold)
        }
        DetailRow(label: "Safety") {
            Text("No minimum: the price can move before a solver fills it").brandFont(.subheadline)
        }
    }

    private var placedView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 40)).foregroundStyle(.brand("success"))
            Text("A solver fills it in about a minute.").brandFont(.body)
        }
        .padding(.top, 28)
    }

    @ViewBuilder private var footer: some View {
        VStack(spacing: 10) {
            ErrorText(error: error)
            if placed {
                Button("Done") { dismiss() }.buttonStyle(PrimaryButtonStyle())
            } else {
                Button {
                    Task { await place() }
                } label: {
                    if busy {
                        ProgressView().tint(.white)
                    } else if review.isDowngrade {
                        Text("Downgrade")
                    } else {
                        Text("Place order")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(busy)
            }
        }
    }

    private func place() async {
        guard !busy else { return }
        error = nil
        busy = true
        defer { busy = false }
        do {
            try vault.touch()
            _ = try await BlazeOrder.place(subnet: review.subnet, outputToken: review.outputToken, amount: review.amount, from: account)
            placed = true
        } catch {
            self.error = error
        }
    }
}
