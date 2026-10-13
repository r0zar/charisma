import Foundation

/// The unlocked wallet, and the rule that locks it: 15 minutes after the last thing the person did. Reads never
/// count, so a screen left open can't keep the wallet unlocked (as the extension's vault).
public struct Session: Sendable {
    public static let idleLimit: TimeInterval = 15 * 60

    private var state: WalletState?
    private var lastAction: Date
    private let now: @Sendable () -> Date

    public init(state: WalletState, now: @escaping @Sendable () -> Date = { Date() }) {
        self.state = state
        self.now = now
        self.lastAction = now()
    }

    /// True once locked by hand or by the idle limit
    public var isLocked: Bool { state == nil || now() >= lastAction.addingTimeInterval(Self.idleLimit) }

    /// When the wallet locks if nothing else happens; nil once locked
    public var locksAt: Date? { isLocked ? nil : lastAction.addingTimeInterval(Self.idleLimit) }

    /// The wallet as it is. Doesn't restart the 15 minutes, and changes nothing.
    public func read() throws -> WalletState {
        guard !isLocked, let state else { throw WalletError.locked }
        return state
    }

    /// Changes the wallet and restarts the 15 minutes. Returns what `change` returns.
    @discardableResult
    public mutating func act<T>(_ change: (inout WalletState) throws -> T) throws -> T {
        expireIfIdle()
        guard var current = state else { throw WalletError.locked }
        let result = try change(&current)
        state = current
        lastAction = now()
        return result
    }

    /// Counts as activity without changing anything (a send)
    public mutating func touch() throws {
        try act { _ in }
    }

    /// Forgets the wallet until the next unlock
    public mutating func lock() {
        state = nil
    }

    private mutating func expireIfIdle() {
        if isLocked { lock() }
    }
}
