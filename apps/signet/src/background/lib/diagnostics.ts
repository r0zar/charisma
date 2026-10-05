/**
 * Real numbers for the Status tab: the Stacks network, Charisma's token list, every Blaze subnet with this account's
 * balance on it (read from the subnet contract, shared with the Tokens tab), and the lock timer.
 */
import { listTokens } from "@repo/tokens"
import * as wallet from "./wallet"
import { hiroFetch } from "./hiro"
import { subnetBalances, type SubnetBalance } from "./subnets"

const HIRO = "https://api.hiro.so"

export type SubnetDiagnostic = SubnetBalance

export interface Diagnostics {
  checkedAt: number
  network: { blockHeight: number; latencyMs: number }
  tokenCache: { latencyMs: number; tokens: number }
  subnets: SubnetDiagnostic[]
  account: { address: string; lockExpiresAt: number | null }
}

async function timed<T>(work: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const start = performance.now()
  const value = await work()
  return { value, latencyMs: Math.round(performance.now() - start) }
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

  const subnets = await subnetBalances(account.stxAddress, cache.value)

  return {
    checkedAt: Date.now(),
    network: { blockHeight: network.value.stacks_tip_height, latencyMs: network.latencyMs },
    tokenCache: { latencyMs: cache.latencyMs, tokens: cache.value.length },
    subnets,
    account: { address: account.stxAddress, lockExpiresAt: await wallet.lockExpiresAt() }
  }
}
