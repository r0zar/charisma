import Foundation
import Testing
@testable import StacksKit

struct AccountKeysTests {
    @Test func accountsMatchWalletSDK() throws {
        for vector in Vectors.all.phrases {
            for account in vector.accounts {
                let keys = try AccountKeys.derive(phrase: vector.phrase, index: account.index)
                #expect(keys.privateKey.hex == account.privateKey)
                #expect(keys.publicKey.hex == account.publicKey)
                #expect(keys.address.description == account.address)
            }
        }
    }

    @Test func readsStoredKeysWithOrWithoutTheSuffix() throws {
        let account = Vectors.all.phrases[0].accounts[0]
        let stored = try Data(hex: account.privateKey)
        #expect(try AccountKeys(privateKey: stored).address.description == account.address)
        #expect(try AccountKeys(privateKey: stored.prefix(32)).address.description == account.address)
        #expect(throws: StacksError.invalidKey) { try AccountKeys(privateKey: Data(repeating: 0, count: 32)) }
        #expect(throws: StacksError.invalidKey) { try AccountKeys(privateKey: Data(repeating: 1, count: 31)) }
    }
}
