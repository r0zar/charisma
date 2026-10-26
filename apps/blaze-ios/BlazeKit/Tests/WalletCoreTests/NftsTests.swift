import Foundation
import Testing
@testable import WalletCore

/// NFT details: the contract's answer about its token URI, and where the metadata lives. The URI answer is the one
/// the STDAO contract returned for token 867.
struct NftsTests {
    static let stdaoAnswer = "0x070a0d0000005968747470733a2f2f717569636b6e6f64652e717569636b6e6f64652d697066732e636f6d2f697066732f516d61574c74326a6f66626e5150487038374b50565170514631664679314e566636744158627a625131524d52562f"

    @Test func readsTheTokenURIFromTheAnswer() throws {
        let uri = try Nfts.decodeURI(hex: Self.stdaoAnswer)
        #expect(uri.hasPrefix("https://quicknode.quicknode-ipfs.com/ipfs/"))
        #expect(uri.hasSuffix("/"))
    }

    @Test func saysWhyThereIsNoURI() throws {
        // `none` inside `ok`, and an error response
        #expect(throws: WalletError.self) { try Nfts.decodeURI(hex: "0x0709") }
        #expect(throws: WalletError.self) { try Nfts.decodeURI(hex: "0x08010000000000000000000000000000000a") }
    }

    @Test func fillsTheTokenIdIn() throws {
        #expect(try Nfts.metadataURL("https://example.com/meta/", tokenId: "867").absoluteString == "https://example.com/meta/867")
        #expect(try Nfts.metadataURL("https://example.com/{id}.json", tokenId: "867").absoluteString == "https://example.com/867.json")
    }

    @Test func fetchesIPFSThroughTheGateway() throws {
        #expect(try Nfts.metadataURL("ipfs://QmX/", tokenId: "7").absoluteString == "https://ipfs.io/ipfs/QmX/7")
        #expect(throws: WalletError.self) { try Nfts.fetchableURL("ar://somewhere") }
    }
}
