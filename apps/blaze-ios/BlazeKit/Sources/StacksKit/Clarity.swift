import Foundation

/// The Clarity values the wallet sends (transfer arguments) and reads (subnet `get-balance`)
public indirect enum ClarityValue: Hashable, Sendable {
    case uint(UInt128)
    case principal(Principal)
    case none
    case ok(ClarityValue)

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
        }
    }

    /// Reads one serialized value. Other Clarity types, or bytes left over, throw.
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
            return .uint(try reader.read(16).reduce(UInt128(0)) { $0 << 8 | UInt128($1) })
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
            return .ok(try read(&reader))
        default:
            throw StacksError.invalidClarityValue
        }
    }

    private static func readAddress(_ reader: inout ByteReader) throws -> StacksAddress {
        let version = try reader.byte()
        guard version < 32 else { throw StacksError.invalidClarityValue }
        return StacksAddress(version: version, hash160: Data(try reader.read(20)))
    }
}
