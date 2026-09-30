/**
 * The active account's regular (on-chain) balances, and sending them from the wallet.
 * Balances come from Hiro; names, decimals and logos from Charisma's token cache (@repo/tokens).
 */
import { Cl, Pc, broadcastTransaction, makeContractCall, makeSTXTokenTransfer } from "@stacks/transactions"
import { getTokenMetadataStrict, lakehouseClient, listTokens } from "@repo/tokens"
import * as wallet from "./wallet"
import { hiroClient, hiroFetch } from "./hiro"

const HIRO = "https://api.hiro.so"
export const STX_ID = ".stx"

export interface TokenBalance {
  /** Contract id, or ".stx" */
  contractId: string
  /** Asset name inside the contract, needed for post conditions ("" for STX) */
  asset: string
  /** Raw amount in the token's smallest unit */
  balance: string
  /** Null when the token cache doesn't know the token: shown raw and not sendable */
  meta: { symbol: string; name: string; decimals: number; image: string | null } | null
  /** On Charisma's token list. Blocked tokens (scams) and unknown airdrops are not, and the wallet tucks them away. */
  listed: boolean
}

async function activeAccount() {
  const account = await wallet.getCurrentAccount()
  if (!account) throw new Error("Blaze Wallet has no active account")
  return account
}

/** Strict lookup: a token with unknown details is shown in raw units and can't be sent, never guessed */
async function tokenMeta(contractId: string): Promise<TokenBalance["meta"]> {
  try {
    const data = await getTokenMetadataStrict(contractId)
    return { symbol: data.symbol, name: data.name, decimals: data.decimals, image: data.image ?? null }
  } catch (error) {
    console.error(`[signet] ${(error as Error).message}`)
    return null
  }
}

/** STX first, then every token with a balance */
export async function getWalletBalances(): Promise<TokenBalance[]> {
  const { stxAddress } = await activeAccount()
  const res = await hiroFetch(`${HIRO}/extended/v1/address/${stxAddress}/balances`)
  if (!res.ok) throw new Error(`Could not load balances (Hiro ${res.status})`)
  const data = await res.json() as {
    stx: { balance: string; locked: string }
    fungible_tokens: Record<string, { balance: string }>
  }

  const held = Object.entries(data.fungible_tokens).filter(([, { balance }]) => BigInt(balance) > 0n)
  // Charisma's token list: blocking a token (scripts/blocklist.mjs in token-cache) takes it off this list
  const list = await listTokens()
  if (list.length === 0) throw new Error("Charisma's token list is unavailable, so tokens can't be checked against the block list")
  const listed = new Set(list.map(token => token.contractId))
  const spendableStx = (BigInt(data.stx.balance) - BigInt(data.stx.locked)).toString()
  // The token cache knows STX too (".stx"), logo included
  return Promise.all([
    [`${STX_ID}::`, { balance: spendableStx }] as const,
    ...held
  ].map(async ([key, { balance }]) => {
    const [contractId, asset] = key.split("::")
    return { contractId, asset, balance, meta: await tokenMeta(contractId), listed: contractId === STX_ID || listed.has(contractId) }
  }))
}

/** USD price per whole token, by contract id (".stx" for STX), from the same feed the swap app uses */
export async function getUsdPrices(): Promise<Record<string, number>> {
  const prices = await lakehouseClient.getCurrentPrices({ limit: 1000 })
  return Object.fromEntries(prices.map(price => [price.token_contract_id, price.usd_price]))
}

/** Send `amount` (smallest units) of a token; SIP-10 sends carry a post condition: exactly this amount leaves. */
export async function sendToken(request: { contractId: string; asset: string; recipient: string; amount: string; memo?: string }) {
  const account = await activeAccount()
  const amount = BigInt(request.amount)
  if (amount <= 0n) throw new Error("Amount must be more than zero")

  const common = { senderKey: account.privateKey, network: "mainnet" as const, client: hiroClient }
  const transaction = request.contractId === STX_ID
    ? await makeSTXTokenTransfer({ ...common, recipient: request.recipient, amount, memo: request.memo ?? "" })
    : await makeContractCall({
        ...common,
        contractAddress: request.contractId.split(".")[0],
        contractName: request.contractId.split(".")[1],
        functionName: "transfer",
        functionArgs: [
          Cl.uint(amount),
          Cl.principal(account.stxAddress),
          Cl.principal(request.recipient),
          request.memo ? Cl.some(Cl.bufferFromUtf8(request.memo)) : Cl.none()
        ],
        postConditions: [Pc.principal(account.stxAddress).willSendEq(amount).ft(request.contractId as `${string}.${string}`, request.asset)],
        postConditionMode: "deny"
      })

  const result = await broadcastTransaction({ transaction, network: "mainnet", client: hiroClient })
  if ("error" in result) throw new Error(`The network rejected the transfer: ${result.reason ?? result.error}`)
  return { txid: result.txid }
}
