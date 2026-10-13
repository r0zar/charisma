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
            Form {
                if let txid { sent(txid) } else if let review { reviewing(review) } else { form }
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle(txid != nil ? "\(Format.symbol(row)) sent" : "Send \(Format.symbol(row))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if txid == nil {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) }
                }
            }
            // A signed send stays on screen until it's sent or the person chooses Cancel
            .interactiveDismissDisabled(busy || (signed != nil && txid == nil))
            // Leaving for Safari would lock the wallet and close this sheet
            .inAppLinks()
        }
    }

    @ViewBuilder private var form: some View {
        Section("Recipient") {
            TextField(text: $recipient, prompt: Text(verbatim: "SP…")) { EmptyView() }
                // Contract names are case-sensitive: capitalizing one changes the address
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .monoFont(.callout)
        }
        Section("Amount") {
            HStack {
                TextField("0" + Amount.decimalMark(.current) + "0 " + Format.symbol(row), text: $amount)
                    .keyboardType(.decimalPad)
                    .monoFont(.body)
                Button("Max") {
                    if let meta = row.meta { amount = Amount.editable(max(row.standard, 0), decimals: meta.decimals, locale: .current) }
                }
                .buttonStyle(.bordered)
            }
            if row.blaze != 0 {
                Text("Sends use your \(Format.amount(row.standard, of: row, precision: .cut(6))) \(Format.symbol(row)) on Standard. Your \(Format.amount(row.blaze, of: row, precision: .cut(6))) on Blaze stays in its subnet; move it with Charisma Swap.")
                    .brandFont(.footnote)
                    .foregroundStyle(.brand("ink-muted"))
            }
        }
        Section {
            ErrorText(error: error, row: row)
            if case .notEnoughSTXForFee(_, _, let most?)? = error as? WalletError, most > 0 {
                Button("Send the most: \(Format.stx(most)) STX") {
                    amount = Amount.editable(most, decimals: 6, locale: .current)
                    error = nil
                }
            }
            Button {
                Task { await check() }
            } label: {
                if busy { ProgressView() } else { Text("Review") }
            }
            .disabled(busy || recipient.isEmpty || amount.isEmpty)
        }
    }

    @ViewBuilder private func reviewing(_ review: SendReview) -> some View {
        Section {
            LabeledContent { Text(verbatim: "\(Format.amount(review.amount, of: row, precision: .exact)) \(Format.symbol(row))").monoFont(.body) } label: { Text("Send") }
            LabeledContent { Text(review.recipient.description).monoFont(.caption).multilineTextAlignment(.trailing) } label: { Text("To") }
            LabeledContent { Text(verbatim: "\(Format.stx(review.fee)) STX").monoFont(.body) } label: { Text("Network fee") }
            if !row.isSTX {
                LabeledContent { Text("Exactly this amount, nothing else").foregroundStyle(.brand("success")) } label: { Text("Safety") }
            }
        }
        Section {
            ErrorText(error: error, row: row)
            Button {
                Task { await send(review) }
            } label: {
                if busy { ProgressView() } else { Text("Send") }
            }
            .disabled(busy)
            if let signed {
                // It may be on the network even though no answer came back: the explorer shows whether it is
                if error != nil {
                    Text("It may have gone through already. Check the explorer before you send again.")
                        .brandFont(.footnote)
                        .foregroundStyle(.brand("ink-muted"))
                    Link(destination: Format.explorer(signed.txid)) {
                        Label("View on explorer", systemImage: "arrow.up.right.square")
                    }
                }
            } else {
                Button("Back") {
                    error = nil
                    self.review = nil
                }
                .disabled(busy)
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
