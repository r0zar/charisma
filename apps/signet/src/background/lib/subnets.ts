/**
 * Blaze subnet balances: every subnet on Charisma's token list (type SUBNET) and an address's balance on each, read
 * straight from the subnet contract. The Tokens tab and Status both use them, so a read is kept for a minute rather
 * than each asking ~35 contracts again (Hiro rate-limits the extension, which has no API key).
 */
import type { TokenCacheData } from "@repo/tokens"
import { Cl, cvToValue, fetchCallReadOnlyFunction } from "@stacks/transactions"
import { hiroClient } from "./hiro"

export interface SubnetBalance {
  contractId: string
  symbol: string
  decimals: number
  /** The on-chain token it holds, when the token list says (".stx" for STX) */
  base: string | null
  /** Smallest units, or null when the read failed (logged for developers) */
  balance: string | null
}

const KEEP_MS = 60_000

/** Map over items a few at a time, so a burst of reads doesn't trip Hiro's rate limit */
async function inBatches<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += size) {
    results.push(...await Promise.all(items.slice(i, i + size).map(work)))
  }
  return results
}

async function readBalance(contractId: string, address: string): Promise<string> {
  const [contractAddress, contractName] = contractId.split(".")
  const result = await fetchCallReadOnlyFunction({
    contractAddress, contractName, functionName: "get-balance",
    functionArgs: [Cl.principal(address)], senderAddress: address, network: "mainnet", client: hiroClient
  })
  const value = cvToValue(result)
  // get-balance returns a uint, or (ok uint) on some subnets
  const raw = typeof value === "object" && value !== null && "value" in value ? value.value : value
  return BigInt(raw).toString()
}

/** The token list calls STX's base "stx"; the wallet calls STX ".stx" */
const baseId = (base: string | null | undefined) => (!base ? null : base === "stx" || base === ".stx" ? ".stx" : base)

const kept = new Map<string, { at: number; balances: Promise<SubnetBalance[]> }>()

/** This address's balance on every subnet in `list` (Charisma's token list) */
export function subnetBalances(address: string, list: TokenCacheData[]): Promise<SubnetBalance[]> {
  const hit = kept.get(address)
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.balances
  const balances = inBatches(list.filter(token => token.type === "SUBNET"), 4, async (token): Promise<SubnetBalance> => {
    const entry = { contractId: token.contractId, symbol: token.symbol, decimals: token.decimals, base: baseId(token.base) }
    try {
      return { ...entry, balance: await readBalance(token.contractId, address) }
    } catch (error) {
      // A subnet that can't be read is a token-list data bug for developers to fix, not news for the user
      console.error(`[signet] Couldn't read ${token.contractId}'s balance: ${(error as Error).message}`)
      return { ...entry, balance: null }
    }
  })
  kept.set(address, { at: Date.now(), balances })
  balances.catch(() => kept.delete(address))
  return balances
}

/** Each base token's total across its subnets (v1, v2 and older releases), smallest units */
export function blazeTotals(balances: SubnetBalance[]): Map<string, bigint> {
  const totals = new Map<string, bigint>()
  for (const { base, balance } of balances) {
    if (!base || !balance || balance === "0") continue
    totals.set(base, (totals.get(base) ?? 0n) + BigInt(balance))
  }
  return totals
}
