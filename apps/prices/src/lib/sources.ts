/** Where prices come from: the token list and pools on invest, routes from swap, and BTC/USD from Kraken */

export const SBTC = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';
const INVEST = 'https://invest.charisma.rocks/api/v1';
const QUOTE = 'https://swap.charisma.rocks/api/v1/quote';

export interface TokenInfo {
  contractId: string;
  symbol: string;
  name: string;
  image?: string;
  decimals: number;
  /** 'SUBNET' for a Blaze subnet token, which trades 1:1 with its base */
  type?: string;
  base?: string;
}

interface VaultSide { contractId: string; decimals: number }
interface Vault { type?: string; tokenA?: VaultSide; tokenB?: VaultSide; reservesA?: number; reservesB?: number }

async function getJson<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Every token Charisma lists, with its name, symbol and logo */
export async function listTokens(): Promise<TokenInfo[]> {
  const json = await getJson<{ status: string; data: Record<string, unknown>[] }>(`${INVEST}/tokens`, 600);
  if (json.status !== 'success' || !Array.isArray(json.data)) throw new Error('invest /tokens returned an unexpected shape');
  return json.data.map(t => ({
    contractId: String(t.contractId),
    symbol: String(t.symbol ?? ''),
    name: String(t.name ?? t.symbol ?? ''),
    image: typeof t.image === 'string' && t.image ? t.image : undefined,
    decimals: Number(t.decimals ?? 6),
    type: typeof t.type === 'string' && t.type ? t.type : undefined,
    base: typeof t.base === 'string' && t.base ? t.base : undefined,
  }));
}

/** Whole tokens held in Charisma's pools, per token */
export async function poolBalances(): Promise<Map<string, number>> {
  const json = await getJson<{ status: string; data: Vault[] }>(`${INVEST}/vaults`, 600);
  if (json.status !== 'success' || !Array.isArray(json.data)) throw new Error('invest /vaults returned an unexpected shape');
  const held = new Map<string, number>();
  const add = (side: VaultSide | undefined, units: number | undefined) => {
    if (!side || !units) return;
    held.set(side.contractId, (held.get(side.contractId) ?? 0) + units / 10 ** side.decimals);
  };
  for (const v of json.data) {
    if (v.type !== 'POOL') continue;
    add(v.tokenA, v.reservesA);
    add(v.tokenB, v.reservesB);
  }
  return held;
}

/** BTC/USD from Kraken. Throws rather than guessing: no price beats a made-up one. */
export async function btcUsd(): Promise<number> {
  const res = await fetch('https://api.kraken.com/0/public/Ticker?pair=XXBTZUSD', { cache: 'no-store' });
  const json = await res.json();
  if (json.error?.length) throw new Error(`Kraken: ${json.error.join(', ')}`);
  const price = Number(json.result?.XXBTZUSD?.c?.[0]);
  if (!(price > 0)) throw new Error(`Kraken returned no usable BTC price (${json.result?.XXBTZUSD?.c?.[0]})`);
  return price;
}

/** Best route quote from the swap app, in base units. Null when there's no route. */
export async function quote(tokenIn: string, tokenOut: string, amount: number): Promise<{ amountIn: number; amountOut: number } | null> {
  const url = `${QUOTE}?tokenIn=${encodeURIComponent(tokenIn)}&tokenOut=${encodeURIComponent(tokenOut)}&amount=${amount}`;
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => null);
  if (!json?.success || !(json.data?.amountOut > 0)) return null;
  return { amountIn: Number(json.data.amountIn), amountOut: Number(json.data.amountOut) };
}
