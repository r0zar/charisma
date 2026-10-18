/*--------------------------------------------------------------
 * Charisma DEX ― Router: exact route search with real quotes
 *
 *  ‣ Finds the best route with on-chain quotes only, hop by hop
 *  ‣ Quote result caching with TTL
 *
 *  All business logic lives in testable, side‑effect‑free helpers,
 *  keeping the mutable surface small and predictable.
 *-------------------------------------------------------------*/

/*************  External deps  *************/
import { callReadOnly } from '@repo/polyglot';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import {
  bufferCV,
  someCV,
  uintCV,
  tupleCV,
  principalCV,
  Pc,
  FungiblePostCondition,
  ClarityValue,
  PostConditionModeName,
} from '@stacks/transactions';

/*************  Domain models  *************/
export interface Token {
  type: string;
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  identifier: string;
  description?: string;
  image?: string;
  base?: string;
}

export interface Vault {
  type: string;
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  identifier: string;
  description: string;
  image: string;
  fee: number; // µSTX (1e‑6 STX)
  externalPoolId: string;
  engineContractId: string;
  tokenA: Token;
  tokenB: Token;
  reservesA: number;
  reservesB: number;
  /** Asset this pool swaps STX through ("contract::token"), e.g. Arkadiko's wSTX; see stxWrapperPostConditions */
  stxWrapper?: string;
  /** The pool sends part of the input on to a fee address (e.g. Velar), so it also sends some of the input token */
  forwardsInputFee?: boolean;
}

export interface GraphEdge { vault: Vault; target: Token }
export interface GraphNode { token: Token; edges: Map<string, GraphEdge> }

/**
 * Router opcodes – keep in sync with Clarity contract enum.
 */
export const OPCODES = {
  SWAP_A_TO_B: 0x00,
  SWAP_B_TO_A: 0x01,
  ADD_LIQUIDITY: 0x02,
  REMOVE_LIQUIDITY: 0x03,
  LOOKUP_RESERVES: 0x04,
  OP_DEPOSIT: 0x05,
  OP_WITHDRAW: 0x06,
} as const;

export interface RouterConfig {
  maxHops: number;
  debug: boolean;
  defaultSlippage: number; // e.g. 0.01 = 1 %
  routerContractId?: string;
  quoteCacheTTL?: number; // milliseconds
}

export const defaultConfig: RouterConfig = {
  maxHops: 4,
  debug: false,
  defaultSlippage: 0.01,
  routerContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop',
  quoteCacheTTL: 30000, // 30 seconds
};

export interface Hop {
  vault: Vault;
  tokenIn: Token;
  tokenOut: Token;
  opcode: number;
  quote?: { amountIn: number; amountOut: number };
}

export interface Route {
  path: Token[];
  hops: Hop[];
  amountIn: number;
  amountOut: number;
}

export interface Quote {
  amountIn: number;
  amountOut: number;
  expectedPrice: number;
  minimumReceived: number;
  fee: number;
  opcode: number;
}

export interface Delta { dx: number; dy: number; dk: number }
export interface SwapOptions {
  disablePostConditions?: boolean;
  slippageTolerance?: number;
  nonce?: number;
  fee?: number;
}

// Cache entry type
interface CachedQuote {
  delta: Delta;
  timestamp: number;
}

/** Part of a route found so far: how much of `token` it holds after `hops` */
interface Reach {
  token: Token;
  amount: number;
  hops: Hop[];
}

/***************************************************************
 *                      Pure helpers                           *
 ***************************************************************/

/**
 * Convert numeric opcode → optional 16‑byte buffer CV.
 */
export const opcodeCV = (op: number): ClarityValue => {
  const b = new Uint8Array(16).fill(0);
  b[0] = op;
  return someCV(bufferCV(b));
};

/**
 * Build a Vault object by hydrating on‑chain metadata + reserves.
 * Falls back to sensible defaults when data is missing.
 */
export const buildVault = async (
  contractId: string,
  debug = false,
): Promise<Vault | null> => {
  const [addr, name] = contractId.split('.');

  const raw = (await getTokenMetadataCached(contractId)) as TokenCacheData & {
    tokenAContract?: string;
    tokenBContract?: string;
    lpRebatePercent?: number | null;
  };
  if (!raw || (raw as any).error) {
    if (debug) console.warn(`[vault] metadata miss → ${contractId}`);
    return null;
  }

  const { tokenAContract, tokenBContract } = raw;
  if (!tokenAContract || !tokenBContract) {
    if (debug) console.warn(`[vault] missing base tokens → ${contractId}`);
    return null;
  }

  // Fetch metadata for underlying tokens in parallel
  const [aMeta, bMeta] = await Promise.all([
    getTokenMetadataCached(tokenAContract),
    getTokenMetadataCached(tokenBContract),
  ]);

  const deriveToken = (meta: any, cid: string): Token => {
    return {
      contractId: cid,
      name: meta.name,
      symbol: meta.symbol,
      decimals: meta.decimals,
      identifier: meta.identifier,
      description: meta.description,
      image: meta.image,
      type: meta.type,
    };
  };

  const tokenA = deriveToken(aMeta, tokenAContract);
  const tokenB = deriveToken(bMeta, tokenBContract);

  // Attempt to read current reserves (gracefully degrade on failure)
  let reservesA = 0,
    reservesB = 0;
  try {
    const r = await callReadOnly(contractId, 'quote', [uintCV(0), opcodeCV(OPCODES.LOOKUP_RESERVES)]);
    reservesA = Number(r.value.dx.value);
    reservesB = Number(r.value.dy.value);
  } catch (e) {
    if (debug) console.warn(`[vault] reserve fetch failed → ${contractId}`, e);
  }

  /** µSTX fee (scaled 1e6) – favour integers for clarity */
  const fee = raw.lpRebatePercent
    ? Math.floor((Number(raw.lpRebatePercent) / 100) * 1_000_000)
    : 0;

  return {
    type: raw.type || '',
    contractId,
    name: raw.name || name,
    symbol: raw.symbol || 'LP',
    decimals: raw.decimals ?? 0,
    identifier: raw.identifier || contractId,
    description: raw.description || '',
    image: raw.image || '',
    fee,
    externalPoolId: raw.externalPoolId || '',
    engineContractId: raw.engineContractId || '',
    tokenA,
    tokenB,
    reservesA,
    reservesB,
  };
};

/**
 * Get swap delta for a given Vault/opcode/amount.
 * Returns null on read‑only failure.
 */
export const quoteVault = async (
  v: Vault,
  amt: number,
  op: number,
): Promise<Delta | null> => {
  try {
    const r = await callReadOnly(v.contractId, 'quote', [uintCV(amt), opcodeCV(op)]);
    return {
      dx: Number(r.value.dx.value),
      dy: Number(r.value.dy.value),
      dk: Number(r.value.dk.value),
    };
  } catch {
    return null;
  }
};

/***************************************************************
 *                    Optimized Router                         *
 ***************************************************************/

/**
 * Optimized stateful graph router with caching and estimation.
 */
export class Router {
  readonly edges = new Map<string, Vault>();
  readonly nodes = new Map<string, GraphNode>();
  private quoteCache = new Map<string, CachedQuote>();
  config: RouterConfig;

  constructor(cfg: Partial<RouterConfig> = {}) {
    this.config = { ...defaultConfig, ...cfg };
  }

  /**
   * Load vault array → construct bi‑directional adjacency graph.
   */
  loadVaults(vaults: Vault[]) {
    this.edges.clear();
    this.nodes.clear();
    this.quoteCache.clear(); // Clear cache when reloading vaults

    // TODO: Fix energy vaults compatibility with router
    for (const v of vaults.filter(v => v.type !== 'ENERGY')) {
      this.edges.set(v.contractId, v);

      const { tokenA: t0, tokenB: t1 } = v;

      // Create nodes lazily
      if (!this.nodes.has(t0.contractId))
        this.nodes.set(t0.contractId, {
          token: t0,
          edges: new Map(),
        });
      if (!this.nodes.has(t1.contractId))
        this.nodes.set(t1.contractId, {
          token: t1,
          edges: new Map(),
        });

      const n0 = this.nodes.get(t0.contractId)!;
      const n1 = this.nodes.get(t1.contractId)!;

      // Keyed by `otherToken‑cid + vault‑cid` so multiple pools per pair can coexist
      n0.edges.set(`${t1.contractId}-${v.contractId}`, { vault: v, target: t1 });
      n1.edges.set(`${t0.contractId}-${v.contractId}`, { vault: v, target: t0 });
    }

    if (this.config.debug)
      console.log(
        `[router] loaded ${vaults.length} pools → ${this.nodes.size} tokens`,
      );
  }

  /**
   * Get cached quote or fetch new one
   */
  private async getCachedQuote(
    vault: Vault,
    amount: number,
    opcode: number
  ): Promise<Delta | null> {
    const key = `${vault.contractId}-${amount}-${opcode}`;
    const cached = this.quoteCache.get(key);

    // Check if cache is still valid
    if (cached && Date.now() - cached.timestamp < this.config.quoteCacheTTL!) {
      if (this.config.debug) {
        console.log(`[cache] hit for ${key}`);
      }
      return cached.delta;
    }

    // Fetch new quote
    const delta = await quoteVault(vault, amount, opcode);
    if (delta) {
      this.quoteCache.set(key, { delta, timestamp: Date.now() });
    }

    return delta;
  }

  /**
   * Clear stale entries from quote cache
   */
  clearStaleCache() {
    const now = Date.now();
    let cleared = 0;
    for (const [key, entry] of Array.from(this.quoteCache.entries())) {
      if (now - entry.timestamp > this.config.quoteCacheTTL!) {
        this.quoteCache.delete(key);
        cleared++;
      }
    }
    if (this.config.debug && cleared > 0) {
      console.log(`[cache] cleared ${cleared} stale entries`);
    }
  }

  /** A hop from a to b through vault: a 1:1 wrap into or out of a subnet, otherwise a swap in the pool's direction */
  private opcodeFor(a: Token, b: Token, vault: Vault): number {
    if (a.type !== 'SUBNET' && b.type === 'SUBNET') return OPCODES.OP_DEPOSIT;
    if (a.type === 'SUBNET' && b.type !== 'SUBNET') return OPCODES.OP_WITHDRAW;
    return a.contractId === vault.tokenA.contractId ? OPCODES.SWAP_A_TO_B : OPCODES.SWAP_B_TO_A;
  }

  /** The fewest hops from each token to `to` through the pools (no quotes) */
  private hopsTo(to: string): Map<string, number> {
    const hops = new Map([[to, 0]]);
    const queue = [to];
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      for (const e of this.nodes.get(id)!.edges.values()) {
        if (hops.has(e.target.contractId)) continue;
        hops.set(e.target.contractId, hops.get(id)! + 1);
        queue.push(e.target.contractId);
      }
    }
    return hops;
  }

  /**
   * Best route (most output) between two tokens, found with real quotes only. Hop by hop it quotes every pool out of
   * every token held so far and keeps the most of each token, so no guess about a pool can hide the best route.
   * No path between the tokens → an empty route (amountOut 0). Paths exist but none can be quoted → throws, saying why.
   */
  async findBestRoute(from: string, to: string, amount: number): Promise<Route> {
    this.clearStaleCache();
    const start = this.nodes.get(from)?.token;
    const end = this.nodes.get(to)?.token;
    if (!start || !end) return { path: [], hops: [], amountIn: 0, amountOut: 0 };

    // A trade in or out of a subnet spends a step on the 1:1 wrap, so it gets one extra step.
    // Subnet tokens only connect to their own base token, so the search is no wider than a normal trade's.
    const maxHops = this.config.maxHops + (start.type === 'SUBNET' || end.type === 'SUBNET' ? 1 : 0);
    const hopsTo = this.hopsTo(to);
    /** The most of each token held at any hop so far: a later route holding less of it can't do better from there */
    const most = new Map([[from, amount]]);
    let frontier: Reach[] = [{ token: start, amount, hops: [] }];
    let best: Reach | null = null;
    let quotes = 0;

    for (let hop = 1; hop <= maxHops && frontier.length; hop++) {
      // Every pool out of every token held, toward a token that can still reach `to` in the hops left. A route never
      // reuses a pool or revisits a token, except arriving back at `to`, which closes a loop when from === to.
      const moves = frontier.flatMap(r => Array.from(this.nodes.get(r.token.contractId)!.edges.values())
        .filter(e => {
          const id = e.target.contractId;
          if ((hopsTo.get(id) ?? Infinity) > maxHops - hop) return false;
          if (r.hops.some(h => h.vault.contractId === e.vault.contractId)) return false;
          return id === to || (id !== from && !r.hops.some(h => h.tokenOut.contractId === id));
        })
        .map(e => ({ r, vault: e.vault, target: this.nodes.get(e.target.contractId)!.token })));
      quotes += moves.length;

      const reached = await Promise.all(moves.map(async ({ r, vault, target }): Promise<Reach | null> => {
        const opcode = this.opcodeFor(r.token, target, vault);
        const delta = await this.getCachedQuote(vault, r.amount, opcode);
        // A pool that would refuse the trade quotes 0, so it leads nowhere
        if (!delta || delta.dy <= 0) return null;
        const step: Hop = { vault, tokenIn: r.token, tokenOut: target, opcode, quote: { amountIn: r.amount, amountOut: delta.dy } };
        return { token: target, amount: delta.dy, hops: [...r.hops, step] };
      }));

      // Keep the most of each token. Arriving at `to` ends that route; the rest go on to the next hop.
      const kept = new Map<string, Reach>();
      for (const r of reached) {
        if (!r) continue;
        const id = r.token.contractId;
        if (id === to) {
          if (r.amount > (best?.amount ?? 0)) best = r;
        } else if (r.amount > (most.get(id) ?? 0)) {
          most.set(id, r.amount);
          kept.set(id, r);
        }
      }
      frontier = Array.from(kept.values());
    }

    if (this.config.debug) console.log(`[router] ${from} → ${to}: ${quotes} pool quotes, best ${best?.amount ?? 0}`);
    if (best) return { path: [start, ...best.hops.map(h => h.tokenOut)], hops: best.hops, amountIn: amount, amountOut: best.amount };
    if (!quotes) return { path: [], hops: [], amountIn: 0, amountOut: 0 };
    throw new Error(`No usable route from ${from} to ${to}: none of the ${quotes} pool quotes on the way led there`);
  }

  /** quick health snapshot */
  stats() {
    let edges = 0;
    this.nodes.forEach(n => (edges += n.edges.size));
    return {
      tokens: this.nodes.size,
      pools: this.edges.size,
      edges,
      cacheSize: this.quoteCache.size
    };
  }

  vaultContractIds() {
    return Array.from(this.edges.values()).map(v => v.contractId);
  }

  tokenContractIds() {
    return Array.from(this.nodes.values()).map(n => n.token.contractId);
  }
}

/***************************************************************
 *                    Swap transaction helpers                 *
 ***************************************************************/

/**
 * Build JavaScript representation of Clarity `swap‑N` call + post‑conds.
 */
export const buildSwapTransaction = async (
  router: Router,
  route: Route,
  sender: string,
) => {
  const cfg = router.config;
  if (!cfg.routerContractId) throw new Error('router addr/name missing');

  /** deduplicated map of fungible post conditions */
  const pcMap = new Map<string, any>();
  const add = (pc: FungiblePostCondition) => {
    const k = `${pc.address}-${pc.asset ?? 'STX'}`;
    if (pcMap.has(k)) {
      pcMap.get(k).amount = BigInt(pcMap.get(k).amount) + BigInt(pc.amount);
    } else pcMap.set(k, { ...pc });
  };

  // Accumulate PCs per hop
  for (const h of route.hops) {
    const pcs = await buildSwapPostConditions(h, router.config, sender);
    (pcs as FungiblePostCondition[]).forEach(add);
  }

  const fnArgs = [
    uintCV(route.amountIn),
    ...route.hops.map(h =>
      tupleCV({ pool: principalCV(h.vault.contractId), opcode: opcodeCV(h.opcode) }),
    ),
  ];

  return {
    contract: cfg.routerContractId as `${string}.${string}`,
    functionName: `swap-${route.hops.length}`,
    functionArgs: fnArgs,
    postConditions: Array.from(pcMap.values()),
    postConditionMode: 'deny' as PostConditionModeName,
    network: 'mainnet',
    clarityVersion: 3,
  };
};

/**
 * Build per‑hop post‑conditions (STX or SIP‑010 fungible).
 */
export const buildSwapPostConditions = async (
  hop: Hop,
  cfg: RouterConfig,
  sender: string,
  slippage?: number,
) => {
  const mk = (
    t: Token,
    amt: bigint,
    princ: string,
    cond: 'eq' | 'gte' | 'lte',
  ) => {
    if (t.contractId === '.stx')
      return cond === 'eq'
        ? Pc.principal(princ).willSendEq(amt).ustx()
        : cond === 'gte'
          ? Pc.principal(princ).willSendGte(amt).ustx()
          : Pc.principal(princ).willSendLte(amt).ustx();

    return cond === 'eq'
      ? Pc.principal(princ).willSendEq(amt).ft(t.contractId as any, t.identifier!)
      : cond === 'gte'
        ? Pc.principal(princ).willSendGte(amt).ft(t.contractId as any, t.identifier!)
        : Pc.principal(princ).willSendLte(amt).ft(t.contractId as any, t.identifier!);
  };

  const { tokenIn, tokenOut, vault, opcode } = hop;
  const amtIn = BigInt(hop.quote?.amountIn ?? 0);
  const amtOut = BigInt(hop.quote?.amountOut ?? 0);

  const effectiveSlippage = slippage !== undefined ? slippage / 100 : cfg.defaultSlippage;
  const maxIn = BigInt(Math.floor(Number(amtIn) * (1 + effectiveSlippage)));
  const minOut = BigInt(Math.floor(Number(amtOut) * (1 - effectiveSlippage)));

  // Deposits and withdrawals move whatever the previous hop delivered, which can differ from the quote by
  // up to the slippage, so bound them the same way instead of requiring the exact quoted amount
  if (opcode === OPCODES.OP_DEPOSIT) return [mk(tokenIn, maxIn, sender, 'lte')];
  // TODO: fix sublink data for externalPoolId - bit of a hack to use tokenB.contractId
  if (opcode === OPCODES.OP_WITHDRAW) return [mk(tokenOut, minOut, vault.externalPoolId || vault.tokenB.contractId || vault.contractId, 'gte')];

  return [
    mk(tokenIn, maxIn, sender, 'lte'),
    mk(tokenOut, minOut, vault.externalPoolId || vault.contractId, 'gte'),
    ...stxWrapperPostConditions(hop, sender, maxIn, minOut, BigInt(Math.ceil(Number(amtOut) * (1 + effectiveSlippage)))),
    // The pool forwards a slice of the input to its fee address; it can never be more than the input
    ...(vault.forwardsInputFee ? [mk(tokenIn, maxIn, vault.externalPoolId || vault.contractId, 'lte')] : []),
  ];
};

/**
 * Some pools swap STX through a wrapper token (the vault's `stxWrapper`): STX in is wrapped and the sender pays
 * the wrapper in; STX out arrives as the wrapper and is unwrapped from the sender. Deny-mode swaps must list those moves.
 */
export const stxWrapperPostConditions = (hop: Hop, sender: string, maxIn: bigint, minOut: bigint, maxOut: bigint) => {
  const wrapper = hop.vault.stxWrapper;
  if (!wrapper) return [];
  const [contract, token] = wrapper.split('::') as [`${string}.${string}`, string];
  const pool = hop.vault.externalPoolId || hop.vault.contractId;
  const pcs = [];
  if (hop.tokenIn.contractId === '.stx') pcs.push(Pc.principal(sender).willSendLte(maxIn).ft(contract, token));
  if (hop.tokenOut.contractId === '.stx') {
    pcs.push(Pc.principal(pool).willSendGte(minOut).ft(contract, token));
    pcs.push(Pc.principal(sender).willSendLte(maxOut).ft(contract, token));
  }
  return pcs;
};

/***************************************************************
 *                dex‑cache / dex‑api shims                    *
 ***************************************************************/

import { getHostUrl } from '@modules/discovery';

/** Get the appropriate dex-cache endpoint for current environment */
const getDexCacheUrl = (): string => `${getHostUrl('invest')}/api/v1`;

/**
 * Fetch vault inventory from Charisma dex‑cache.
 */
export const fetchVaults = async (dexCacheUrl: string = getDexCacheUrl()): Promise<Vault[]> => {
  const res: any = await fetch(`${dexCacheUrl}/vaults`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => undefined);
    throw new Error(errBody?.error ?? `dex-cache request failed (${res.status})`);
  }

  const json = await res.json();
  if (json.status !== 'success' || !Array.isArray(json.data))
    throw new Error('dex-cache: unexpected response shape');

  return json.data as Vault[];
};

/**
 * Convenience wrapper – populate Router straight from dex‑cache.
 */
export const loadVaults = async (router: Router, dexCacheUrl: string = getDexCacheUrl()): Promise<Vault[]> => {
  const vaults = await fetchVaults(dexCacheUrl);
  router.loadVaults(vaults);
  return vaults;
};

export const createRouter = async (cfg: Partial<RouterConfig> = {}) => {
  const router = new Router({ ...defaultConfig, ...cfg });
  await loadVaults(router);
  return router;
};

/** Simple token list helper (used by frontends) */
export const listTokens = async (dexCacheUrl: string = getDexCacheUrl()): Promise<Token[]> => {
  const res: any = await fetch(`${dexCacheUrl}/tokens`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => undefined);
    throw new Error(errBody?.error ?? `dex-cache request failed (${res.status})`);
  }
  const json = await res.json();
  if (json.status !== 'success' || !Array.isArray(json.data))
    throw new Error('dex-cache: unexpected response shape');
  return json.data as Token[];
};

/*********  dex‑api quote endpoint  *********/
/** Get the appropriate dex-api endpoint for current environment */
const getDexApiUrl = (): string => `${getHostUrl('swap')}/api/v1`;

export const fetchQuote = async (
  from: string,
  to: string,
  amount: number,
  dexApiUrl: string = getDexApiUrl(),
) => {
  let attempts = 0;
  let lastError: any = null;
  while (attempts < 5) {
    try {
      const res: any = await fetch(`${dexApiUrl}/quote?tokenIn=${from}&tokenOut=${to}&amount=${amount}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => undefined);
        throw new Error(errBody?.error ?? `dex-api request failed (${res.status})`);
      }
      const json = await res.json();
      return json.data as Route;
    } catch (err) {
      lastError = err;
      attempts++;
      if (attempts < 5) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  throw lastError || new Error('Failed to fetch quote after 5 attempts');
};

/***************************************************************
 *                   Burn-Swapper Re-exports                  *
 ***************************************************************/
export {
  BurnSwapper,
  createBurnSwapper,
  type BurnSwapRouteResult,
  type BurnSwapConfig,
  type BurnSwapQuote,
  type BurnSwapToken,
} from './burn-swapper-standalone';