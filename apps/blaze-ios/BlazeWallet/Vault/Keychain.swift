import Foundation
import LocalAuthentication
import Security

/// Why the vault couldn't do something
enum VaultError: Error, Equatable {
    case passcodeNotSet
    case authenticationUnavailable
    /// The person dismissed Face ID or the passcode: not an error to show
    case cancelled
    case keychain(OSStatus)
    /// The saved wallet isn't a wallet this app can read
    case unreadable
}

/// The one Keychain item that holds the wallet. Reading it takes Face ID or the passcode (`.userPresence`); it stays
/// on this iPhone (`WhenPasscodeSetThisDeviceOnly`), so it's never in backups and never moves to another device.
enum Keychain {
    private static func item(_ account: String = "wallet") -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "rocks.charisma.blazewallet",
            kSecAttrAccount as String: account,
        ]
    }

    /// Creates the item. `context` has already passed Face ID, so later reads and writes don't ask again.
    static func add(_ data: Data, context: LAContext) throws {
        guard let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, .userPresence, nil) else {
            throw VaultError.keychain(errSecParam)
        }
        var query = item()
        query[kSecValueData as String] = data
        query[kSecAttrAccessControl as String] = access
        query[kSecUseAuthenticationContext as String] = context
        try check(SecItemAdd(query as CFDictionary, nil))
    }

    static func read(context: LAContext) throws -> Data {
        var query = item()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecUseAuthenticationContext as String] = context
        var result: CFTypeRef?
        try check(SecItemCopyMatching(query as CFDictionary, &result))
        guard let data = result as? Data else { throw VaultError.keychain(errSecDecode) }
        return data
    }

    static func update(_ data: Data, context: LAContext) throws {
        var query = item()
        query[kSecUseAuthenticationContext as String] = context
        try check(SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary))
    }

    static func delete() throws {
        let status = SecItemDelete(item() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw VaultError.keychain(status) }
    }

    /// Whether a wallet exists, without ever asking for Face ID: attributes only, with interaction not allowed
    static func exists() throws -> Bool {
        let context = LAContext()
        context.interactionNotAllowed = true
        var query = item()
        query[kSecReturnAttributes as String] = true
        query[kSecUseAuthenticationContext as String] = context
        switch SecItemCopyMatching(query as CFDictionary, nil) {
        case errSecSuccess, errSecInteractionNotAllowed: return true
        case errSecItemNotFound: return false
        case let status: throw VaultError.keychain(status)
        }
    }

    /// The Keychain outlives the app. A fresh install starts empty, as a freshly installed extension does: the first
    /// launch (no marker in UserDefaults, which deleting the app clears) removes any wallet left behind.
    static func forgetPreviousInstall() throws {
        let marker = "rocks.charisma.blazewallet.installed"
        guard !UserDefaults.standard.bool(forKey: marker) else { return }
        try delete()
        try Draft.delete()
        UserDefaults.standard.set(true, forKey: marker)
    }

    /// A new seed phrase being set up (SeedDraft), until it's confirmed. On this iPhone only and readable while it's
    /// unlocked, without Face ID, so setting up carries on after leaving the app, even if iOS closed it meanwhile.
    enum Draft {
        static func save(_ data: Data) throws {
            let status = SecItemUpdate(item("seed-draft") as CFDictionary, [kSecValueData as String: data] as CFDictionary)
            guard status == errSecItemNotFound else { return try check(status) }
            var query = item("seed-draft")
            query[kSecValueData as String] = data
            query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            try check(SecItemAdd(query as CFDictionary, nil))
        }

        static func read() throws -> Data? {
            var query = item("seed-draft")
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            var result: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            guard status != errSecItemNotFound else { return nil }
            try check(status)
            guard let data = result as? Data else { throw VaultError.keychain(errSecDecode) }
            return data
        }

        static func delete() throws {
            let status = SecItemDelete(item("seed-draft") as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else { throw VaultError.keychain(status) }
        }
    }

    private static func check(_ status: OSStatus) throws {
        switch status {
        case errSecSuccess: return
        case errSecUserCanceled: throw VaultError.cancelled
        default: throw VaultError.keychain(status)
        }
    }
}
