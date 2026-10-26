/**
 * Blaze orders: a swap the wallet signs (SIP-018) for a Blaze subnet, which Charisma's order API takes for a solver to
 * fill. Pure functions, so the signature can be checked against blaze-sdk. swap.ts holds the account and calls these.
 *
 * During the Blaze v2 migration a token can live in two subnets, as Charisma Swap pays them (lib/subnet-pairs.ts): v1,
 * where older balances are and which is spent first, and v2, where anything paid into Blaze lands. STX and USDCx only
 * have v2.
 */
import { Cl, signStructuredData, type ClarityValue } from "@stacks/transactions"

/** Charisma's order API: takes signed orders for solvers */
const ORDERS_URL = "https://swap.charisma.rocks/api/v1/orders/new"

/** The router an order names, for v1 and v2 subnets alike. It pays out only to whoever signed the order. */
export const ORDER_ROUTER = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v2"

/** The routers that only pay out to the signer (blaze-sdk's SIGNER_ONLY_ROUTERS) */
const SIGNER_ONLY_ROUTERS = [ORDER_ROUTER, "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v1"]

const DEPLOYER = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS"

/** Each Blaze v1 subnet and its v2 successor (blaze-sdk's SUBNET_V2_OF) */
const V2_OF: Record<string, string> = {
  [`${DEPLOYER}.charisma-token-subnet-v1`]: `${DEPLOYER}.charisma-token-subnet-v2`,
  [`${DEPLOYER}.welsh-token-subnet-v1`]: `${DEPLOYER}.welsh-token-subnet-v2`,
  [`${DEPLOYER}.sbtc-token-subnet-v1`]: `${DEPLOYER}.sbtc-token-subnet-v2`,
  [`${DEPLOYER}.dmtoken-subnet`]: `${DEPLOYER}.dmt-token-subnet-v2`,
  [`${DEPLOYER}.kangaroo-subnet`]: `${DEPLOYER}.roo-token-subnet-v2`,
  [`${DEPLOYER}.leo-token-subnet-v1`]: `${DEPLOYER}.leo-token-subnet-v2`,
  [`${DEPLOYER}.pepe-token-subnet-v1`]: `${DEPLOYER}.pepe-token-subnet-v2`,
  [`${DEPLOYER}.zest-token-subnet`]: `${DEPLOYER}.zest-token-subnet-v2`,
  [`${DEPLOYER}.token-aeusdc-subnet`]: `${DEPLOYER}.aeusdc-token-subnet-v2`,
  [`${DEPLOYER}.usda-token-subnet`]: `${DEPLOYER}.usda-token-subnet-v2`,
  [`${DEPLOYER}.usdh-token-v1-subnet`]: `${DEPLOYER}.usdh-token-subnet-v2`,
  [`${DEPLOYER}.susdh-token-subnet-v1`]: `${DEPLOYER}.susdh-token-subnet-v2`,
  [`${DEPLOYER}.nope-subnet`]: `${DEPLOYER}.nope-token-subnet-v2`,
  [`${DEPLOYER}.skullcoin-stxcity-subnet`]: `${DEPLOYER}.skull-token-subnet-v2`,
  [`${DEPLOYER}.hooter-the-owl-subnet`]: `${DEPLOYER}.hoot-token-subnet-v2`,
  // World Peace Stacks' v1 subnet was deployed by its own team; Charisma deployed the v2
  "SP2KGJEAZRDVK78ZWTRGSDE11A1VMZVEATNQFZ73C.world-peace-stacks-stxcity-subnet": `${DEPLOYER}.wps-token-subnet-v2`,
}

/** Every Blaze v1 subnet (blaze-sdk's V1_SUBNETS) */
export const V1_SUBNETS = Object.keys(V2_OF)

/** Every Blaze v2 subnet (blaze-sdk's BLAZE_V2_SUBNETS) */
export const V2_SUBNETS = [...Object.values(V2_OF), `${DEPLOYER}.stx-subnet-v2`, `${DEPLOYER}.usdcx-token-subnet-v2`]

/** The Blaze version a subnet signs under, when it's one the wallet knows. Older releases (CHA's rc1, rc6…) aren't. */
export const blazeVersionOf = (subnet: string): 1 | 2 | null =>
  V2_SUBNETS.includes(subnet) ? 2 : V1_SUBNETS.includes(subnet) ? 1 : null

/** Where a token paid into Blaze lands, among its subnets on Charisma's list: its v2 subnet (a v1-only token, its v1) */
export const landingSubnet = (subnets: string[]): string | undefined =>
  subnets.find(subnet => V2_SUBNETS.includes(subnet)) ?? subnets.find(subnet => V1_SUBNETS.includes(subnet))

/** Which subnet pays: one that holds the whole amount, else "split" (enough together, but one order is one subnet) or "short" */
export type Spend = { subnet: string } | "split" | "short"

/**
 * Charisma Swap's planSpend, without topping up from the wallet: the v1 subnet first when it holds the amount (that's
 * where older balances are), then v2. `parts` is a token's Blaze balance by subnet, in smallest units.
 */
export function spendFrom(amount: bigint, parts: Record<string, string>): Spend {
  const known = Object.entries(parts)
    .map(([subnet, balance]) => ({ subnet, version: blazeVersionOf(subnet), balance: BigInt(balance) }))
    .filter(part => part.version !== null)
    .sort((a, b) => (a.version ?? 0) - (b.version ?? 0))
  const payer = known.find(part => part.balance >= amount)
  if (payer) return { subnet: payer.subnet }
  return known.reduce((sum, part) => sum + part.balance, 0n) >= amount ? "split" : "short"
}

/** What a token's subnets can spend: its v1 and v2 balances (older releases aren't spent) */
export const spendable = (parts: Record<string, string>): bigint =>
  Object.entries(parts).reduce((sum, [subnet, balance]) => (blazeVersionOf(subnet) ? sum + BigInt(balance) : sum), 0n)

/** The most one order can spend: the larger of the v1 and v2 balances */
export const mostInOneOrder = (parts: Record<string, string>): bigint =>
  Object.entries(parts).reduce((most, [subnet, balance]) => (blazeVersionOf(subnet) && BigInt(balance) > most ? BigInt(balance) : most), 0n)

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

/**
 * The SIP-018 signature the order API checks, under the subnet's own Blaze version: 65 bytes of hex, without 0x.
 * Signing is deterministic, so the same key and message always give the same signature.
 */
export function signOrder(message: ClarityValue, privateKey: string, version: 1 | 2): string {
  return signStructuredData({ message, domain: blazeDomain(`v${version}.0`), privateKey })
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
