import Foundation

/// Token amounts are exact integers in the token's smallest unit (`Int128`, never floating point). These turn them into
/// text in the person's locale and back. The app passes `Locale.current`: the phone's language plus its region, which
/// is also what the decimal keypad types.
public enum Amount {
    public enum Precision: Sendable {
        /// At most this many decimals, the rest cut off, not rounded (the token list)
        case cut(Int)
        /// Rounded to at most this many decimals (Status)
        case rounded(Int)
        /// Every decimal the token has (send review)
        case exact
    }

    /// `raw` smallest units as text: the locale's grouping and decimal marks, and a minus when negative
    public static func format(_ raw: Int128, decimals: Int, precision: Precision, locale: Locale) -> String {
        let style = Decimal.FormatStyle(locale: locale)
        let styled = switch precision {
        case .cut(let places): style.precision(.fractionLength(0...min(places, decimals))).rounded(rule: .towardZero)
        case .rounded(let places): style.precision(.fractionLength(0...min(places, decimals))).rounded(rule: .toNearestOrAwayFromZero)
        case .exact: style.precision(.fractionLength(0...decimals))
        }
        return decimal(raw, decimals: decimals).formatted(styled)
    }

    /// What someone typed, as smallest units, exactly. Accepts digits and at most one of the locale's decimal mark:
    /// no grouping marks, no sign.
    public static func parse(_ text: String, decimals: Int, locale: Locale) throws -> Int128 {
        let parts = text.trimmingCharacters(in: .whitespacesAndNewlines).components(separatedBy: decimalMark(locale))
        guard parts.count <= 2, parts.contains(where: { !$0.isEmpty }),
              parts.allSatisfy({ $0.allSatisfy { $0.isASCII && $0.isNumber } }) else { throw WalletError.invalidAmount }
        let fraction = parts.count == 2 ? parts[1] : ""
        guard fraction.count <= decimals else { throw WalletError.tooManyDecimals(max: decimals) }
        guard let whole = Int128(parts[0].isEmpty ? "0" : parts[0]),
              let part = Int128(fraction.isEmpty ? "0" : fraction.padding(toLength: decimals, withPad: "0", startingAt: 0)) else {
            throw WalletError.invalidAmount
        }
        let (scaled, overflow) = whole.multipliedReportingOverflow(by: power(decimals))
        guard !overflow, case let (total, sumOverflow) = scaled.addingReportingOverflow(part), !sumOverflow else {
            throw WalletError.invalidAmount
        }
        return total
    }

    /// The exact amount with the locale's decimal mark and no grouping, so `parse` reads it back unchanged (Max)
    public static func editable(_ raw: Int128, decimals: Int, locale: Locale) -> String {
        let digits = String(raw.magnitude)
        let sign = raw < 0 ? "-" : ""
        guard decimals > 0 else { return sign + digits }
        let padded = String(repeating: "0", count: max(0, decimals + 1 - digits.count)) + digits
        var fraction = String(padded.suffix(decimals))
        while fraction.last == "0" { fraction.removeLast() }
        let whole = String(padded.dropLast(decimals))
        return sign + (fraction.isEmpty ? whole : whole + decimalMark(locale) + fraction)
    }

    /// Whole tokens, for pricing only (display always uses `format`)
    public static func units(_ raw: Int128, decimals: Int) -> Double {
        Double(raw) / pow(10, Double(decimals))
    }

    /// US dollars in the locale's currency format: 4 decimals under $1, else 2
    public static func usd(_ value: Double, locale: Locale) -> String {
        value.formatted(.currency(code: "USD").locale(locale).precision(.fractionLength(value < 1 ? 2...4 : 2...2)))
    }

    /// The locale's decimal mark, for example text such as "1,5"
    public static func decimalMark(_ locale: Locale) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        return formatter.decimalSeparator
    }

    private static func decimal(_ raw: Int128, decimals: Int) -> Decimal {
        // Decimal is base 10, so this is exact for every amount under 38 digits
        Decimal(string: String(raw), locale: Locale(identifier: "en_US_POSIX"))! / pow(Decimal(10), decimals)
    }

    private static func power(_ decimals: Int) -> Int128 {
        (0..<decimals).reduce(Int128(1)) { value, _ in value * 10 }
    }
}
