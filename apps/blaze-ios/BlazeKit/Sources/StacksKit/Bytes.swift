import Foundation

extension Data {
    /// Lowercase hex, two digits per byte
    public var hex: String { map { String(format: "%02x", $0) }.joined() }

    /// Bytes from hex, with or without a `0x` prefix
    public init(hex: String) throws {
        let digits = hex.hasPrefix("0x") ? hex.dropFirst(2) : Substring(hex)
        guard digits.count % 2 == 0, digits.allSatisfy({ $0.isASCII && $0.isHexDigit }) else { throw StacksError.invalidHex }
        var bytes = [UInt8]()
        bytes.reserveCapacity(digits.count / 2)
        var index = digits.startIndex
        while index < digits.endIndex {
            let next = digits.index(index, offsetBy: 2)
            bytes.append(UInt8(digits[index..<next], radix: 16)!)
            index = next
        }
        self.init(bytes)
    }
}

extension FixedWidthInteger {
    /// The integer's bytes, most significant first
    var bigEndianData: Data { withUnsafeBytes(of: bigEndian) { Data($0) } }
}

/// Reads bytes front to back; every read past the end throws
struct ByteReader {
    private let bytes: [UInt8]
    private var offset = 0

    init(_ data: Data) { bytes = [UInt8](data) }

    var isAtEnd: Bool { offset == bytes.count }

    mutating func read(_ count: Int) throws -> [UInt8] {
        guard count >= 0, offset + count <= bytes.count else { throw StacksError.invalidClarityValue }
        defer { offset += count }
        return Array(bytes[offset..<offset + count])
    }

    mutating func byte() throws -> UInt8 { try read(1)[0] }
}
