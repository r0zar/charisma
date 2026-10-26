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
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                if let error = model.error {
                    heading("Something isn't working") { EmptyView() }
                    ErrorText(error: error).padding(.vertical, 8)
                }
                networkSection
                tokenListSection
                subnetsSection
                walletSection
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .background(Color.brand("bg"))
        .ledgerTabBar()
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

    /// When it was checked, Check again, and Lock
    private var header: some View {
        HStack(spacing: 12) {
            Group {
                if let checkedAt = diagnostics?.checkedAt {
                    Text("Checked at \(checkedAt.formatted(date: .omitted, time: .shortened))")
                } else if model.checking {
                    Text("Checking…")
                }
            }
            .monoFont(.caption)
            .foregroundStyle(.brand("ink-muted"))
            Spacer()
            Button {
                Task { await model.check(address: account.stxAddress) }
            } label: {
                if model.checking { ProgressView() } else { Label("Check again", systemImage: "arrow.clockwise") }
            }
            .brandFont(.subheadline, weight: .bold)
            .foregroundStyle(.brand("accent-text"))
            .disabled(model.checking)
            IconButton(systemImage: "lock", label: "Lock") { vault.lock() }
                .padding(.trailing, -8)
        }
        .padding(.top, 8)
    }

    /// The network's state; nothing before the first check has started
    private var state: (text: LocalizedStringKey, tone: String)? {
        if model.error != nil { return ("Error", "danger") }
        if diagnostics != nil { return ("Live", "success") }
        return model.checking ? ("Checking", "warning") : nil
    }

    private func heading<Trailing: View>(_ title: LocalizedStringKey, @ViewBuilder trailing: () -> Trailing) -> some View {
        HStack(alignment: .lastTextBaseline) {
            Eyebrow(title)
            Spacer()
            trailing()
        }
        .padding(.top, 26)
        .padding(.bottom, 4)
    }

    @ViewBuilder private var networkSection: some View {
        heading("Stacks network") {
            if let state { Text(state.text).monoFont(.caption, weight: .medium).foregroundStyle(.brand(state.tone)) }
        }
        DetailRow(label: "Block") {
            Text(verbatim: diagnostics.map { $0.blockHeight.formatted() } ?? "—").monoFont(.subheadline)
        }
        if let diagnostics { Speed(latency: diagnostics.networkLatency) }
    }

    @ViewBuilder private var tokenListSection: some View {
        heading("Charisma token list") { EmptyView() }
        DetailRow(label: "Tokens") {
            Text(verbatim: diagnostics.map { $0.tokenCount.formatted() } ?? "—").monoFont(.subheadline)
        }
        if let diagnostics { Speed(latency: diagnostics.tokenListLatency) }
    }

    @ViewBuilder private var subnetsSection: some View {
        let held: [SubnetBalance] = (diagnostics?.subnets ?? []).filter { ($0.balance ?? 0) != 0 }
        heading("Blaze subnets") {
            if let count = diagnostics?.subnets.count { Text(verbatim: count.formatted()).monoFont(.caption).foregroundStyle(.brand("ink-muted")) }
        }
        DetailRow(label: "Holding your funds") {
            Text(verbatim: diagnostics == nil ? "—" : held.count.formatted()).monoFont(.subheadline)
        }
        if let diagnostics {
            if held.isEmpty {
                Text("No funds on any of the \(diagnostics.subnets.count) subnets.")
                    .brandFont(.footnote)
                    .foregroundStyle(.brand("ink-muted"))
                    .padding(.vertical, 12)
            }
            ForEach(held) { subnet in
                HStack(spacing: 10) {
                    Image(systemName: "flame.fill").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.blaze)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(verbatim: subnet.symbol).brandFont(.callout, weight: .bold)
                        Text(verbatim: subnet.contractId.split(separator: ".").last.map(String.init) ?? subnet.contractId)
                            .monoFont(.caption)
                            .foregroundStyle(.brand("ink-muted"))
                    }
                    Spacer()
                    Text(verbatim: Amount.format(subnet.balance ?? 0, decimals: subnet.decimals, precision: .rounded(4), locale: .current))
                        .monoFont(.subheadline)
                }
                .padding(.vertical, 10)
                .overlay(alignment: .bottom) { Hairline() }
            }
        }
    }

    @ViewBuilder private var walletSection: some View {
        heading("This wallet") { EmptyView() }
        DetailRow(label: "Address") {
            Text(verbatim: Format.short(account.stxAddress)).monoFont(.subheadline)
        }
        TimelineView(.periodic(from: .now, by: 30)) { context in
            let minutes = vault.locksAt.map { max(0, Int(($0.timeIntervalSince(context.date) / 60).rounded(.up))) }
            VStack(spacing: 0) {
                DetailRow(label: "Auto-lock") {
                    Group {
                        if let minutes { Text("In \(minutes) min") } else { Text(verbatim: "—") }
                    }
                    .monoFont(.subheadline)
                }
                if let minutes {
                    ProgressView(value: Double(minutes), total: 15)
                        .tint(Color.brand("accent-text"))
                        .padding(.vertical, 10)
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
        VStack(spacing: 0) {
            DetailRow(label: "Response") {
                Text(verbatim: "\(ms.formatted()) ms").monoFont(.subheadline).foregroundStyle(.brand(tone))
            }
            ProgressView(value: max(4, min(100, 100 - Double(ms) / 20)), total: 100)
                .tint(.brand(tone))
                .padding(.vertical, 10)
        }
    }
}
