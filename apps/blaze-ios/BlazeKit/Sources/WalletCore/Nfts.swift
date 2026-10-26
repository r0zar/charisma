import Foundation
import StacksKit

/// An NFT the account holds, with its details read from its own contract. Hiro lists what the account holds; the
/// contract's get-token-uri gives where the token's metadata lives, and that JSON gives the name and picture.
public struct NftItem: Hashable, Identifiable, Sendable {
    /// The collection's contract id
    public let contractId: String
    public let tokenId: String
    /// From the token's metadata; nil when it couldn't be read
    public let name: String?
    /// The picture's address; nil when the metadata has none or it couldn't be read
    public let image: URL?
    /// Why the details couldn't load, in English; nil when they did
    public let problem: String?

    public var id: String { "\(contractId)::\(tokenId)" }
}

/// One page of the account's NFTs, and how many it holds in all
public struct NftPage: Hashable, Sendable {
    public let items: [NftItem]
    public let total: Int
}

/// The account's NFTs, as the extension shows them (apps/signet/background/lib/nfts.ts). A token whose details can't
/// load still shows, with its id and why it has no picture.
public enum Nfts {
    /// Where ipfs:// pictures and metadata are read from
    static let gateway = "https://ipfs.io/ipfs/"

    /// One page of the account's NFTs, each with its details (or why not)
    public static func page(address: String, offset: Int, limit: Int, hiro: Hiro = Hiro()) async throws -> NftPage {
        struct Holdings: Decodable {
            struct Entry: Decodable {
                struct Value: Decodable { let repr: String }
                let asset_identifier: String
                let value: Value
            }
            let total: Int
            let results: [Entry]
        }
        var components = URLComponents(
            url: Hiro.base.appending(path: "extended/v1/tokens/nft/holdings"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "principal", value: address),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
        guard let url = components?.url else { throw WalletError.unreadable(.stacks) }
        let holdings = try await hiro.http.get(url, from: .stacks, as: Holdings.self)

        // Details load together, and the page keeps the holdings' order
        let items = await withTaskGroup(of: (Int, NftItem).self) { group -> [NftItem] in
            for (index, entry) in holdings.results.enumerated() {
                group.addTask {
                    let contract = entry.asset_identifier.components(separatedBy: "::").first ?? entry.asset_identifier
                    let tokenId = String(entry.value.repr.dropFirst())
                    do {
                        let details = try await details(contract: contract, tokenId: tokenId, sender: address, hiro: hiro)
                        return (index, NftItem(contractId: contract, tokenId: tokenId, name: details.name, image: details.image, problem: nil))
                    } catch {
                        return (index, NftItem(contractId: contract, tokenId: tokenId, name: nil, image: nil, problem: String(describing: error)))
                    }
                }
            }
            var collected: [(Int, NftItem)] = []
            for await item in group { collected.append(item) }
            return collected.sorted { $0.0 < $1.0 }.map(\.1)
        }
        return NftPage(items: items, total: holdings.total)
    }

    /// The metadata's name and picture, from the contract's token URI
    private static func details(contract: String, tokenId: String, sender: String, hiro: Hiro) async throws -> (name: String?, image: URL?) {
        struct Metadata: Decodable {
            let name: String?
            let image: String?
        }
        let uri = try await tokenURI(contract: contract, tokenId: tokenId, sender: sender, hiro: hiro)
        let json = try await fetchJSON(metadataURL(uri, tokenId: tokenId), session: hiro.http.session, as: Metadata.self)
        return (json.name, try json.image.map { try fetchableURL($0) })
    }

    /// The token URI the contract reports for one token: get-token-uri, read on-chain
    static func tokenURI(contract: String, tokenId: String, sender: String, hiro: Hiro) async throws -> String {
        struct Request: Encodable {
            let sender: String
            let arguments: [String]
        }
        struct Answer: Decodable {
            let okay: Bool
            let result: String?
        }
        guard case .contract(let address, let name) = try Principal(contract), let id = UInt128(tokenId) else {
            throw WalletError.unexpected("The NFT \(contract) #\(tokenId)")
        }
        let url = Hiro.base
            .appending(path: "v2/contracts/call-read")
            .appending(path: address.description)
            .appending(path: name)
            .appending(path: "get-token-uri")
        let argument = "0x" + ClarityValue.uint(id).serialized.hex
        let answer = try await hiro.http.post(url, json: Request(sender: sender, arguments: [argument]), from: .stacks, as: Answer.self)
        guard answer.okay, let result = answer.result else { throw WalletError.unexpected("get-token-uri didn't answer") }
        return try decodeURI(hex: result)
    }

    /// A get-token-uri answer: (ok (some (string-ascii …))). A `none`, an error, or anything else is a reason, not a URI.
    static func decodeURI(hex: String) throws -> String {
        let bytes = [UInt8](try Data(hex: String(hex.dropFirst(2))))
        if bytes.first == 0x08 { throw WalletError.unexpected("get-token-uri failed") }
        if bytes.count >= 2, bytes[0] == 0x07, bytes[1] == 0x09 { throw WalletError.unexpected("The contract has no token URI for this token") }
        guard bytes.count >= 7, bytes[0] == 0x07, bytes[1] == 0x0a, bytes[2] == 0x0d else {
            throw WalletError.unexpected("The token URI isn't a string")
        }
        let length = bytes[3..<7].reduce(0) { $0 << 8 | Int($1) }
        guard bytes.count == 7 + length, let text = String(bytes: bytes[7...], encoding: .utf8) else {
            throw WalletError.unexpected("The token URI isn't readable")
        }
        return text
    }

    /// Where the metadata lives: {id} filled in, or the id added to a base URI that ends in "/"
    static func metadataURL(_ uri: String, tokenId: String) throws -> URL {
        var text = uri
        if uri.contains("{id}") {
            text = uri.replacingOccurrences(of: "{id}", with: tokenId)
        } else if uri.hasSuffix("/") {
            text = uri + tokenId
        }
        return try fetchableURL(text)
    }

    /// An address the wallet can fetch: https as it is, ipfs:// through the gateway
    static func fetchableURL(_ text: String) throws -> URL {
        if text.hasPrefix("ipfs://") {
            return try fetchableURL(gateway + String(text.dropFirst("ipfs://".count)))
        }
        guard text.hasPrefix("https://") || text.hasPrefix("http://"), let url = URL(string: text) else {
            throw WalletError.unexpected("Can't read \(text)")
        }
        return url
    }

    private static func fetchJSON<T: Decodable>(_ url: URL, session: URLSession, as: T.Type) async throws -> T {
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw WalletError.unexpected("Its metadata didn't answer")
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw WalletError.unexpected("Its metadata isn't readable")
        }
    }
}
