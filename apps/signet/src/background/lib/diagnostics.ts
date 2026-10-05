/**
 * Real numbers for the Diagnostics hologram: the Stacks network, Charisma's token cache, every Blaze subnet
 * with this account's balance on it (read from the subnet contract, like the swap app), and the lock timer.
 */
import { listTokens } from "@repo/tokens"
import { Cl, cvToValue, fetchCallReadOnlyFunction } from "@stacks/transactions"
import * as wallet from "./wallet"
import { hiroClient, hiroFetch } from "./hiro"

const HIRO = "https://api.hiro.so"

export interface SubnetDiagnostic {
  contractId: string
  symbol: string
  decimals: number
  /** The on-chain token it holds, when the token cache says */
  base: string | null
  /** This account's balance in smallest units, or null when the read failed (logged for developers) */
  balance: string | null
}

export interface Diagnostics {
  checkedAt: number
  network: { blockHeight: number; latencyMs: number }
  tokenCache: { latencyMs: number; tokens: number }
  subnets: SubnetDiagnostic[]
  account: { address: string; lockExpiresAt: number | null }
}

/** Map over items a few at a time, so a burst of reads doesn't trip Hiro's rate limit */
async function inBatches<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += size) {
    results.push(...await Promise.all(items.slice(i, i + size).map(work)))
  }
  return results
}

async function timed<T>(work: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const start = performance.now()
  const value = await work()
  return { value, latencyMs: Math.round(performance.now() - start) }
}

async function subnetBalance(contractId: string, address: string): Promise<string> {
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

export async function getDiagnostics(): Promise<Diagnostics> {
  const account = await wallet.getCurrentAccount()
  if (!account) throw new Error("Blaze Wallet has no active account")

  const [network, cache] = await Promise.all([
    timed(async () => {
      const res = await hiroFetch(`${HIRO}/v2/info`)
      if (!res.ok) throw new Error(`Stacks network unavailable (Hiro ${res.status})`)
      return (await res.json()) as { stacks_tip_height: number }
    }),
    timed(listTokens)
  ])
  // listTokens returns [] when the cache fails; there is always at least STX-paired tokens when it works
  if (cache.value.length === 0) throw new Error("Charisma's token cache returned no tokens")

  const subnetTokens = cache.value.filter(token => token.type === "SUBNET")
  const subnets = await inBatches(subnetTokens, 4, async (token): Promise<SubnetDiagnostic> => {
    const base = (token as { base?: string | null }).base ?? null
    const entry = { contractId: token.contractId, symbol: token.symbol, decimals: token.decimals, base }
    try {
      return { ...entry, balance: await subnetBalance(token.contractId, account.stxAddress) }
    } catch (error) {
      // A subnet that can't be read is a token-cache data bug for developers to fix, not news for the user
      console.error(`[signet] Couldn't read ${token.contractId}'s balance: ${(error as Error).message}`)
      return { ...entry, balance: null }
    }
  })

  return {
    checkedAt: Date.now(),
    network: { blockHeight: network.value.stacks_tip_height, latencyMs: network.latencyMs },
    tokenCache: { latencyMs: cache.latencyMs, tokens: cache.value.length },
    subnets,
    account: { address: account.stxAddress, lockExpiresAt: await wallet.lockExpiresAt() }
  }
}
