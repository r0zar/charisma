import Foundation

/// A Stacks address: a version and the hash160 of a public key (or script), written in c32check
public struct StacksAddress: Hashable, Sendable, CustomStringConvertible {
    /// Mainnet single-signature addresses start with SP
    public static let mainnetSingleSig: UInt8 = 22
    /// Mainnet multi-signature addresses start with SM
    public static let mainnetMultiSig: UInt8 = 20

    public let version: UInt8
    public let hash160: Data

    public init(version: UInt8, hash160: Data) {
        precondition(version < 32 && hash160.count == 20, "A Stacks address is a version under 32 and 20 bytes")
        self.version = version
        self.hash160 = Data(hash160)
    }

    /// Reads an address like `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS`, checking its checksum
    public init(_ text: String) throws {
        let chars = Array(C32.normalize(text))
        guard chars.count > 5, chars[0] == "S", let version = C32.alphabet.firstIndex(of: chars[1]) else {
            throw StacksError.invalidAddress
        }
        let data = try C32.decode(String(chars.dropFirst(2)))
        guard data.count == 24 else { throw StacksError.invalidAddress }
        let hash160 = Data(data.prefix(20))
        guard Self.checksum(version: UInt8(version), hash160: hash160) == Data(data.suffix(4)) else {
            throw StacksError.invalidAddress
        }
        self.init(version: UInt8(version), hash160: hash160)
    }

    /// The mainnet single-sig address of a compressed public key
    public init(publicKey: Data) {
        self.init(version: Self.mainnetSingleSig, hash160: Hashing.hash160(publicKey))
    }

    public var description: String {
        "S" + String(C32.alphabet[Int(version)]) + C32.encode(hash160 + Self.checksum(version: version, hash160: hash160))
    }

    private static func checksum(version: UInt8, hash160: Data) -> Data {
        Data(Hashing.sha256(Hashing.sha256(Data([version]) + hash160)).prefix(4))
    }
}

/// Who can hold tokens: an address, or a contract deployed by one (`SP….contract-name`)
public enum Principal: Hashable, Sendable, CustomStringConvertible {
    case standard(StacksAddress)
    case contract(StacksAddress, name: String)

    /// Reads `SP…` or `SP….contract-name`
    public init(_ text: String) throws {
        let parts = text.split(separator: ".", omittingEmptySubsequences: false)
        switch parts.count {
        case 1:
            self = .standard(try StacksAddress(String(parts[0])))
        case 2:
            let name = String(parts[1])
            guard Self.isContractName(name) else { throw StacksError.invalidContractName }
            self = .contract(try StacksAddress(String(parts[0])), name: name)
        default:
            throw StacksError.invalidAddress
        }
    }

    public var description: String {
        switch self {
        case .standard(let address): address.description
        case .contract(let address, let name): "\(address).\(name)"
        }
    }

    /// A letter, then letters, digits, - or _: the extension's recipient pattern; at most 128 bytes on the wire
    static func isContractName(_ name: String) -> Bool {
        guard let first = name.unicodeScalars.first, name.utf8.count <= 128,
              CharacterSet.letters.contains(first), first.isASCII else { return false }
        return name.unicodeScalars.allSatisfy { $0.isASCII && (CharacterSet.alphanumerics.contains($0) || $0 == "-" || $0 == "_") }
    }
}
