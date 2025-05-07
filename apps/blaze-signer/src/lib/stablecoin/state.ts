import { kv } from "@vercel/kv"

const HASH_KEY = "stablecoin:balances"
const HASH_STABLE = "stablecoin:stable" // tracks minted stable tokens per user (USD units * 10^2?)
const KEY_FEES_TOKEN = "stablecoin:fees:token" // integer token collected as fees
const KEY_FEES_USD = "stablecoin:fees:usd" // integer cents collected

export async function getBalance(addr: string): Promise<number> {
    const val = await kv.hget(HASH_KEY, addr) as string | null
    return val ? Number(val) : 0
}

export async function addBalance(addr: string, delta: number): Promise<void> {
    await kv.hincrby(HASH_KEY, addr, delta)
}

export async function subBalance(addr: string, delta: number): Promise<boolean> {
    const current = await getBalance(addr)
    if (current < delta) return false
    await kv.hincrby(HASH_KEY, addr, -delta)
    return true
}

export async function reset(): Promise<void> {
    await Promise.all([
        kv.del(HASH_KEY),
        kv.del(HASH_STABLE),
        kv.del(KEY_FEES_TOKEN),
        kv.del(KEY_FEES_USD)
    ])
}

export async function totalSupply(): Promise<number> {
    const vals = await kv.hvals(HASH_KEY) as string[]
    return vals.reduce((sum: number, v: string) => sum + Number(v), 0)
}

// Stable token helpers (stored as integer cents for accuracy)
export async function getStable(addr: string): Promise<number> {
    const val = await kv.hget(HASH_STABLE, addr) as string | null
    return val ? Number(val) : 0
}

export async function addStable(addr: string, delta: number): Promise<void> {
    await kv.hincrby(HASH_STABLE, addr, delta)
}

export async function subStable(addr: string, delta: number): Promise<boolean> {
    const current = await getStable(addr)
    if (current < delta) return false
    await kv.hincrby(HASH_STABLE, addr, -delta)
    return true
}

export async function totalStableSupply(): Promise<number> {
    const vals = await kv.hvals(HASH_STABLE) as string[]
    return vals.reduce((s, v) => s + Number(v), 0)
}

// --------- Fee pool helpers ---------
export async function addTokenFees(delta: number): Promise<void> {
    await kv.incrby(KEY_FEES_TOKEN, delta)
}

export async function getTokenFees(): Promise<number> {
    const v = await kv.get(KEY_FEES_TOKEN) as string | null
    return v ? Number(v) : 0
}

export async function addUsdFees(delta: number): Promise<void> {
    await kv.incrby(KEY_FEES_USD, delta)
}

export async function getUsdFees(): Promise<number> {
    const v = await kv.get(KEY_FEES_USD) as string | null
    return v ? Number(v) : 0
} 