/**
 * Swaps: the side panel builds the router's swap call from a route (shared/trade/swap.ts), and this signs and sends
 * it. Before signing, the call must be the router's own swap, for the amount the person confirmed. Secrets stay here.
 */
import { ClarityType, Pc, broadcastTransaction, hexToCV, makeContractCall } from "@stacks/transactions"
import { hiroClient } from "./hiro"
import { ORDER_SUBNETS, orderMessage, signOrder, submitOrder } from "./blaze-orders"
import * as wallet from "./wallet"
import { WalletError } from "./wallet-error"

/** Charisma's router: the only contract a swap may call */
const ROUTER = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop"

export interface SwapCall {
  contract: string
  functionName: string
  /** Clarity hex, one per argument */
  args: string[]
  /** Clarity hex, one per post-condition */
  postConditions: string[]
  /** The input amount the person confirmed, in smallest units */
  amountIn: string
}

export async function sendSwap(call: SwapCall): Promise<{ txid: string }> {
  const account = await wallet.getCurrentAccount()
  if (!account) throw new WalletError("errorNoActiveAccount")
  if (call.contract !== ROUTER) throw new Error(`A swap must go through Charisma's router, not ${call.contract}`)
  if (!/^swap-[1-9]$/.test(call.functionName)) throw new Error(`Not a router swap: ${call.functionName}`)

  const args = call.args.map(hex => hexToCV(hex))
  const amount = args[0]
  if (!amount || amount.type !== ClarityType.UInt || amount.value !== BigInt(call.amountIn)) {
    throw new Error("The swap's amount isn't the one you confirmed")
  }

  const [contractAddress, contractName] = ROUTER.split(".")
  const transaction = await makeContractCall({
    contractAddress,
    contractName,
    functionName: call.functionName,
    functionArgs: args,
    postConditions: call.postConditions.map(hex => Pc.fromHex(hex)),
    postConditionMode: "deny",
    senderKey: account.privateKey,
    network: "mainnet",
    client: hiroClient,
  })

  const result = await broadcastTransaction({ transaction, network: "mainnet", client: hiroClient })
  if ("error" in result) throw new WalletError("errorRejected", [result.reason ?? result.error])
  return { txid: result.txid }
}

/**
 * A Blaze trade: spend `amountIn` of a Blaze subnet for `outputToken`, to the active account. The wallet signs the
 * order itself and the order API hands it to a solver. Only the wallet's own orders are signed: the subnet must be one
 * it orders through, and the payout goes to the signer.
 */
export async function placeBlazeOrder(order: { inputSubnet: string; outputToken: string; amountIn: string }): Promise<{ uuid: string }> {
  const account = await wallet.getCurrentAccount()
  if (!account) throw new WalletError("errorNoActiveAccount")
  if (!ORDER_SUBNETS.includes(order.inputSubnet)) throw new Error(`Blaze orders can only spend the Blaze subnets the wallet orders through, not ${order.inputSubnet}`)
  if (!order.outputToken) throw new Error("A Blaze order needs the token it pays out")
  if (!/^[1-9]\d*$/.test(order.amountIn)) throw new Error("A Blaze order's amount must be a whole number of smallest units above zero")

  const uuid = crypto.randomUUID()
  const signature = signOrder(orderMessage(order.inputSubnet, BigInt(order.amountIn), uuid), account.privateKey)
  await submitOrder({
    owner: account.stxAddress,
    inputToken: order.inputSubnet,
    outputToken: order.outputToken,
    amountIn: order.amountIn,
    recipient: account.stxAddress,
    signature,
    uuid,
  })
  return { uuid }
}
