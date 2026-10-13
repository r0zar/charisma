import Foundation

/// Charisma's token data, kept for the whole app: the list for as long as the service's own Cache-Control allows, and
/// each token's details once per session, four lookups at a time. Asking again on every unlock and tab reads like a
/// bot to Vercel's protection in front of the service, which then answers the app with 403 for minutes.
actor TokenCache {
    private var kept: (list: [TokenInfo], at: Date)?
    private var loading: Task<[TokenInfo], any Error>?
    private var found: [String: TokenInfo] = [:]
    /// The service said these don't exist, or sent details that can't be read: shown as unknown until the app starts
    /// again. A lookup that failed for a passing reason (offline, a 403 from Vercel's protection) is tried again.
    private var failed: Set<String> = []
    private let now: @Sendable () -> Date

    init(now: @escaping @Sendable () -> Date = { Date() }) {
        self.now = now
    }

    /// The list, if it was loaded less than `maxAge` seconds ago, otherwise loaded now. Callers asking while it loads
    /// share that one request. A load that fails is the error: an older list is never given instead.
    func list(maxAge: TimeInterval, load: @escaping @Sendable () async throws -> [TokenInfo]) async throws -> [TokenInfo] {
        if let kept, now().timeIntervalSince(kept.at) < maxAge { return kept.list }
        if let loading { return try await loading.value }
        let task = Task { try await load() }
        loading = task
        defer { loading = nil }
        let list = try await task.value
        kept = (list, now())
        return list
    }

    /// Details for these tokens. Each is looked up once per session, four at a time; one that fails is logged and left
    /// out, so that token shows as unknown (the extension's rule). Only cancellation throws.
    func details(of ids: [String], lookUp: @escaping @Sendable (String) async throws -> TokenInfo) async throws -> [String: TokenInfo] {
        let new = Array(Set(ids).subtracting(found.keys).subtracting(failed)).sorted()
        for start in stride(from: 0, to: new.count, by: 4) {
            let batch = new[start..<min(start + 4, new.count)]
            let results = try await withThrowingTaskGroup(of: (String, TokenInfo?, Bool).self) { group in
                for id in batch {
                    group.addTask {
                        do {
                            return (id, try await lookUp(id), false)
                        } catch is CancellationError {
                            // The screen went away: not a failed lookup
                            throw CancellationError()
                        } catch {
                            Log.balances.error("Couldn't look up \(id, privacy: .public): \(error, privacy: .public)")
                            return (id, nil, Self.isFinal(error))
                        }
                    }
                }
                var results: [(String, TokenInfo?, Bool)] = []
                for try await result in group { results.append(result) }
                return results
            }
            for (id, info, final) in results {
                if let info { found[id] = info } else if final { failed.insert(id) }
            }
        }
        let asked = Set(ids)
        return found.filter { asked.contains($0.key) }
    }

    /// The service's own answer that there's nothing to show: no such token (404), or details that can't be read
    private static func isFinal(_ error: any Error) -> Bool {
        switch error as? WalletError {
        case .requestFailed(_, status: 404)?, .unreadable?: true
        default: false
        }
    }
}
