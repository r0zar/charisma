import LocalAuthentication
import StacksKit
import SwiftUI
import WalletCore

/// Errors the app itself raises
enum AppError: Error, Equatable {
    /// Word positions (1-based) whose confirmation doesn't match
    case wordsDontMatch([Int])
}

/// Words for every error the app can show, in the person's language. `row` gives amounts their token's decimals.
enum ErrorWords {
    static func message(_ error: Error, row: TokenRow? = nil) -> String {
        switch error {
        case let error as WalletError: wallet(error, row: row)
        case let error as VaultError: vault(error)
        case let error as AppError: app(error)
        case StacksError.randomUnavailable: String(localized: "This iPhone couldn't make random words. Try again.")
        // Nothing else should reach a screen: its own description, rather than Swift's "error 3"
        default: String(localized: "Something went wrong: \(String(describing: error))")
        }
    }

    private static func wallet(_ error: WalletError, row: TokenRow?) -> String {
        switch error {
        case .locked: String(localized: "The wallet is locked. Unlock it to continue.")
        case .invalidSeedPhrase: String(localized: "That isn't a valid seed phrase: check each word's spelling and that none are missing.")
        case .seedPhraseNameTaken(let name): String(localized: "A seed phrase named “\(name)” already exists.")
        case .seedPhraseNotFound: String(localized: "That seed phrase is no longer in this wallet.")
        case .accountNotFound: String(localized: "That account is no longer in this wallet.")
        case .requestFailed(.balances, let status): String(localized: "Couldn't load balances (\(status)).")
        case .requestFailed(.tokenList, let status): String(localized: "Couldn't load Charisma's token list (\(status)).")
        case .requestFailed(.prices, let status): String(localized: "Couldn't load prices (\(status)).")
        case .requestFailed(.stacks, let status): String(localized: "The Stacks network didn't answer (\(status)).")
        case .unreachable(.balances): String(localized: "Couldn't reach Charisma's balance service. Check your connection.")
        case .unreachable(.tokenList): String(localized: "Couldn't reach Charisma's token list. Check your connection.")
        case .unreachable(.prices): String(localized: "Couldn't reach Charisma's price feed. Check your connection.")
        case .unreachable(.stacks): String(localized: "Couldn't reach the Stacks network. Check your connection.")
        case .unreadable(.balances): String(localized: "Charisma's balance service sent something Blaze Wallet can't read.")
        case .unreadable(.tokenList): String(localized: "Charisma's token list sent something Blaze Wallet can't read.")
        case .unreadable(.prices): String(localized: "Charisma's price feed sent something Blaze Wallet can't read.")
        case .unreadable(.stacks): String(localized: "The Stacks network sent something Blaze Wallet can't read.")
        case .tokenListUnavailable: String(localized: "Charisma's token list is unavailable, so tokens can't be checked against its block list.")
        case .invalidRecipient: String(localized: "Enter a Stacks address (SP…).")
        case .invalidAmount: String(localized: "Enter an amount like \("1" + Amount.decimalMark(.current) + "5").")
        case .tooManyDecimals(let places): String(localized: "At most \(places) decimal places.")
        case .amountNotPositive: String(localized: "The amount must be more than zero.")
        case .moreThanBalance(let available):
            if let row { String(localized: "You have \(Format.amount(available, of: row, precision: .exact)) \(Format.symbol(row)).") }
            else { String(localized: "That's more than you have.") }
        case .amountTooLarge: String(localized: "That's more than one send can carry. Send it in parts.")
        case .unsendable(let reason, let symbol): unsendable(reason, symbol: symbol)
        case .notEnoughSTXForFee(let fee, let stxBalance, let mostSendable):
            if let mostSendable { String(localized: "Not enough STX for the network fee. You can send up to \(Format.stx(mostSendable)) STX.") }
            else { String(localized: "Not enough STX for the network fee: it's \(Format.stx(fee)) STX and you have \(Format.stx(stxBalance)) STX.") }
        case .rejected(let reason): String(localized: "The network rejected the transfer: \(reason)")
        case .unexpected(let message): String(localized: "Something went wrong: \(message)")
        }
    }

    /// Why a token can't be sent from the wallet
    static func unsendable(_ reason: Unsendable, symbol: String) -> String {
        switch reason {
        case .unlisted: String(localized: "Not on Charisma's token list, so it can't be sent from here.")
        case .unknown: String(localized: "An unknown token: shown in its smallest units, and it can't be sent from here.")
        case .missingAssetName: String(localized: "Charisma's token list has no asset name for \(symbol), so it can't be sent safely.")
        case .onlyOnBlaze: String(localized: "Your \(symbol) is all on Blaze. Move it with Charisma Swap.")
        case .nothingToSend: String(localized: "You have no \(symbol) to send yet.")
        }
    }

    private static func vault(_ error: VaultError) -> String {
        switch error {
        case .passcodeNotSet: String(localized: "Set a passcode on this iPhone to use Blaze Wallet.")
        case .authenticationUnavailable: String(localized: "Face ID and the passcode aren't available on this iPhone right now.")
        case .keychain(let status): String(localized: "This iPhone's Keychain refused (\(String(status))).")
        case .cancelled: String(localized: "Cancelled.")
        case .unreadable: String(localized: "The wallet saved on this iPhone can't be read.")
        }
    }

    private static func app(_ error: AppError) -> String {
        switch error {
        case .wordsDontMatch(let positions):
            String(localized: "Word \(positions.map { "#\($0)" }.joined(separator: ", ")) doesn't match. Check what you wrote down.")
        }
    }
}

/// An error, worded, in the danger colour; nothing when there's no error
struct ErrorText: View {
    let error: Error?
    var row: TokenRow?

    var body: some View {
        if let error {
            Text(ErrorWords.message(error, row: row))
                .foregroundStyle(.brand("danger"))
                .brandFont(.callout)
        }
    }
}
