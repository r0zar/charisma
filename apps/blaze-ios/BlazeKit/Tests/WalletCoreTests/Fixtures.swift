import Foundation

@testable import WalletCore

/// Public BIP39 test phrases: never send funds to their addresses
enum TestPhrase {
    static let twelve = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    static let twentyFour = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"
    /// Account 0 and 1 of `twelve`, as @stacks/wallet-sdk derives them (StacksKit's vectors)
    static let account0 = "SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J"
    static let account1 = "SP3XHES5990FYDV5BHBZCJRFYFD2Z4X3FMD2N3MGH"
}

/// A clock tests move by hand
final class TestClock: @unchecked Sendable {
    var now = Date(timeIntervalSince1970: 1_800_000_000)
    func advance(minutes: Double) { now = now.addingTimeInterval(minutes * 60) }
}
