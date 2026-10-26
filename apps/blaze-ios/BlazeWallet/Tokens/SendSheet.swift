import StacksKit
import SwiftUI
import WalletCore

/// Sending from the Standard balance: recipient and amount, a review with the real network fee, then the txid
struct SendSheet: View {
    let row: TokenRow
    /// STX's row: its Standard balance pays the fee
    let stx: TokenRow
    let account: Account

    @Environment(Vault.self) private var vault
    @Environment(\.dismiss) private var dismiss
    @State private var recipient = ""
    @State private var amount = ""
    @FocusState private var amountFocused: Bool
    @State private var review: SendReview?
    /// The reviewed send, signed once. Sending again re-sends these same bytes, so a send whose answer was lost can't
    /// go out twice, and from then on this sheet sends nothing else.
    @State private var signed: StacksTransaction?
    @State private var txid: String?
    @State private var busy = false
    @State private var error: Error?
    private let hiro = Hiro()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if let txid { sent(txid) } else if let review { reviewing(review) } else { form }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Color.brand("bg"))
            .safeAreaInset(edge: .bottom) {
                footer
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(Color.brand("bg"))
            }
            .navigationTitle(txid != nil ? "\(Format.symbol(row)) sent" : "Send \(Format.symbol(row))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if txid == nil {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) }
                    ToolbarItemGroup(placement: .keyboard) {
                        Spacer()
                        Button("Done") { amountFocused = false }
                    }
                }
            }
            // A signed send stays on screen until it's sent or the person chooses Cancel
            .interactiveDismissDisabled(busy || (signed != nil && txid == nil))
            // Leaving for Safari would lock the wallet and close this sheet
            .inAppLinks()
        }
    }

    @ViewBuilder private var form: some View {
        SectionHeading("Recipient")
        TextField(text: $recipient, prompt: Text(verbatim: "SP…")) { EmptyView() }
            // Contract names are case-sensitive: capitalizing one changes the address
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .monoFont(.callout)
            .padding(.vertical, 12)
            .overlay(alignment: .bottom) { Hairline(strong: true) }
        SectionHeading("Amount")
        HStack(alignment: .firstTextBaseline) {
            TextField("0" + Amount.decimalMark(.current) + "0 " + Format.symbol(row), text: $amount)
                .focused($amountFocused)
                .keyboardType(.decimalPad)
                .monoFont(size: 28, relativeTo: .title)
            Button("Max") {
                if let meta = row.meta { amount = Amount.editable(max(row.standard, 0), decimals: meta.decimals, locale: .current) }
            }
            .monoFont(.footnote, weight: .medium)
            .foregroundStyle(.brand("accent-text"))
        }
        .padding(.vertical, 8)
        .overlay(alignment: .bottom) { Hairline(strong: true) }
        if row.blaze != 0 {
            Text("Sends use your \(Format.amount(row.standard, of: row, precision: .cut(6))) \(Format.symbol(row)) on Standard. Your \(Format.amount(row.blaze, of: row, precision: .cut(6))) on Blaze stays in its subnet; move it with Charisma Swap.")
                .brandFont(.footnote)
                .foregroundStyle(.brand("ink-muted"))
                .padding(.top, 12)
        }
        if case .notEnoughSTXForFee(_, _, let most?)? = error as? WalletError, most > 0 {
            Button("Send the most: \(Format.stx(most)) STX") {
                amount = Amount.editable(most, decimals: 6, locale: .current)
                error = nil
            }
            .brandFont(.subheadline, weight: .bold)
            .foregroundStyle(.brand("accent-text"))
            .padding(.top, 12)
        }
    }

    @ViewBuilder private func reviewing(_ review: SendReview) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow("Send")
            Text(verbatim: "\(Format.amount(review.amount, of: row, precision: .exact)) \(Format.symbol(row))")
                .monoFont(size: 30, relativeTo: .title)
                .tracking(-0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 20)
        .padding(.bottom, 14)
        DetailRow(label: "To") {
            Text(verbatim: review.recipient.description).monoFont(.caption)
        }
        DetailRow(label: "Network fee") {
            Text(verbatim: "\(Format.stx(review.fee)) STX").monoFont(.subheadline)
        }
        if !row.isSTX {
            DetailRow(label: "Safety") {
                Text("Exactly this amount, nothing else").brandFont(.subheadline, weight: .semibold).foregroundStyle(.brand("success"))
            }
        }
        if let signed, error != nil {
            // It may be on the network even though no answer came back: the explorer shows whether it is
            VStack(alignment: .leading, spacing: 8) {
                Text("It may have gone through already. Check the explorer before you send again.")
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
            ErrorText(error: error, row: row)
            if txid != nil {
                Button("Done") { dismiss() }.buttonStyle(PrimaryButtonStyle())
            } else if let review {
                Button {
                    Task { await send(review) }
                } label: {
                    if busy { ProgressView().tint(.white) } else { Text("Send") }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(busy)
                if signed == nil {
                    Button("Back") {
                        error = nil
                        self.review = nil
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .disabled(busy)
                }
            } else {
                Button {
                    Task { await check() }
                } label: {
                    if busy { ProgressView().tint(.white) } else { Text("Review") }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(busy || recipient.isEmpty || amount.isEmpty)
            }
        }
    }

    private func check() async {
        // A second tap before the first one's state reaches the screen
        guard !busy else { return }
        error = nil
        busy = true
        defer { busy = false }
        do {
            review = try await Send.review(
                row: row, recipient: recipient, amount: amount, locale: .current, stx: stx,
                account: account, hiro: hiro
            )
        } catch {
            self.error = error
        }
    }

    private static func isRefusal(_ error: Error) -> Bool {
        if case .rejected = error as? WalletError { return true }
        return false
    }

    private func send(_ review: SendReview) async {
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
                transaction = try await Send.sign(review, from: account, hiro: hiro)
                signed = transaction
            }
            // Signing waits on the network: if the wallet locked meanwhile, nothing goes out
            try vault.touch()
            txid = try await Send.broadcast(transaction, hiro: hiro)
            // Only this send's own warning: another account's unclear send still needs checking
            if vault.unsent?.transaction == transaction { vault.unsent = nil }
        } catch {
            // Signed but not clearly sent: kept outside this sheet, so a lock can't lose it, and Tokens says so. A refusal
            // is clear (the network didn't take it), so it isn't one; an earlier unclear attempt's warning stays.
            if let signed, !Self.isRefusal(error) { vault.unsent = .init(transaction: signed, address: account.stxAddress) }
            self.error = error
        }
    }
}
