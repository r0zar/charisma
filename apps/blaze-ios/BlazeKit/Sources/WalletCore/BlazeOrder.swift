import Foundation
import StacksKit

/// Blaze orders, as the extension and Charisma Swap place them (apps/signet/src/background/lib/blaze-orders.ts,
/// apps/simple-swap/src/lib/subnet-pairs.ts): the account signs a swap that spends a Blaze subnet balance, and
/// Charisma's order service gives it to a solver to fill. An order has no minimum amount: its price is the route's when
/// a solver fills it.
///
/// During the Blaze v2 migration a token can live in two subnets: v1, where older balances are and which is spent
/// first, and v2, where anything paid into Blaze lands. STX and USDCx only have v2.
public enum BlazeOrder {
    private static let ordersURL = URL(string: "https://swap.charisma.rocks/api/v1/orders/new")!
    private static let http = HTTP(session: .shared)
    /// The router an order names, for v1 and v2 subnets alike. It pays out only to whoever signed the order.
    public static let router = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v2"

    private static let deployer = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS"

    /// Each Blaze v1 subnet and its v2 successor (blaze-sdk's SUBNET_V2_OF)
    static let v2Of: [String: String] = [
        "\(deployer).charisma-token-subnet-v1": "\(deployer).charisma-token-subnet-v2",
        "\(deployer).welsh-token-subnet-v1": "\(deployer).welsh-token-subnet-v2",
        "\(deployer).sbtc-token-subnet-v1": "\(deployer).sbtc-token-subnet-v2",
        "\(deployer).dmtoken-subnet": "\(deployer).dmt-token-subnet-v2",
        "\(deployer).kangaroo-subnet": "\(deployer).roo-token-subnet-v2",
        "\(deployer).leo-token-subnet-v1": "\(deployer).leo-token-subnet-v2",
        "\(deployer).pepe-token-subnet-v1": "\(deployer).pepe-token-subnet-v2",
        "\(deployer).zest-token-subnet": "\(deployer).zest-token-subnet-v2",
        "\(deployer).token-aeusdc-subnet": "\(deployer).aeusdc-token-subnet-v2",
        "\(deployer).usda-token-subnet": "\(deployer).usda-token-subnet-v2",
        "\(deployer).usdh-token-v1-subnet": "\(deployer).usdh-token-subnet-v2",
        "\(deployer).susdh-token-subnet-v1": "\(deployer).susdh-token-subnet-v2",
        "\(deployer).nope-subnet": "\(deployer).nope-token-subnet-v2",
        "\(deployer).skullcoin-stxcity-subnet": "\(deployer).skull-token-subnet-v2",
        "\(deployer).hooter-the-owl-subnet": "\(deployer).hoot-token-subnet-v2",
        // World Peace Stacks' v1 subnet was deployed by its own team; Charisma deployed the v2
        "SP2KGJEAZRDVK78ZWTRGSDE11A1VMZVEATNQFZ73C.world-peace-stacks-stxcity-subnet": "\(deployer).wps-token-subnet-v2",
    ]

    /// Every Blaze v1 subnet (blaze-sdk's V1_SUBNETS)
    public static let v1Subnets = Set(v2Of.keys)

    /// Every Blaze v2 subnet (blaze-sdk's BLAZE_V2_SUBNETS)
    public static let v2Subnets = Set(v2Of.values).union(["\(deployer).stx-subnet-v2", "\(deployer).usdcx-token-subnet-v2"])

    /// Every subnet an order can spend from or land on. Older releases (CHA's rc1, rc6…) aren't: they're never spent.
    public static let subnets = v1Subnets.union(v2Subnets)

    /// The Blaze version a subnet signs under, when it's one the wallet knows
    public static func version(of subnet: String) -> Int? {
        v2Subnets.contains(subnet) ? 2 : v1Subnets.contains(subnet) ? 1 : nil
    }

    /// Where a token paid into Blaze lands, among the subnets Charisma's list has for it: its v2 subnet (a token known
    /// only on v1 lands there). Nil when it has no subnet the wallet knows, so it has no Blaze side.
    public static func landing(among tokenSubnets: [String]) -> String? {
        tokenSubnets.first(where: v2Subnets.contains) ?? tokenSubnets.first(where: v1Subnets.contains)
    }

    /// Which subnet pays for something, by the balances on each of a token's subnets
    public enum Spend: Equatable, Sendable {
        /// This subnet holds the whole amount
        case from(String)
        /// Together they hold enough, but one order comes from one subnet and neither holds it alone
        case split
        /// Not enough on Blaze
        case short
    }

    /// Charisma Swap's planSpend, without topping up from the wallet: the v1 subnet first when it holds the amount
    /// (that's where older balances are), then v2
    public static func spend(_ amount: Int128, parts: [String: Int128]) -> Spend {
        let known = parts.compactMap { subnet, balance in version(of: subnet).map { (subnet: subnet, version: $0, balance: balance) } }
        if let payer = known.sorted(by: { $0.version < $1.version }).first(where: { $0.balance >= amount }) {
            return .from(payer.subnet)
        }
        return known.reduce(0) { $0 + $1.balance } >= amount ? .split : .short
    }

    /// What a token's subnets can spend: its v1 and v2 balances (older releases aren't spent)
    public static func spendable(_ parts: [String: Int128]) -> Int128 {
        parts.filter { version(of: $0.key) != nil }.values.reduce(0, +)
    }

    /// The most one order can spend: the larger of the v1 and v2 balances, since an order comes from one subnet
    public static func mostInOneOrder(_ parts: [String: Int128]) -> Int128 {
        parts.filter { version(of: $0.key) != nil }.values.max() ?? 0
    }

    /// A Blaze version's domain (blaze-sdk's BLAZE_V1_DOMAIN and BLAZE_V2_DOMAIN)
    static func domain(version: Int) -> ClarityValue {
        .tuple(["name": .stringAscii("BLAZE_PROTOCOL"), "version": .stringAscii("v\(version).0"), "chain-id": .uint(1)])
    }

    /// The signed message: `subnet` spends `amount` through the order router (blaze-sdk's triggeredSwapMessage)
    static func message(subnet: String, amount: UInt64, uuid: String) throws -> ClarityValue {
        .tuple([
            "contract": .principal(try Principal(subnet)),
            "intent": .stringAscii("TRANSFER_TOKENS"),
            "opcode": .none,
            "amount": .some(.uint(UInt128(amount))),
            "target": .some(.principal(try Principal(router))),
            "uuid": .stringAscii(uuid),
        ])
    }

    /// Signs and places an order: `amount` (smallest units) of `subnet`, for `outputToken`, paid to the account. Returns the
    /// order's uuid. A refusal throws the order service's reason.
    public static func place(subnet: String, outputToken: String, amount: UInt64, from account: Account) async throws -> String {
        let uuid = UUID().uuidString.lowercased()
        let fields = try order(
            subnet: subnet, outputToken: outputToken, amount: amount, owner: account.stxAddress,
            privateKey: Data(hex: account.privateKey), uuid: uuid
        )
        var request = URLRequest(url: ordersURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: fields)
        let (data, response) = try await http.answer(request, from: .swap)
        let answer = try? JSONDecoder().decode(Answer.self, from: data)
        guard (200..<300).contains(response.statusCode), answer?.status == "success" else {
            throw WalletError.unexpected("The order service didn't take the order: \(answer?.error ?? "HTTP \(response.statusCode)")")
        }
        return uuid
    }

    /// The order as the order service takes it: its fields, and the signature over the message under the subnet's own
    /// Blaze version. An immediate order: the '*' condition, as Charisma Swap sends for a manual swap.
    static func order(subnet: String, outputToken: String, amount: UInt64, owner: String, privateKey: Data, uuid: String) throws -> [String: Any] {
        guard let version = version(of: subnet) else {
            throw WalletError.unexpected("Blaze orders can only spend the Blaze subnets the wallet knows, not \(subnet)")
        }
        guard amount > 0 else { throw WalletError.unexpected("An order's amount must be above zero") }
        let signature = try StructuredData.sign(
            message: message(subnet: subnet, amount: amount, uuid: uuid), domain: domain(version: version), privateKey: privateKey
        )
        return [
            "owner": owner, "inputToken": subnet, "outputToken": outputToken, "amountIn": String(amount),
            "recipient": owner, "router": router, "signature": signature.hex, "uuid": uuid,
            "conditionToken": "*", "targetPrice": "0", "direction": "gt",
        ]
    }

    private struct Answer: Decodable {
        let status: String?
        let error: String?
    }
}
