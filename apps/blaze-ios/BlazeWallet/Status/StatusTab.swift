import SwiftUI
import WalletCore

/// Is everything working? The Stacks network, Charisma's token list, every Blaze subnet, and the auto-lock timer
struct StatusTab: View {
    let account: Account

    @Environment(Vault.self) private var vault
    /// MainView keeps it for the whole unlock
    let model: StatusModel

    private static let interval: TimeInterval = 5 * 60

    /// Only this account's checks: another account's are never shown here
    private var diagnostics: Diagnostics? { model.address == account.stxAddress ? model.diagnostics : nil }

    init(account: Account, model: StatusModel) {
        self.account = account
        self.model = model
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        if let checkedAt = diagnostics?.checkedAt {
                            Text("Checked at \(checkedAt.formatted(date: .omitted, time: .shortened))")
                        } else if model.checking {
                            Text("Checking…")
                        }
                        Spacer()
                        Button {
                            Task { await model.check(address: account.stxAddress) }
                        } label: {
                            if model.checking { ProgressView() } else { Label("Check again", systemImage: "arrow.clockwise") }
                        }
                        .disabled(model.checking)
                    }
                    .brandFont(.footnote)
                    .foregroundStyle(.brand("ink-muted"))
                }
                if let error = model.error {
                    Section("Something isn't working") { ErrorText(error: error) }
                }
                networkSection
                tokenListSection
                subnetsSection
                walletSection
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle("Status")
            .toolbar { LockButton() }
            .task {
                // Each check is ~38 Hiro reads: once per unlock and every 5 minutes while open, not on every visit
                while !Task.isCancelled {
                    // Five minutes from the last attempt, failed or not: offline or rate-limited, it never spins
                    if model.attemptedFor == account.stxAddress, let attemptedAt = model.attemptedAt,
                       -attemptedAt.timeIntervalSinceNow < Self.interval {
                        guard (try? await Task.sleep(for: .seconds(Self.interval + attemptedAt.timeIntervalSinceNow))) != nil else { return }
                        // "Check again" may have run meanwhile: measure from the latest attempt
                        continue
                    }
                    if model.checking {
                        // "Check again" is running, maybe for the account shown before: look again in a moment
                        guard (try? await Task.sleep(for: .seconds(1))) != nil else { return }
                        continue
                    }
                    await model.check(address: account.stxAddress)
                }
            }
        }
    }

    /// The network's state; nothing before the first check has started
    private var state: (text: LocalizedStringKey, tone: String)? {
        if model.error != nil { return ("Error", "danger") }
        if diagnostics != nil { return ("Live", "success") }
        return model.checking ? ("Checking", "warning") : nil
    }

    @ViewBuilder private var networkSection: some View {
        Section {
            LabeledContent { Text(diagnostics.map { $0.blockHeight.formatted() } ?? "—").monoFont(.body) } label: { Text("Block") }
            if let diagnostics = diagnostics { Speed(latency: diagnostics.networkLatency) }
        } header: {
            HStack {
                Text("Stacks network")
                Spacer()
                if let state { Text(state.text).foregroundStyle(.brand(state.tone)) }
            }
        }
    }

    @ViewBuilder private var tokenListSection: some View {
        Section("Charisma token list") {
            LabeledContent { Text(diagnostics.map { $0.tokenCount.formatted() } ?? "—").monoFont(.body) } label: { Text("Tokens") }
            if let diagnostics = diagnostics { Speed(latency: diagnostics.tokenListLatency) }
        }
    }

    @ViewBuilder private var subnetsSection: some View {
        let held: [SubnetBalance] = (diagnostics?.subnets ?? []).filter { ($0.balance ?? 0) != 0 }
        Section {
            LabeledContent { Text(diagnostics == nil ? "—" : held.count.formatted()).monoFont(.body) } label: { Text("Holding your funds") }
            if let diagnostics = diagnostics {
                if held.isEmpty {
                    Text("No funds on any of the \(diagnostics.subnets.count) subnets.").foregroundStyle(.brand("ink-muted"))
                }
                ForEach(held) { subnet in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(subnet.symbol).brandFont(.body, weight: .semibold)
                            Text(subnet.contractId.split(separator: ".").last.map(String.init) ?? subnet.contractId)
                                .brandFont(.caption).foregroundStyle(.brand("ink-muted"))
                        }
                        Spacer()
                        Text(Amount.format(subnet.balance ?? 0, decimals: subnet.decimals, precision: .rounded(4), locale: .current)).monoFont(.body)
                    }
                }
            }
        } header: {
            HStack {
                Text("Blaze subnets")
                Spacer()
                if let count = diagnostics?.subnets.count { Text(count.formatted()) }
            }
        }
    }

    @ViewBuilder private var walletSection: some View {
        Section("This wallet") {
            LabeledContent { Text(Format.short(account.stxAddress)).monoFont(.body) } label: { Text("Address") }
            TimelineView(.periodic(from: .now, by: 30)) { context in
                let minutes = vault.locksAt.map { max(0, Int(($0.timeIntervalSince(context.date) / 60).rounded(.up))) }
                VStack(alignment: .leading, spacing: 6) {
                    LabeledContent {
                        if let minutes { Text("In \(minutes) min") } else { Text(verbatim: "—") }
                    } label: { Text("Auto-lock") }
                    if let minutes { ProgressView(value: Double(minutes), total: 15) }
                }
            }
        }
    }
}

/// How fast a server answered: instant is a full bar, 2 seconds or slower an empty one
private struct Speed: View {
    let latency: Duration

    var body: some View {
        let ms = Int(latency / .milliseconds(1))
        let tone = ms < 600 ? "success" : ms < 1500 ? "warning" : "danger"
        VStack(alignment: .leading, spacing: 6) {
            LabeledContent { Text(verbatim: "\(ms.formatted()) ms").monoFont(.body).foregroundStyle(.brand(tone)) } label: { Text("Response") }
            ProgressView(value: max(4, min(100, 100 - Double(ms) / 20)), total: 100).tint(.brand(tone))
        }
    }
}
