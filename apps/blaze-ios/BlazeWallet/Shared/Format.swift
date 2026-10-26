import Foundation
import StacksKit
import WalletCore

/// Text the screens share
enum Format {
    /// "SP2ZN…55KS", as the extension shortens addresses
    static func short(_ address: String) -> String {
        address.count > 12 ? "\(address.prefix(5))…\(address.suffix(4))" : address
    }

    /// A row's symbol, or its contract name when the token is unknown
    static func symbol(_ row: TokenRow) -> String {
        row.meta?.symbol ?? String(row.contractId.split(separator: ".").last ?? Substring(row.contractId))
    }

    /// An amount of a row's token, in the person's locale; raw units when the token is unknown
    static func amount(_ raw: Int128, of row: TokenRow, precision: Amount.Precision) -> String {
        guard let meta = row.meta else { return String(localized: "\(String(raw)) units") }
        return Amount.format(raw, decimals: meta.decimals, precision: precision, locale: .current)
    }

    /// Micro-STX as STX, every decimal (the review's network fee)
    static func stx(_ micro: Int128) -> String {
        Amount.format(micro, decimals: 6, precision: .exact, locale: .current)
    }

    static func usd(_ value: Double) -> String { Amount.usd(value, locale: .current) }

    /// The explorer page for a txid
    /// The explorer's page for a transaction: its id with or without the 0x Hiro's API gives
    static func explorer(_ txid: String) -> URL {
        let hash = txid.hasPrefix("0x") ? txid : "0x" + txid
        return URL(string: "https://explorer.hiro.so/txid/\(hash)?chain=mainnet")!
    }
}
