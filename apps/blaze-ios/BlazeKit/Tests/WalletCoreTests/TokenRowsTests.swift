import Foundation
import Testing
@testable import WalletCore

struct TokenRowsTests {
    let cha = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token"
    let welsh = "SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token"
    let sbtc = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
    let airdrop = "SP000000000000000000002Q6VF78.airdrop"

    var list: [TokenInfo] {
        [
            TokenInfo(contractId: ".stx", name: "Stacks Token", symbol: "STX", decimals: 6, identifier: "STX"),
            TokenInfo(contractId: cha, name: "Charisma", symbol: "CHA", decimals: 6, identifier: "charisma"),
            TokenInfo(contractId: welsh, name: "Welsh", symbol: "WELSH", decimals: 6, identifier: ""),
            TokenInfo(contractId: sbtc, name: "sBTC", symbol: "sBTC", decimals: 8, identifier: "sbtc-token"),
        ]
    }

    var sheet: BalanceSheet {
        BalanceSheet(address: TestPhrase.account0, tokens: [
            ".stx": .init(ready: "5000000"),
            "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-subnet": .init(base: ".stx", ready: "1000000"),
            cha: .init(ready: "250"),
            "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1": .init(base: cha, ready: "50"),
            "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-subnet": .init(base: sbtc, ready: "7"),
            welsh: .init(ready: "9"),
            airdrop: .init(ready: "1000"),
            "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.empty": .init(ready: "0"),
            "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.broken": .init(ready: nil, error: "chain read failed"),
        ])
    }

    @Test func foldsBlazeIntoItsBaseTokenAndOrdersRows() {
        let rows = TokenRows.build(sheet: sheet, list: list, lookups: [:])
        #expect(rows.map(\.contractId) == [".stx", airdrop, cha, welsh, sbtc])
        let stx = rows[0]
        #expect((stx.standard, stx.blaze, stx.asset, stx.listed) == (5_000_000, 1_000_000, "", true))
        let charisma = rows.first { $0.contractId == cha }!
        #expect((charisma.standard, charisma.blaze, charisma.total, charisma.asset) == (250, 50, 300, "charisma"))
    }

    @Test func saysWhyARowCantBeSent() {
        let rows = Dictionary(uniqueKeysWithValues: TokenRows.build(sheet: sheet, list: list, lookups: [:]).map { ($0.contractId, $0) })
        #expect(rows[".stx"]!.unsendable == nil)
        #expect(rows[cha]!.unsendable == nil)
        #expect(rows[airdrop]!.unsendable == .unlisted)
        #expect(rows[welsh]!.unsendable == .missingAssetName)
        #expect(rows[sbtc]!.unsendable == .onlyOnBlaze)
        // A new wallet's empty STX row has nothing to send, rather than being "on Blaze"
        let empty = TokenRows.build(sheet: BalanceSheet(address: TestPhrase.account0, tokens: [:]), list: list, lookups: [:])
        #expect(empty.map(\.contractId) == [".stx"])
        #expect(empty[0].unsendable == .nothingToSend)
    }

    @Test func decimalsOutsideZeroToThirtyEightMakeATokenUnknown() {
        let charisma = { (decimals: Int) in TokenInfo(contractId: cha, name: "Charisma", symbol: "CHA", decimals: decimals, identifier: "charisma") }
        #expect(TokenMeta(charisma(0)) != nil && TokenMeta(charisma(38)) != nil)
        #expect(TokenMeta(charisma(-1)) == nil && TokenMeta(charisma(39)) == nil)
        let rows = TokenRows.build(sheet: sheet, list: list.map { $0.contractId == cha ? charisma(-6) : $0 }, lookups: [:])
        #expect(rows.first { $0.contractId == cha }!.unsendable == .unknown)
    }

    @Test func pendingSendsCanTakeStandardBelowZero() {
        #expect(TokenRow.make(cha, standard: -5).unsendable == .nothingToSend)
        #expect(TokenRow.make(cha, standard: -5, blaze: 3).unsendable == .onlyOnBlaze)
    }

    @Test func unlistedTokensAreLookedUpButStayUnlisted() {
        // Only tokens that become rows: the empty and the unreadable ones don't
        #expect(TokenRows.unlisted(sheet: sheet, list: list) == [airdrop])
        let lookups = [airdrop: TokenInfo(contractId: nil, name: "Airdrop", symbol: "AIR", decimals: 0, identifier: "air")]
        let row = TokenRows.build(sheet: sheet, list: list, lookups: lookups).first { $0.contractId == airdrop }!
        #expect(row.meta?.symbol == "AIR")
        #expect(row.listed == false && row.unsendable == .unlisted)
        // Without a lookup it's unknown
        #expect(TokenRows.build(sheet: sheet, list: list, lookups: [:]).first { $0.contractId == airdrop }!.meta == nil)
    }
}
