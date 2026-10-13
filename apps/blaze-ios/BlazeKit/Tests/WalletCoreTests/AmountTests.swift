import Foundation
import Testing
@testable import WalletCore

struct AmountTests {
    let us = Locale(identifier: "en_US")
    let germany = Locale(identifier: "de_DE")
    let turkey = Locale(identifier: "tr_TR")
    let japan = Locale(identifier: "ja_JP")

    @Test func parsesOnlyTheLocalesDecimalMark() throws {
        #expect(try Amount.parse("1.5", decimals: 6, locale: us) == 1_500_000)
        #expect(try Amount.parse("1,5", decimals: 6, locale: germany) == 1_500_000)
        #expect(try Amount.parse("1,5", decimals: 6, locale: turkey) == 1_500_000)
        #expect(try Amount.parse(",5", decimals: 6, locale: germany) == 500_000)
        #expect(try Amount.parse("2", decimals: 0, locale: japan) == 2)
        #expect(try Amount.parse(" 1.5\n", decimals: 6, locale: us) == 1_500_000)
        #expect(throws: WalletError.invalidAmount) { try Amount.parse("1,5", decimals: 6, locale: japan) }
        #expect(throws: WalletError.invalidAmount) { try Amount.parse("1.5", decimals: 6, locale: germany) }
    }

    @Test func rejectsGroupingSignsAndJunk() {
        for text in ["1,000.5", "1.000,5", "-1", "+1", "", ".", "1.2.3", "1e5", "١"] {
            #expect(throws: WalletError.invalidAmount, "\(text)") { try Amount.parse(text, decimals: 6, locale: us) }
        }
        #expect(throws: WalletError.tooManyDecimals(max: 6)) { try Amount.parse("0.0000001", decimals: 6, locale: us) }
        #expect(throws: WalletError.invalidAmount) { try Amount.parse(String(repeating: "9", count: 40), decimals: 6, locale: us) }
    }

    @Test func formatsWithEachScreensPrecision() {
        let amount: Int128 = 1_234_567_890_123 // 1,234,567.890123 at 6 decimals
        #expect(Amount.format(amount, decimals: 6, precision: .cut(6), locale: us) == "1,234,567.890123")
        #expect(Amount.format(amount, decimals: 6, precision: .cut(6), locale: germany) == "1.234.567,890123")
        #expect(Amount.format(amount, decimals: 6, precision: .cut(6), locale: japan) == "1,234,567.890123")
        // The token list cuts, Status rounds, review is exact
        #expect(Amount.format(199_999_999, decimals: 8, precision: .cut(6), locale: us) == "1.999999")
        #expect(Amount.format(199_999_999, decimals: 8, precision: .rounded(4), locale: us) == "2")
        #expect(Amount.format(1, decimals: 8, precision: .exact, locale: us) == "0.00000001")
        #expect(Amount.format(1, decimals: 8, precision: .cut(6), locale: us) == "0")
        #expect(Amount.format(-1_500_000, decimals: 6, precision: .cut(6), locale: us) == "-1.5")
    }

    @Test func maxRoundTripsExactly() throws {
        for locale in [us, germany, turkey, japan] {
            for (raw, decimals) in [(Int128(1), 8), (123_456_789, 8), (1_500_000, 6), (42, 0), (0, 6)] as [(Int128, Int)] {
                let text = Amount.editable(raw, decimals: decimals, locale: locale)
                #expect(try Amount.parse(text, decimals: decimals, locale: locale) == raw, "\(text) \(locale.identifier)")
            }
        }
        #expect(Amount.editable(1_500_000, decimals: 6, locale: germany) == "1,5")
        #expect(Amount.editable(1, decimals: 8, locale: us) == "0.00000001")
    }

    @Test func formatsDollars() {
        #expect(Amount.usd(1234.5, locale: us) == "$1,234.50")
        #expect(Amount.usd(0.012345, locale: us) == "$0.0123")
    }
}
