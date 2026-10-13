import Foundation
import Testing
@testable import StacksKit

struct AddressTests {
    @Test func decodesAndReencodesTheVectors() throws {
        for vector in Vectors.all.addresses {
            let address = try StacksAddress(vector.address)
            #expect(address.version == vector.version)
            #expect(address.hash160.hex == vector.hash160)
            #expect(address.description == vector.address)
        }
    }

    @Test(arguments: [
        "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KT", // last character changed: bad checksum
        "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55K",  // one character short
        "ST2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS", // testnet version, checksum no longer matches
        "XP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS", // doesn't start with S
        "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55U",  // U isn't in the c32 alphabet
        "",
    ])
    func rejectsBadAddresses(text: String) {
        #expect(throws: StacksError.invalidAddress) { try StacksAddress(text) }
    }

    @Test func readsPrincipals() throws {
        #expect(try Principal("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token").description
            == "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token")
        #expect(throws: StacksError.invalidContractName) { try Principal("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.1token") }
        #expect(throws: StacksError.invalidContractName) { try Principal("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.") }
        #expect(throws: StacksError.invalidAddress) { try Principal("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.a.b") }
    }
}
