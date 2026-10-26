import Foundation
import StacksKit
import Testing
@testable import WalletCore

/// A Standard → Blaze deposit: the STX → STX subnet route the quote returned, one SUBLINK hop with opcode 5 (deposit).
/// The router's call and its post-condition must match the router's builder (dexterity-sdk) byte for byte.
struct SwapDepositTests {
    static let sender = "SP2ADT4TAV92SPBNP3WE9GPJ12F6CKGWMEJ1H1BB9"

    static let routeJSON = #"""
    {"path":[{"contractId":".stx","name":"Stacks Token","description":"The native token of the Stacks blockchain.","image":"https://charisma.rocks/stx-logo.png","lastUpdated":null,"decimals":6,"symbol":"STX","token_uri":null,"contract_principal":".stx","error":"partially defaulted","identifier":"STX","total_supply":null,"tokenAContract":null,"tokenBContract":null,"type":"","lpRebatePercent":null,"externalPoolId":null,"engineContractId":null,"sip":10,"lastRefreshed":1746338620856},{"contractId":"SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-subnet-v2","name":"Stacks","symbol":"STX","decimals":6,"identifier":"STX","description":"STX on Blaze v2: hold STX in Blaze for instant, signed swaps and triggered orders.","image":"https://charisma.rocks/stx-logo.png","type":"SUBNET","base":".stx"}],"hops":[{"vault":{"type":"SUBLINK","protocol":"CHARISMA","contractId":"SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-sublink-v2","contractAddress":"SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS","contractName":"stx-sublink-v2","name":"STX Sublink v2","symbol":"STX-SL2","decimals":6,"identifier":"sublink","description":"The STX link between Stacks and Blaze v2","image":"https://kghatiwehgh3dclz.public.blob.vercel-storage.com/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS-PamxzZjNXINO0lsGfPZn9S4i1bkTQy.sub-link-1746103201292","fee":0,"externalPoolId":"SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-subnet-v2","engineContractId":"","tokenA":{"contractId":".stx","name":"Stacks Token","symbol":"STX","decimals":6,"identifier":"STX","description":"The native token of the Stacks blockchain.","image":"https://charisma.rocks/stx-logo.png","type":"","base":null},"reservesA":230666809,"tokenB":{"contractId":"SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-subnet-v2","name":"Stacks","symbol":"STX","decimals":6,"identifier":"STX","description":"STX on Blaze v2: hold STX in Blaze for instant, signed swaps and triggered orders.","image":"https://charisma.rocks/stx-logo.png","type":"SUBNET","base":".stx"},"reservesB":0,"tokenBContract":"SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-subnet-v2","reservesLastUpdatedAt":1792987816255},"tokenIn":{"contractId":".stx","name":"Stacks Token","description":"The native token of the Stacks blockchain.","image":"https://charisma.rocks/stx-logo.png","lastUpdated":null,"decimals":6,"symbol":"STX","token_uri":null,"contract_principal":".stx","error":"partially defaulted","identifier":"STX","total_supply":null,"tokenAContract":null,"tokenBContract":null,"type":"","lpRebatePercent":null,"externalPoolId":null,"engineContractId":null,"sip":10,"lastRefreshed":1746338620856},"tokenOut":{"contractId":"SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-subnet-v2","name":"Stacks","symbol":"STX","decimals":6,"identifier":"STX","description":"STX on Blaze v2: hold STX in Blaze for instant, signed swaps and triggered orders.","image":"https://charisma.rocks/stx-logo.png","type":"SUBNET","base":".stx"},"opcode":5,"quote":{"amountIn":1000000,"amountOut":1000000}}],"amountIn":1000000,"amountOut":1000000}
    """#

    static let sdkArguments = ["0x01000000000000000000000000000f4240","0x0c00000002066f70636f64650a02000000100500000000000000000000000000000004706f6f6c0616bf584905755be35f11b96c2691fd9c3fc64f4b160e7374782d7375626c696e6b2d7632"]

    static let sdkPostConditions = ["00021694dd134ada459b2eb61f1c985a4113ccc9c394740500000000000f6950"]

    @Test func depositsIntoTheSubnetAsTheSDKDoes() throws {
        let route = try JSONDecoder().decode(Swap.Route.self, from: Data(Self.routeJSON.utf8))
        #expect(route.hops.map(\.opcode) == [5])
        let call = try Swap.call(for: route, sender: try StacksAddress(Self.sender))
        #expect(call.functionName == "swap-1")
        #expect(call.arguments.map { "0x" + $0.serialized.hex } == Self.sdkArguments)
        #expect(call.postConditions.map { $0.serialized.hex } == Self.sdkPostConditions)
    }
}
