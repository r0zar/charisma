// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';
import { createHash } from 'node:crypto';
import { Cl, encodeStructuredDataBytes, getAddressFromPublicKey, publicKeyFromSignatureRsv } from '@stacks/transactions';

/**
 * Every successful trade through Charisma's routers, read from the chain (Hiro) and kept in KV, one key per
 * day. A sync pulls new trades from the newest end and, until history is complete, older pages from the tail.
 */

/** The routers every Charisma swap goes through: subnet orders (current and legacy), then wallet swaps (the big one, last) */
export const ROUTERS = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v1',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop',
];

/** One side of a trade as the chain names it: a token directly (subnet orders), or a pool and direction (wallet swaps) */
export type Side = { token: string } | { pool: string; aToB: boolean };

export interface RouterTrade {
  txid: string;
  router: string;
  /** Unix ms of the block */
  at: number;
  /** Who sent the transaction: the trader for wallet swaps, the executor for subnet orders */
  sender: string;
  /** Subnet orders: the wallet that signed the order (the trader) */
  signer?: string;
  in: Side;
  out: Side;
  /** Smallest units of the input token actually swapped */
  amount: string;
}

interface SyncState {
  /** Newest txid already stored */
  head?: string;
  /** How far back (from the newest) older history has been read */
  tailOffset: number;
  complete: boolean;
}

const PAGE = 50;
const DAYS_KEY = 'analytics:router-trades:days';
const dayKey = (day: string) => `analytics:router-trades:${day}`;
const stateKey = (router: string) => `analytics:router-sync:${router}`;

interface HiroTx {
  tx_id: string;
  tx_status: string;
  tx_type: string;
  sender_address: string;
  burn_block_time: number;
  contract_call?: { contract_id: string; function_args?: { name: string; repr: string }[] };
  tx_result?: { repr: string };
}

/** The Blaze protocol's SIP-018 domain (blaze-sdk's BLAZE_V1_DOMAIN) */
const BLAZE_DOMAIN = Cl.tuple({ name: Cl.stringAscii('BLAZE_PROTOCOL'), version: Cl.stringAscii('v1.0'), 'chain-id': Cl.uint(1) });

/** Who signed a subnet order: recovered from its signature over the Blaze message the router checked */
function orderSigner(inRepr: string, router: string): string {
  const amount = inRepr.match(/\(amount u(\d+)\)/)?.[1];
  const signature = inRepr.match(/\(signature 0x([0-9a-f]+)\)/)?.[1];
  const token = principalIn(inRepr, 'token');
  const uuid = inRepr.match(/\(uuid "([^"]+)"\)/)?.[1];
  if (!amount || !signature || !token || !uuid) throw new Error(`Can't read the signed order in ${inRepr.slice(0, 80)}`);
  const message = Cl.tuple({
    contract: Cl.principal(token),
    intent: Cl.stringAscii('TRANSFER_TOKENS'),
    opcode: Cl.none(),
    amount: Cl.some(Cl.uint(BigInt(amount))),
    target: Cl.some(Cl.principal(router)),
    uuid: Cl.stringAscii(uuid),
  });
  const hash = createHash('sha256').update(encodeStructuredDataBytes({ message, domain: BLAZE_DOMAIN })).digest('hex');
  return getAddressFromPublicKey(publicKeyFromSignatureRsv(hash, signature), 'mainnet');
}

const principalIn = (repr: string, field: string) => repr.match(new RegExp(`\\(${field} '([A-Z0-9]+\\.[a-zA-Z0-9-]+)\\)`))?.[1];

/** Read one router transaction into a trade; null for anything that isn't a successful swap */
function toTrade(tx: HiroTx, router: string): RouterTrade | null {
  if (tx.tx_status !== 'success' || tx.tx_type !== 'contract_call' || tx.contract_call?.contract_id !== router) return null;
  const args = Object.fromEntries((tx.contract_call.function_args ?? []).map(a => [a.name, a.repr]));
  // The first hop's result: (dx uN) is what went in
  const dx = tx.tx_result?.repr.match(/\(dx u(\d+)\)/)?.[1];
  const hops = Object.keys(args).filter(name => /^hop-\d+$/.test(name)).sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  if (!dx || hops.length === 0) return null;

  const hopSide = (repr: string): Side | null => {
    const pool = principalIn(repr, 'pool') ?? principalIn(repr, 'vault');
    // Opcode 0x00… swaps A for B, 0x01… B for A (wallet swaps wrap it in (some …))
    const op = repr.match(/opcode (?:\(some )?0x([0-9a-f]{2})/)?.[1];
    return pool && (op === '00' || op === '01') ? { pool, aToB: op === '00' } : null;
  };

  // Subnet orders name their tokens; wallet swaps are read from the first and last pools
  const inToken = args.in && principalIn(args.in, 'token');
  const outToken = args.out && principalIn(args.out, 'token');
  const inSide = inToken ? { token: inToken } : hopSide(args[hops[0]]);
  const outSide = outToken ? { token: outToken } : hopSide(args[hops[hops.length - 1]]);
  if (!inSide || !outSide) return null;
  return {
    txid: tx.tx_id,
    router,
    at: tx.burn_block_time * 1000,
    sender: tx.sender_address,
    ...(args.in && { signer: orderSigner(args.in, router) }),
    in: inSide,
    out: outSide,
    amount: dx,
  };
}

async function fetchPage(router: string, offset: number, retries = 4): Promise<HiroTx[]> {
  const res = await fetch(`https://api.hiro.so/extended/v1/address/${router}/transactions?limit=${PAGE}&offset=${offset}`, {
    headers: process.env.HIRO_API_KEY ? { 'x-api-key': process.env.HIRO_API_KEY } : {},
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  // Rate limited or briefly down: wait (as long as Hiro asks, when it says), then try again
  if ((res.status === 429 || res.status >= 500) && retries > 0) {
    await new Promise(resolve => setTimeout(resolve, Number(res.headers.get('retry-after') ?? 10) * 1000));
    return fetchPage(router, offset, retries - 1);
  }
  if (!res.ok) throw new Error(`Couldn't read ${router} trades from the chain (Hiro ${res.status})`);
  return ((await res.json()) as { results: HiroTx[] }).results;
}

/** Add trades to their day keys (UTC) */
async function store(trades: RouterTrade[]): Promise<number> {
  const byDay = new Map<string, RouterTrade[]>();
  for (const t of trades) {
    const day = new Date(t.at).toISOString().slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), t]);
  }
  let added = 0;
  for (const [day, fresh] of byDay) {
    const existing = ((await kv.get(dayKey(day))) as RouterTrade[] | null) ?? [];
    // Re-reading a trade replaces the stored copy (so improvements to reading reach old trades)
    const incoming = new Set(fresh.map(t => t.txid));
    added += fresh.filter(t => !existing.some(e => e.txid === t.txid)).length;
    await kv.set(dayKey(day), [...existing.filter(t => !incoming.has(t.txid)), ...fresh]);
    await kv.sadd(DAYS_KEY, day);
  }
  return added;
}

/**
 * Pull new trades, then keep reading older history until `budgetMs` runs out. Safe to run repeatedly;
 * returns what it did so a caller can run it again until history is complete.
 */
export async function syncRouterTrades(budgetMs = 45_000) {
  const deadline = Date.now() + budgetMs;
  const report: Record<string, { added: number; complete: boolean; tailOffset: number }> = {};

  for (const router of ROUTERS) {
    const state: SyncState = ((await kv.get(stateKey(router))) as SyncState | null) ?? { tailOffset: 0, complete: false };
    let added = 0;

    // Newest end: read until reaching what's already stored
    if (state.head) {
      let offset = 0;
      let newest: string | undefined;
      let fresh = 0;
      for (;;) {
        const page = await fetchPage(router, offset);
        newest ??= page[0]?.tx_id;
        const stop = page.findIndex(tx => tx.tx_id === state.head);
        const unseen = stop === -1 ? page : page.slice(0, stop);
        fresh += unseen.length;
        added += await store(unseen.map(tx => toTrade(tx, router)).filter((t): t is RouterTrade => !!t));
        if (stop !== -1 || page.length < PAGE || Date.now() > deadline) break;
        offset += PAGE;
      }
      if (newest) state.head = newest;
      // Newer transactions push older history further back
      state.tailOffset += fresh;
    }

    // Older history, a page at a time
    while (!state.complete && Date.now() < deadline) {
      const page = await fetchPage(router, state.tailOffset);
      if (state.tailOffset === 0) state.head ??= page[0]?.tx_id;
      added += await store(page.map(tx => toTrade(tx, router)).filter((t): t is RouterTrade => !!t));
      state.tailOffset += page.length;
      if (page.length < PAGE) state.complete = true;
      // Keep the place after every page, so a failure never loses progress
      await kv.set(stateKey(router), state);
    }

    await kv.set(stateKey(router), state);
    report[router] = { added, complete: state.complete, tailOffset: state.tailOffset };
  }
  return report;
}

/** Day keys read per request */
const DAYS_PER_READ = 50;

/** Every stored trade */
export async function listRouterTrades(): Promise<RouterTrade[]> {
  const days = ((await kv.smembers(DAYS_KEY)) as string[]) ?? [];
  const trades: RouterTrade[] = [];
  for (let i = 0; i < days.length; i += DAYS_PER_READ) {
    const chunk = (await kv.mget(...days.slice(i, i + DAYS_PER_READ).map(dayKey))) as (RouterTrade[] | null)[];
    for (const day of chunk) trades.push(...(day ?? []));
  }
  return trades;
}
