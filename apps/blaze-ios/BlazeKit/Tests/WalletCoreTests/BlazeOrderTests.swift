import Foundation
import StacksKit
import Testing
@testable import WalletCore

/// Vectors from the extension's blaze-orders.ts and blaze-sdk (serialized and signed with @stacks/transactions), for
/// the key 1
@Suite struct BlazeOrderTests {
    static let key = Data(repeating: 0, count: 31) + Data([1])
    static let owner = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS"
    static let uuid = "5f1c2a3e-8b7d-4e6f-9a0b-1c2d3e4f5a6b"
    static let subnet = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-subnet-v2"
    static let chaV1 = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1"
    static let chaV2 = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v2"
    static let chaRc6 = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-rc6"

    @Test func domainsMatchBlazeSDK() {
        #expect(BlazeOrder.domain(version: 2).serialized.hex == "0c0000000308636861696e2d69640100000000000000000000000000000001046e616d650d0000000e424c415a455f50524f544f434f4c0776657273696f6e0d0000000476322e30")
        #expect(BlazeOrder.domain(version: 1).serialized.hex == "0c0000000308636861696e2d69640100000000000000000000000000000001046e616d650d0000000e424c415a455f50524f544f434f4c0776657273696f6e0d0000000476312e30")
    }

    @Test func messageMatchesTheExtension() throws {
        let message = try BlazeOrder.message(subnet: Self.subnet, amount: 1_000_000, uuid: Self.uuid)
        #expect(message.serialized.hex == "0c0000000606616d6f756e740a01000000000000000000000000000f424008636f6e74726163740616bf584905755be35f11b96c2691fd9c3fc64f4b160d7374782d7375626e65742d763206696e74656e740d0000000f5452414e534645525f544f4b454e53066f70636f646509067461726765740a0616bf584905755be35f11b96c2691fd9c3fc64f4b160d782d6d756c7469686f702d763204757569640d0000002435663163326133652d386237642d346536662d396130622d316332643365346635613662")
    }

    @Test func v2SignatureMatchesTheExtension() throws {
        let message = try BlazeOrder.message(subnet: Self.subnet, amount: 1_000_000, uuid: Self.uuid)
        let signature = try StructuredData.sign(message: message, domain: BlazeOrder.domain(version: 2), privateKey: Self.key)
        #expect(signature.count == 65)
        #expect(signature.hex == "6fccc28b499bfb64216de9e7c63d1c89f43f00b309f264246b94db006a18d0b01aeb7f301cdcda1a029c3095904e6a1db2074db8d510d3eb6735ccccc55ae5af00")
    }

    @Test func v1OrderIsSignedUnderTheV1DomainAsBlazeSDKSignsIt() throws {
        let order = try BlazeOrder.order(
            subnet: Self.chaV1, outputToken: ".stx", amount: 1_000_000, owner: Self.owner, privateKey: Self.key, uuid: Self.uuid
        )
        #expect(order["signature"] as? String == "ecd6f4d3cac86315789253ec2fc4bba5cb4591e6b6203e8964a871fb975ae6a869383309506656f5be457a98c243dad946ee837815b7a97ba206915c621def0600")
        #expect(order["router"] as? String == BlazeOrder.router)
    }

    @Test func orderPayloadIsAnImmediateOrderPaidToTheSigner() throws {
        let order = try BlazeOrder.order(
            subnet: Self.subnet, outputToken: ".stx", amount: 1_000_000, owner: Self.owner, privateKey: Self.key, uuid: Self.uuid
        )
        #expect(order["owner"] as? String == Self.owner)
        #expect(order["recipient"] as? String == Self.owner)
        #expect(order["inputToken"] as? String == Self.subnet)
        #expect(order["outputToken"] as? String == ".stx")
        #expect(order["amountIn"] as? String == "1000000")
        #expect(order["router"] as? String == BlazeOrder.router)
        #expect(order["conditionToken"] as? String == "*")
        #expect(order["targetPrice"] as? String == "0")
        #expect(order["direction"] as? String == "gt")
        #expect(order["uuid"] as? String == Self.uuid)
        #expect(order["signature"] as? String == "6fccc28b499bfb64216de9e7c63d1c89f43f00b309f264246b94db006a18d0b01aeb7f301cdcda1a029c3095904e6a1db2074db8d510d3eb6735ccccc55ae5af00")
    }

    @Test func knowsEveryBlazeSDKSubnet() {
        // blaze-sdk: 16 v1 subnets with a v2 successor, and 18 v2 subnets (those 16, STX and USDCx)
        #expect(BlazeOrder.v1Subnets.count == 16)
        #expect(BlazeOrder.v2Subnets.count == 18)
        #expect(BlazeOrder.version(of: Self.chaV1) == 1)
        #expect(BlazeOrder.version(of: Self.chaV2) == 2)
        #expect(BlazeOrder.version(of: Self.chaRc6) == nil)
    }

    @Test func landsOnV2() {
        #expect(BlazeOrder.landing(among: [Self.chaV1, Self.chaRc6, Self.chaV2]) == Self.chaV2)
        #expect(BlazeOrder.landing(among: [Self.subnet]) == Self.subnet)
        #expect(BlazeOrder.landing(among: [Self.chaRc6]) == nil)
    }

    @Test func spendsFromV1FirstThenV2() {
        #expect(BlazeOrder.spend(5, parts: [Self.chaV1: 10, Self.chaV2: 10]) == .from(Self.chaV1))
        #expect(BlazeOrder.spend(15, parts: [Self.chaV1: 10, Self.chaV2: 20]) == .from(Self.chaV2))
        #expect(BlazeOrder.spend(25, parts: [Self.chaV1: 10, Self.chaV2: 20]) == .split)
        #expect(BlazeOrder.spend(35, parts: [Self.chaV1: 10, Self.chaV2: 20]) == .short)
        // An older release's balance is never spent
        #expect(BlazeOrder.spend(5, parts: [Self.chaRc6: 100]) == .short)
        #expect(BlazeOrder.spendable([Self.chaV1: 10, Self.chaV2: 20, Self.chaRc6: 100]) == 30)
        #expect(BlazeOrder.mostInOneOrder([Self.chaV1: 10, Self.chaV2: 20, Self.chaRc6: 100]) == 20)
    }

    @Test func refusesASubnetTheWalletDoesNotKnow() {
        #expect(throws: (any Error).self) {
            try BlazeOrder.order(subnet: Self.chaRc6, outputToken: ".stx", amount: 1, owner: Self.owner, privateKey: Self.key, uuid: Self.uuid)
        }
    }

    @Test func refusesAZeroAmount() {
        #expect(throws: (any Error).self) {
            try BlazeOrder.order(subnet: Self.subnet, outputToken: ".stx", amount: 0, owner: Self.owner, privateKey: Self.key, uuid: Self.uuid)
        }
    }
}
