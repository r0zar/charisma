import Foundation

/// The Clarity values the wallet sends (transfer and swap arguments) and reads (subnet `get-balance`)
public indirect enum ClarityValue: Hashable, Sendable {
    case uint(UInt128)
    case principal(Principal)
    case none
    case ok(ClarityValue)
    /// A buffer of bytes (a swap's opcode is one, inside `some`)
    case buffer(Data)
    case some(ClarityValue)
    /// An ASCII string (a Blaze order's intent, uuid and domain fields)
    case stringAscii(String)
    /// A tuple's fields by name. They serialize sorted by name, as Clarity requires.
    case tuple([String: ClarityValue])

    /// Consensus serialization, as @stacks/transactions `Cl.serialize`
    public var serialized: Data {
        switch self {
        case .uint(let value):
            Data([0x01]) + value.bigEndianData
        case .principal(.standard(let address)):
            Data([0x05, address.version]) + address.hash160
        case .principal(.contract(let address, let name)):
            Data([0x06, address.version]) + address.hash160 + Data([UInt8(name.utf8.count)]) + Data(name.utf8)
        case .none:
            Data([0x09])
        case .ok(let value):
            Data([0x07]) + value.serialized
        case .buffer(let bytes):
            Data([0x02]) + UInt32(bytes.count).bigEndianData + bytes
        case .some(let value):
            Data([0x0a]) + value.serialized
        case .stringAscii(let text):
            Data([0x0d]) + UInt32(text.utf8.count).bigEndianData + Data(text.utf8)
        case .tuple(let fields):
            Data([0x0c]) + UInt32(fields.count).bigEndianData + fields.sorted { $0.key < $1.key }.reduce(Data()) { out, field in
                out + Data([UInt8(field.key.utf8.count)]) + Data(field.key.utf8) + field.value.serialized
            }
        }
    }

    /// Reads one serialized value: a uint, a principal, `none`, or `(ok u…)`. Other Clarity types, or bytes left
    /// over, throw.
    public init(serialized: Data) throws {
        var reader = ByteReader(serialized)
        self = try Self.read(&reader)
        guard reader.isAtEnd else { throw StacksError.invalidClarityValue }
    }

    /// The number in `u…` or `(ok u…)`, the two shapes subnet `get-balance` returns
    public var uintValue: UInt128? {
        switch self {
        case .uint(let value), .ok(.uint(let value)): value
        default: nil
        }
    }

    private static func read(_ reader: inout ByteReader) throws -> ClarityValue {
        switch try reader.byte() {
        case 0x01:
            return .uint(try readUInt(&reader))
        case 0x05:
            return .principal(.standard(try readAddress(&reader)))
        case 0x06:
            let address = try readAddress(&reader)
            let length = Int(try reader.byte())
            guard let name = String(bytes: try reader.read(length), encoding: .utf8) else { throw StacksError.invalidClarityValue }
            return .principal(.contract(address, name: name))
        case 0x09:
            return .none
        case 0x07:
            // Only `(ok u…)`: reading the inside directly means nothing a server sends can nest
            guard try reader.byte() == 0x01 else { throw StacksError.invalidClarityValue }
            return .ok(.uint(try readUInt(&reader)))
        default:
            throw StacksError.invalidClarityValue
        }
    }

    private static func readUInt(_ reader: inout ByteReader) throws -> UInt128 {
        try reader.read(16).reduce(UInt128(0)) { $0 << 8 | UInt128($1) }
    }

    private static func readAddress(_ reader: inout ByteReader) throws -> StacksAddress {
        let version = try reader.byte()
        guard version < 32 else { throw StacksError.invalidClarityValue }
        return StacksAddress(version: version, hash160: Data(try reader.read(20)))
    }
}
