import { unstable_cache } from 'next/cache';
import { hexToCV, type TupleCV, type UIntCV } from '@stacks/transactions';
import { CHARISMA, CHARISMA_WALLETS, DECIMALS, ENGINE, TOKENS, type IouKey } from './tokens';

const HIRO = 'https://api.hiro.so';
const PRICES = 'https://prices.charisma.rocks/api/v1/prices';
const headers = (): Record<string, string> => (process.env.HIRO_API_KEY ? { 'x-api-key': process.env.HIRO_API_KEY } : {});

/** One IOU's state. Amounts are base-unit strings, so the snapshot can be cached as JSON. */
export interface TokenState {
  key: IouKey;
  issued: string;
  supply: string;
  burned: string;
  /** In people's own wallets: what redemptions are for */
  walletsHeld: string;
  walletsCount: number;
  /** Inside pools and other contracts, mostly liquidity Charisma added */
  poolsHeld: string;
  /** In Charisma's own wallets: burnable without paying anyone */
  charismaHeld: string;
  /** Originals the engine can pay out right now */
  engine: string;
  /** USD per original token */
  priceUsd: number;
}

export interface RecoveryState {
  tokens: TokenState[];
  updatedAt: string;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) }, cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function holders(contractId: string, asset: string) {
  const all: { address: string; balance: string }[] = [];
  for (let offset = 0; offset < 2000; offset += 200) {
    const page = await getJson<{ total: number; results: { address: string; balance: string }[] }>(
      `${HIRO}/extended/v1/tokens/ft/${contractId}::${asset}/holders?limit=200&offset=${offset}`,
    );
    all.push(...page.results);
    if (offset + 200 >= page.total) break;
  }
  return all;
}

/** The engine's balances, decoded from get-available's tuple { roo, stx, welsh } */
async function engineFunds(): Promise<Record<IouKey, bigint>> {
  const [address, name] = ENGINE.split('.');
  const res = await getJson<{ okay: boolean; result?: string; cause?: string }>(`${HIRO}/v2/contracts/call-read/${address}/${name}/get-available`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sender: CHARISMA, arguments: [] }),
  });
  if (!res.okay || !res.result) throw new Error(`recovery-engine get-available failed: ${res.cause ?? 'no result'}`);
  const tuple = hexToCV(res.result) as TupleCV<Record<IouKey, UIntCV>>;
  const amount = (k: IouKey) => {
    const v = tuple.value?.[k]?.value;
    if (v === undefined) throw new Error(`recovery-engine get-available has no ${k}: ${res.result}`);
    return BigInt(v);
  };
  return { welsh: amount('welsh'), roo: amount('roo'), stx: amount('stx') };
}

async function prices(): Promise<Record<string, number>> {
  const ids = TOKENS.map(t => t.original.contractId).join(',');
  const json = await getJson<{ tokens: { contractId: string; usd: number }[] }>(`${PRICES}?tokens=${ids}`);
  return Object.fromEntries(json.tokens.map(t => [t.contractId, t.usd]));
}

async function loadState(): Promise<RecoveryState> {
  const [engine, usd, perToken] = await Promise.all([
    engineFunds(),
    prices(),
    Promise.all(TOKENS.map(async t => ({
      t,
      meta: await getJson<{ total_supply: string }>(`${HIRO}/metadata/v1/ft/${t.iou.contractId}`),
      list: await holders(t.iou.contractId, t.iou.asset),
    }))),
  ]);

  const tokens = perToken.map(({ t, meta, list }): TokenState => {
    let charisma = 0n, pools = 0n, wallets = 0n, walletsCount = 0;
    for (const h of list) {
      const b = BigInt(h.balance);
      if (b === 0n) continue;
      if (h.address.includes('.')) pools += b;
      else if (CHARISMA_WALLETS.includes(h.address)) charisma += b;
      else { wallets += b; walletsCount++; }
    }
    const supply = BigInt(meta.total_supply);
    const price = usd[t.original.contractId];
    if (!(price > 0)) throw new Error(`No USD price for ${t.original.symbol}`);
    return {
      key: t.key,
      issued: t.issued.toString(),
      supply: supply.toString(),
      burned: (t.issued > supply ? t.issued - supply : 0n).toString(),
      walletsHeld: wallets.toString(),
      walletsCount,
      poolsHeld: pools.toString(),
      charismaHeld: charisma.toString(),
      engine: engine[t.key].toString(),
      priceUsd: price,
    };
  });
  return { tokens, updatedAt: new Date().toISOString() };
}

/** The recovery's state, shared by every visitor and refreshed every 2 minutes */
export const getRecoveryState = unstable_cache(loadState, ['recovery-state-v2'], { revalidate: 120 });

/** A wallet's IOU balances in base units */
export async function iouBalances(address: string): Promise<Record<IouKey, string>> {
  const balances = await Promise.all(TOKENS.map(async t =>
    [t.key, (await getJson<{ balance: string }>(`${HIRO}/extended/v2/addresses/${address}/balances/ft/${t.iou.contractId}::${t.iou.asset}`)).balance] as const,
  ));
  return Object.fromEntries(balances) as Record<IouKey, string>;
}

export { DECIMALS };
