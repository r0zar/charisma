/*  Functional core + stateful Router class ------------------------------------------------
    Only the routing graph truly needs internal state, so we wrap that
    piece in a lightweight class. Everything else stays as pure helpers.
    -------------------------------------------------------------------*/

import { callReadOnlyFunction } from '@repo/polyglot';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import {
  bufferCV,
  someCV,
  uintCV,
  tupleCV,
  principalCV,
  Pc,
  FungiblePostCondition,
  makeContractCall,
  broadcastTransaction,
  SignedContractCallOptions,
  SignedMultiSigContractCallOptions,
  PostConditionMode,
  ClarityValue,
} from '@stacks/transactions';

// ---------------------------------------------------------------------------
//  Domain types (unchanged)
// ---------------------------------------------------------------------------
export interface Token {
  type: string; contractId: string; contractAddress: string; contractName: string;
  name: string; symbol: string; decimals: number;
  identifier?: string; description?: string; image?: string;
}
export interface Vault {
  type: string; contractId: string; contractAddress: string; contractName: string;
  name: string; symbol: string; decimals: number; identifier: string; description: string; image: string;
  fee: number; externalPoolId: string; engineContractId: string;
  tokenA: Token; tokenB: Token; reservesA: number; reservesB: number;
}
export interface GraphEdge { vault: Vault; target: Token }
export interface GraphNode { token: Token; edges: Map<string, GraphEdge> }

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
  maxHops: number; debug: boolean; defaultSlippage: number; routerContractId?: string;
}
export const defaultConfig: RouterConfig = { maxHops: 3, debug: false, defaultSlippage: 0.01, routerContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop' };

export interface Hop { vault: Vault; tokenIn: Token; tokenOut: Token; opcode: number; quote?: { amountIn: number; amountOut: number }; }
export interface Route { path: Token[]; hops: Hop[]; amountIn: number; amountOut: number; }
export interface Quote { amountIn: number; amountOut: number; expectedPrice: number; minimumReceived: number; fee: number; opcode: number; }
export interface Delta { dx: number; dy: number; dk: number }
export interface SwapOptions { disablePostConditions?: boolean; slippageTolerance?: number; nonce?: number; fee?: number; }

// ---------------------------------------------------------------------------
//  Stateless utilities  ------------------------------------------------------
// ---------------------------------------------------------------------------
export const opcodeCV = (op: number): ClarityValue => { const b = new Uint8Array(16).fill(0); b[0] = op; return someCV(bufferCV(b)); };

export const buildVault = async (contractId: string, debug = false): Promise<Vault | null> => {
  const [addr, name] = contractId.split('.');
  const raw = (await getTokenMetadataCached(contractId)) as TokenCacheData & {
    tokenAContract?: string; tokenBContract?: string; lpRebatePercent?: number | null;
  };
  if (!raw || (raw as any).error) { if (debug) console.warn(`metadata miss ${contractId}`); return null; }
  const { tokenAContract, tokenBContract } = raw;
  if (!tokenAContract || !tokenBContract) { if (debug) console.warn(`missing base tokens ${contractId}`); return null; }

  const [aMeta, bMeta] = await Promise.all([getTokenMetadataCached(tokenAContract), getTokenMetadataCached(tokenBContract)]);
  const derive = (m: any, cid: string): Token => { const [a, n] = cid.split('.'); return { contractId: cid, contractAddress: a, contractName: n, name: m.name || n, symbol: m.symbol || '???', decimals: m.decimals ?? 0, identifier: m.identifier ?? undefined, description: m.description || '', image: m.image || '', type: m.type || '', }; };
  const tokenA = derive(aMeta, tokenAContract); const tokenB = derive(bMeta, tokenBContract);

  let reservesA = 0, reservesB = 0;
  try { const r = await callReadOnlyFunction(addr, name, 'get-reserves-quote', []); reservesA = Number(r.dx.value); reservesB = Number(r.dy.value); } catch (e) { if (debug) console.warn(`reserve fail ${contractId}`, e); }

  return { type: raw.type || '', contractId, contractAddress: addr, contractName: name, name: raw.name || name, symbol: raw.symbol || 'LP', decimals: raw.decimals ?? 0, identifier: raw.identifier || contractId, description: raw.description || '', image: raw.image || '', fee: raw.lpRebatePercent ? Math.floor((Number(raw.lpRebatePercent) / 100) * 1_000_000) : 0, externalPoolId: raw.externalPoolId || '', engineContractId: raw.engineContractId || '', tokenA, tokenB, reservesA, reservesB };
};

export const quoteVault = async (v: Vault, amt: number, op: number): Promise<Delta | null> => {
  try { const r = await callReadOnlyFunction(v.contractAddress, v.contractName, 'quote', [uintCV(amt), opcodeCV(op)]); return { dx: Number(r.value.dx.value), dy: Number(r.value.dy.value), dk: Number(r.value.dk.value) }; } catch { return null; }
};

// ---------------------------------------------------------------------------
//  Router class  (stateful)
// ---------------------------------------------------------------------------
export class Router {
  readonly edges = new Map<string, Vault>();
  readonly nodes = new Map<string, GraphNode>();
  config: RouterConfig;

  constructor(cfg: Partial<RouterConfig> = {}) { this.config = { ...defaultConfig, ...cfg }; }

  loadVaults(vaults: Vault[]) {
    this.edges.clear(); this.nodes.clear();
    for (const v of vaults) {
      this.edges.set(v.contractId, v);
      const t0 = v.tokenA, t1 = v.tokenB;
      if (!this.nodes.has(t0.contractId)) this.nodes.set(t0.contractId, { token: t0, edges: new Map() });
      if (!this.nodes.has(t1.contractId)) this.nodes.set(t1.contractId, { token: t1, edges: new Map() });
      const n0 = this.nodes.get(t0.contractId)!; const n1 = this.nodes.get(t1.contractId)!;
      n0.edges.set(`${t1.contractId}-${v.contractId}`, { vault: v, target: t1 });
      n1.edges.set(`${t0.contractId}-${v.contractId}`, { vault: v, target: t0 });
    }
    if (this.config.debug) console.log(`[router] loaded ${vaults.length} pools → ${this.nodes.size} tokens`);
  }

  private findAllPaths(from: string, to: string, path: Token[] = [], visited = new Set<string>()): Token[][] {
    const res: Token[][] = []; const node = this.nodes.get(from); if (!node) return res;
    const nextPath = [...path, node.token];
    if (from === to && nextPath.length >= 2) res.push(nextPath);
    if (nextPath.length > this.config.maxHops) return res;
    const groups = new Map<string, GraphEdge[]>(); node.edges.forEach(e => { const tid = e.target.contractId; if (!groups.has(tid)) groups.set(tid, []); groups.get(tid)!.push(e); });
    groups.forEach((edges, tgt) => {
      for (const e of edges) {
        if (visited.has(e.vault.contractId)) continue;
        const newVisited = new Set(visited).add(e.vault.contractId);
        res.push(...this.findAllPaths(tgt, to, nextPath, newVisited));
      }
    });
    return res;
  }

  private async evaluatePath(path: Token[], amount: number): Promise<Route | Error> {
    try {
      let cur = amount; const hops: Hop[] = [];
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1]; const node = this.nodes.get(a.contractId); if (!node) throw new Error('node miss');
        const edges = Array.from(node.edges.values()).filter(e => e.target.contractId === b.contractId);
        if (!edges.length) throw new Error('edge miss');
        let best: { q: Quote; e: GraphEdge } | null = null;
        for (const e of edges) {
          const op = a.contractId === e.vault.tokenA.contractId ? OPCODES.SWAP_A_TO_B : OPCODES.SWAP_B_TO_A;
          const delta = await quoteVault(e.vault, cur, op);
          if (!delta) continue;
          const q: Quote = { amountIn: delta.dx, amountOut: delta.dy, expectedPrice: delta.dy / cur, minimumReceived: Math.floor(delta.dy * (1 - this.config.defaultSlippage)), fee: e.vault.fee, opcode: op };
          if (!best || q.amountOut > best.q.amountOut) best = { q, e };
        }
        if (!best) throw new Error('quoting failed');
        hops.push({ vault: best.e.vault, tokenIn: a, tokenOut: b, opcode: best.q.opcode, quote: { amountIn: cur, amountOut: best.q.amountOut } });
        cur = best.q.amountOut;
      }
      return { path, hops, amountIn: amount, amountOut: cur };
    } catch (err) { return err instanceof Error ? err : new Error(String(err)); }
  }

  async findBestRoute(from: string, to: string, amount: number): Promise<Route | Error> {
    const paths = this.findAllPaths(from, to);
    if (!paths.length) return new Error('no paths');
    const routes = await Promise.all(paths.map(p => this.evaluatePath(p, amount)));
    const ok = routes.filter((r): r is Route => !(r instanceof Error));
    return ok.length ? ok.sort((a, b) => b.amountOut - a.amountOut)[0] : new Error('all routes failed');
  }

  stats() { let edges = 0; this.nodes.forEach(n => (edges += n.edges.size)); return { tokens: this.nodes.size, pools: this.edges.size, edges }; }
}

// ---------------------------------------------------------------------------
//  Swap‑execution helper (still pure, Router instance supplies state) ---------
// ---------------------------------------------------------------------------
export const buildSwapTransaction = async (router: Router, route: Route, sender: string) => {
  const cfg = router.config;
  if (!cfg.routerContractId) throw new Error('router addr/name missing');
  const pcMap = new Map<string, any>();
  const add = (pc: FungiblePostCondition) => {
    const k = `${pc.address}-${pc.asset ?? 'STX'}`;
    if (pcMap.has(k)) pcMap.get(k).amount = BigInt(pcMap.get(k).amount) + BigInt(pc.amount);
    else pcMap.set(k, { ...pc });
  };
  for (const h of route.hops) {
    const pcs = await buildSwapPostConditions(h, router.config, sender);
    (pcs as FungiblePostCondition[]).forEach(add);
  }
  const fnArgs = [uintCV(route.amountIn), ...route.hops.map(h => tupleCV({ pool: principalCV(h.vault.contractId), opcode: opcodeCV(h.opcode) }))];
  return { contract: cfg.routerContractId as `${string}.${string}`, functionName: `swap-${route.hops.length}`, functionArgs: fnArgs, postConditions: Array.from(pcMap.values()), network: 'mainnet' };
};

export const buildSwapPostConditions = async (hop: Hop, cfg: RouterConfig, sender: string) => {
  const mk = (t: Token, amt: bigint, princ: string, cond: 'eq' | 'gte' | 'lte') => {
    if (t.contractId === '.stx') return cond === 'eq' ? Pc.principal(princ).willSendEq(amt).ustx() : cond === 'gte' ? Pc.principal(princ).willSendGte(amt).ustx() : Pc.principal(princ).willSendLte(amt).ustx();
    return cond === 'eq' ? Pc.principal(princ).willSendEq(amt).ft(t.contractId as any, t.identifier!) : cond === 'gte' ? Pc.principal(princ).willSendGte(amt).ft(t.contractId as any, t.identifier!) : Pc.principal(princ).willSendLte(amt).ft(t.contractId as any, t.identifier!);
  };
  const { tokenIn, tokenOut, vault, opcode } = hop;
  const amtIn = BigInt(hop.quote?.amountIn ?? 0);
  const amtOut = BigInt(hop.quote?.amountOut ?? 0);
  if (opcode === OPCODES.OP_DEPOSIT) return [mk(tokenIn, amtIn, sender, 'eq')];
  if (opcode === OPCODES.OP_WITHDRAW) return [mk(tokenOut, amtOut, vault.externalPoolId || vault.contractId, 'eq')];
  const maxIn = BigInt(Math.floor(Number(amtIn) * (1 + cfg.defaultSlippage)));
  const minOut = BigInt(Math.floor(Number(amtOut) * (1 - cfg.defaultSlippage)));
  return [mk(tokenIn, maxIn, sender, 'lte'), mk(tokenOut, minOut, vault.externalPoolId || vault.contractId, 'gte')];
};

// ---------------------------------------------------------------------------
//  Vault‑fetch helpers (dex-cache integration) ------------------------------
// ---------------------------------------------------------------------------

/** Default public cache endpoint */
const DEFAULT_DEX_CACHE_URL = 'https://invest.charisma.rocks/api/v1';

/**
 * Fetch raw vault objects from the dex‑cache REST API.
 * Throws on non‑200 or malformed payload.
 */
export const fetchVaults = async (dexCacheUrl: string = DEFAULT_DEX_CACHE_URL): Promise<Vault[]> => {
  const res: any = await fetch(`${dexCacheUrl}/vaults`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => undefined);
    throw new Error(errBody?.error ?? `dex-cache request failed (${res.status})`);
  }
  const json = await res.json();
  if (json.status !== 'success' || !Array.isArray(json.data)) {
    throw new Error('dex-cache: unexpected response shape');
  }
  return json.data as Vault[];
};

/**
 * Convenience: pull vaults from dex‑cache and immediately load them into the
 * supplied Router instance.
 *
 * @returns  The vault array so callers can use/reserialize it if needed.
 */
export const loadVaults = async (router: Router, dexCacheUrl: string = DEFAULT_DEX_CACHE_URL): Promise<Vault[]> => {
  const vaults = await fetchVaults(dexCacheUrl);
  router.loadVaults(vaults);
  return vaults;
};

export const listTokens = async (dexCacheUrl: string = DEFAULT_DEX_CACHE_URL): Promise<Token[]> => {
  const res: any = await fetch(`${dexCacheUrl}/tokens`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => undefined);
    throw new Error(errBody?.error ?? `dex-ache request failed (${res.status})`);
  }
  const json = await res.json();
  if (json.status !== 'success' || !Array.isArray(json.data)) {
    throw new Error('dex-cache: unexpected response shape');
  }
  return json.data as Token[];
};

// ---------------------------------------------------------------------------
//  Quote helpers (dex-api integration) ------------------------------
// ---------------------------------------------------------------------------

const DEFAULT_DEX_API_URL = 'https://swap.charisma.rocks/api/v1';

export const fetchQuote = async (from: string, to: string, amount: number, dexApiUrl: string = DEFAULT_DEX_API_URL) => {
  const res: any = await fetch(`${dexApiUrl}/quote?tokenIn=${from}&tokenOut=${to}&amount=${amount}`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => undefined);
    throw new Error(errBody?.error ?? `dex-api request failed (${res.status})`);
  }
  const json = await res.json();
  return json.data as Quote;
};