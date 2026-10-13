import Foundation

/// Crockford-style base 32, as the c32check library writes Stacks addresses
enum C32 {
    static let alphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")

    /// The bytes as one big number in base 32, plus one leading "0" per leading zero byte
    static func encode(_ data: Data) -> String {
        let bytes = [UInt8](data)
        let zeroBytes = bytes.prefix { $0 == 0 }.count
        var digits: [Character] = []
        var buffer: UInt32 = 0
        var bits: UInt32 = 0
        for byte in bytes.reversed() {
            buffer |= UInt32(byte) << bits
            bits += 8
            while bits >= 5 {
                digits.append(alphabet[Int(buffer & 31)])
                buffer >>= 5
                bits -= 5
            }
        }
        if bits > 0 { digits.append(alphabet[Int(buffer & 31)]) }
        while digits.last == "0" { digits.removeLast() }
        return String(repeating: "0", count: zeroBytes) + String(digits.reversed())
    }

    /// The inverse of `encode`. Throws on a character outside the alphabet (after `normalize`).
    static func decode(_ text: String) throws -> Data {
        let chars = Array(normalize(text))
        let zeroChars = chars.prefix { $0 == "0" }.count
        var bytes: [UInt8] = []
        var buffer: UInt32 = 0
        var bits: UInt32 = 0
        for char in chars.reversed() {
            guard let value = alphabet.firstIndex(of: char) else { throw StacksError.invalidAddress }
            buffer |= UInt32(value) << bits
            bits += 5
            if bits >= 8 {
                bytes.append(UInt8(buffer & 0xFF))
                buffer >>= 8
                bits -= 8
            }
        }
        if buffer != 0 { bytes.append(UInt8(buffer)) }
        while bytes.last == 0 { bytes.removeLast() }
        return Data(repeating: 0, count: zeroChars) + Data(bytes.reversed())
    }

    /// c32check reads O as 0 and I, L as 1, in either case
    static func normalize(_ text: String) -> String {
        text.uppercased()
            .replacingOccurrences(of: "O", with: "0")
            .replacingOccurrences(of: "I", with: "1")
            .replacingOccurrences(of: "L", with: "1")
    }
}
