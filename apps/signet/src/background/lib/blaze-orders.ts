/**
 * Blaze orders: a swap the wallet signs (SIP-018) for a Blaze subnet, which Charisma's order API takes for a solver to
 * fill. Pure functions, so the signature can be checked against blaze-sdk. swap.ts holds the account and calls these.
 */
import { Cl, signStructuredData, type ClarityValue } from "@stacks/transactions"

/** Charisma's order API: takes signed orders for solvers */
const ORDERS_URL = "https://swap.charisma.rocks/api/v1/orders/new"

/** The router an order names. It pays out only to whoever signed the order (blaze-sdk's SIGNER_PAYOUT_ROUTER) */
export const ORDER_ROUTER = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v2"

/** The routers that only pay out to the signer (blaze-sdk's SIGNER_ONLY_ROUTERS) */
const SIGNER_ONLY_ROUTERS = [ORDER_ROUTER, "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v1"]

/**
 * The v2 Blaze subnets the wallet orders through. Only STX and USDCx have exactly one Blaze subnet, so only they get
 * the Blaze switch on the Trade screen.
 */
export const ORDER_SUBNETS = [
  "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-subnet-v2",
  "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.usdcx-token-subnet-v2",
]

/**
 * The Blaze protocol's SIP-018 domain: blaze-sdk's BLAZE_V1_DOMAIN and BLAZE_V2_DOMAIN. Written out here because
 * blaze-sdk's entry pulls in @stacks/connect, which a service worker can't load.
 */
export const blazeDomain = (version: string) =>
  Cl.tuple({ name: Cl.stringAscii("BLAZE_PROTOCOL"), version: Cl.stringAscii(version), "chain-id": Cl.uint(1) })

/** A swap order, as blaze-sdk's signTriggeredSwaps makes them: an amount, spent only through a router that pays the signer */
export function isSwapOrder(message: ClarityValue) {
  if (message.type !== "tuple") return false
  const { intent, opcode, amount, target } = message.value
  return intent?.type === "ascii" && intent.value === "TRANSFER_TOKENS"
    && opcode?.type === "none"
    && amount?.type === "some" && amount.value.type === "uint"
    && target?.type === "some" && target.value.type === "contract" && SIGNER_ONLY_ROUTERS.includes(target.value.value)
}

/** The signed message: `subnet` spends `amount` through the order router (blaze-sdk's triggeredSwapMessage) */
export function orderMessage(subnet: string, amount: bigint, uuid: string) {
  return Cl.tuple({
    contract: Cl.principal(subnet),
    intent: Cl.stringAscii("TRANSFER_TOKENS"),
    opcode: Cl.none(),
    amount: Cl.some(Cl.uint(amount)),
    target: Cl.some(Cl.principal(ORDER_ROUTER)),
    uuid: Cl.stringAscii(uuid),
  })
}

/** The SIP-018 signature the order API checks: 65 bytes of hex, without 0x. Signing is deterministic, so the same key and message always give the same signature. */
export function signOrder(message: ClarityValue, privateKey: string): string {
  return signStructuredData({ message, domain: blazeDomain("v2.0"), privateKey })
}

/** A signed order, as the order API takes it */
export interface SignedOrder {
  owner: string
  inputToken: string
  outputToken: string
  amountIn: string
  recipient: string
  signature: string
  uuid: string
}

/** Sends a signed order: an immediate one (the '*' condition, as simple-swap sends for a manual swap). Throws the service's reason. */
export async function submitOrder(order: SignedOrder): Promise<void> {
  const res = await fetch(ORDERS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...order, router: ORDER_ROUTER, conditionToken: "*", targetPrice: "0", direction: "gt" }),
  })
  const body = (await res.json().catch(() => null)) as { status?: string; error?: string } | null
  if (!res.ok || body?.status !== "success") throw new Error(`The order service didn't take the order: ${body?.error ?? `HTTP ${res.status}`}`)
}
