import Foundation
import StacksKit
import Testing
@testable import WalletCore

/// Status's checks against the real servers. Opt in: BLAZE_LIVE=1 swift test --filter LiveDiagnosticsTests
@Suite(.enabled(if: ProcessInfo.processInfo.environment["BLAZE_LIVE"] == "1"), .timeLimit(.minutes(2)))
struct LiveDiagnosticsTests {
    @Test func statusChecksEverything() async throws {
        let hiro = Hiro()
        let deployer = try StacksAddress("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS")
        let reader = SubnetReader(hiro: hiro)
        let diagnostics = try await Diagnostics.check(address: deployer, charisma: Charisma(), hiro: hiro, subnets: reader)
        #expect(diagnostics.blockHeight > 0 && diagnostics.tokenCount > 0)
        #expect(diagnostics.subnets.count >= 30)
        #expect(diagnostics.subnets.contains { ($0.balance ?? 0) > 0 })
        // A second look within a minute is the kept answer: read again, an empty list would give no subnets at all
        #expect(try await reader.balances(of: deployer, list: []) == diagnostics.subnets)
    }
}
