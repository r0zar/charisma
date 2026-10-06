/**
 * The active account's balances, and sending them from the wallet. Balances are instant: Charisma's balance service
 * (the same one Swap and Meme Roulette use) reads the chain, adds what's on its way and sets aside what signed orders
 * hold. Names, decimals and logos come from Charisma's token cache (@repo/tokens).
 */
import { Cl, Pc, broadcastTransaction, makeContractCall, makeSTXTokenTransfer } from "@stacks/transactions"
import { getTokenMetadataStrict, lakehouseClient, listTokens } from "@repo/tokens"
// Types only: blaze-sdk's code pulls in @stacks/connect, which a service worker can't load
import type { BalanceSheet } from "blaze-sdk"
import * as wallet from "./wallet"
import { hiroClient } from "./hiro"

import { BALANCE_SERVICE } from "~shared/balance-service"

export const STX_ID = ".stx"

export interface TokenBalance {
  /** Contract id, or ".stx" */
  contractId: string
  /** Asset name inside the contract, needed for post conditions ("" for STX) */
  asset: string
  /** On Stacks (the wallet itself), ready to use, in the token's smallest unit: what sends spend */
  balance: string
  /** On Blaze: the token's subnets (v1, v2 and older releases) added up, ready to use, smallest units. Below zero
   *  when signed orders promise more than the wallet holds */
  blaze: string
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

async function readSheet(address: string): Promise<BalanceSheet> {
  const res = await fetch(`${BALANCE_SERVICE}/api/v1/balances/${address}/sheet`, { cache: "no-store" })
  if (!res.ok) throw new Error(`Couldn't load balances (${res.status})`)
  return res.json() as Promise<BalanceSheet>
}

/**
 * STX first, then every token with a balance on Stacks, on Blaze, or both. Uses `pushed` (a sheet the side panel's
 * live stream just received) when it's for the active account, and reads one otherwise.
 */
export async function getWalletBalances(pushed?: BalanceSheet): Promise<TokenBalance[]> {
  const { stxAddress } = await activeAccount()
  const sheet = pushed?.address === stxAddress ? pushed : await readSheet(stxAddress)
  // Charisma's token list: blocking a token (scripts/blocklist.mjs in token-cache) takes it off this list
  const list = await listTokens()
  if (list.length === 0) throw new Error("Charisma's token list is unavailable, so tokens can't be checked against the block list")
  const listed = new Set(list.map(token => token.contractId))
  const assetOf = (contractId: string) => list.find(token => token.contractId === contractId)?.identifier ?? ""

  // Subnet balances fold into their base token's row; a token held only on Blaze gets a row of its own
  const rows = new Map<string, { balance: bigint; blaze: bigint }>([[STX_ID, { balance: 0n, blaze: 0n }]])
  for (const [contractId, part] of Object.entries(sheet.tokens)) {
    if (part.ready === null) {
      // The chain couldn't be read for this one: a data problem for developers, not news for the user
      console.error(`[signet] Couldn't read ${contractId}'s balance: ${part.error}`)
      continue
    }
    const base = part.base ?? contractId
    const row = rows.get(base) ?? { balance: 0n, blaze: 0n }
    if (part.base) row.blaze += BigInt(part.ready)
    else row.balance += BigInt(part.ready)
    rows.set(base, row)
  }
  return Promise.all([...rows].filter(([id, row]) => id === STX_ID || row.balance !== 0n || row.blaze !== 0n).map(async ([contractId, row]) => ({
    contractId, asset: contractId === STX_ID ? "" : assetOf(contractId),
    balance: row.balance.toString(), blaze: row.blaze.toString(),
    meta: await tokenMeta(contractId), listed: contractId === STX_ID || listed.has(contractId),
  })))
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
