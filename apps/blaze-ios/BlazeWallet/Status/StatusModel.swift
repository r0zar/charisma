import Foundation
import Observation
import StacksKit
import WalletCore

/// Status's checks, refreshed when the tab appears and every 5 minutes while it's on screen
@MainActor @Observable
final class StatusModel {
    private(set) var diagnostics: Diagnostics?
    /// The address `diagnostics` is for: switching accounts checks again at once
    private(set) var address: String?
    /// When the last check started, and for which address, failed or not: the next one waits 5 minutes from here
    private(set) var attemptedAt: Date?
    private(set) var attemptedFor: String?
    private(set) var error: Error?
    private(set) var checking = false

    private let charisma = Charisma()
    private let hiro = Hiro()
    private let subnets: SubnetReader

    init() {
        subnets = SubnetReader(hiro: hiro)
    }

    /// One check at a time: does nothing while one is running
    func check(address: String) async {
        guard !checking else { return }
        attemptedAt = Date()
        attemptedFor = address
        error = nil
        checking = true
        defer { checking = false }
        do {
            diagnostics = try await Diagnostics.check(address: StacksAddress(address), charisma: charisma, hiro: hiro, subnets: subnets)
            self.address = address
        } catch is CancellationError {
            // The tab went away mid-check: not an attempt, so coming back checks at once
            attemptedAt = nil
        } catch {
            self.error = error
        }
    }
}
