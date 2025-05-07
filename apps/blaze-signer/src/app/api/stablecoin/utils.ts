import { listPrices, getTokenMetadataCached } from "@repo/tokens"

export async function getTokenPrice(contractId: string): Promise<number> {
    const prices = await listPrices()
    const price = prices[contractId]
    if (!price) throw new Error("Price unavailable for token")
    return price
}

export async function getTokenDecimals(contractId: string): Promise<number> {
    const meta = await getTokenMetadataCached(contractId)
    return meta.decimals || 0
}

export function usdToTokens(usd: number, price: number, decimals: number): number {
    const factor = 10 ** decimals
    const tokens = (usd / price) * factor
    return Math.ceil(tokens)
} 