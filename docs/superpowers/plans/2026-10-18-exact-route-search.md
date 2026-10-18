# Exact Route Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The swap router finds the best route with real on-chain quotes only, so no guess about a pool can hide the best route (the cause of USDCx's $0.10 prices on 17–18 October 2026).

**Architecture:** `Router.findBestRoute` in `packages/dexterity` becomes a hop-by-hop search: each hop quotes every pool out of every token held so far, toward tokens that can still reach the destination in the hops left, and keeps only the most of each token. Everything that existed to guess (x·y=k estimates, the top-3 shortlist, `withSpotPrices` probes) is deleted. `maxHops` stays 4, plus 1 for a trade in or out of a subnet.

**Tech Stack:** TypeScript, vitest, `@stacks/transactions` v7, Hiro read-only calls through `@repo/polyglot`.

**Design:** approved by Ross in chat on 2026-10-18 (option B, at 4 hops). Measured cost on live pools, before the "most of each token" pruning: median 237 real quotes per swap quote, worst 426 (today: 10 and 21). If Hiro starts answering 429, a later "busy mode" can drop to 3 hops; not built now.

**Baseline:** `main` at `04ee851a`, dexterity's 8 tests pass.

---

## Working notes for every task

- **Commands** run from the repo root unless a step says `cd`.
- **Dev servers:** Ross runs them. Don't build apps.
- **pnpm:** local pnpm is 9.15 but the repo pins 10.5.2. Deps were restored on 2026-10-18 with `npx -y pnpm@10.5.2 install --frozen-lockfile` (full install, from the root). If `cd packages/dexterity && pnpm exec vitest run` can't find vitest, run that again first. Never run a filtered 9.15 install: it prunes shared packages.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Exact search in `findBestRoute`

**Files:**
- Modify: `packages/dexterity/src/index.ts` (header comment, `Vault`, `isPricedByQuote`, `RouterConfig`, `defaultConfig`, `EstimatedPath`, the `Router` search methods, `loadVaults`, `withSpotPrices`)
- Test: `packages/dexterity/src/__tests__/index.test.ts`

- [ ] **Step 1: Write the tests**

In `packages/dexterity/src/__tests__/index.test.ts`, change the import to:

```ts
import {
  Router,
  defaultConfig,
  buildSwapTransaction,
  fetchQuote,
  OPCODES,
  Vault,
  Token,
} from "../index";
```

Replace the whole `describe("withSpotPrices", …)` block at the end of the file with:

```ts
describe("findBestRoute: exact search", () => {
  const token = (name: string, type = 'SIP10'): Token => ({
    ...mockTokenA, type, contractId: `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.${name}`, symbol: name.toUpperCase(), identifier: name,
  });
  const pool = (name: string, a: Token, b: Token, reservesA = 1_000_000, reservesB = 1_000_000): Vault => ({
    ...mockVault, contractId: `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.${name}`, tokenA: a, tokenB: b, reservesA, reservesB,
  });
  /** Each pool pays `rate` units of B per unit of A (and the inverse for B → A); pools in `failing` can't be quoted */
  const quoting = (rates: Record<string, number>, failing: string[] = []) => (contractId: string, _fn: string, args: any[]) => {
    const name = contractId.split('.')[1];
    if (failing.includes(name)) return Promise.reject(new Error('quote failed'));
    const amount = Number(args[0].value);
    const op = parseInt(args[1].value.value.slice(0, 2), 16);
    const rate = op === OPCODES.SWAP_B_TO_A ? 1 / rates[name] : rates[name];
    return Promise.resolve({ value: { dx: { value: String(amount) }, dy: { value: String(Math.floor(amount * rate)) }, dk: { value: '0' } } });
  };
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(n => token(n));
  const name = (v: Vault) => v.contractId.split('.')[1];

  beforeEach(() => vi.clearAllMocks());

  it("finds the direct pool even when four lopsided pools look far better on paper", async () => {
    const decoys = [1, 2, 3, 4].map(i => token(`c${i}`));
    // Balances like Bitflow LEO-STX on 18 Oct: plenty of the token out, almost none in, so x·y=k math promises a fortune
    const vaults = [pool('direct', a, b), ...decoys.flatMap(x => [pool(`a-${x.identifier}`, a, x, 1, 1e12), pool(`${x.identifier}-b`, x, b, 1, 1e12)])];
    mockCallReadOnly.mockImplementation(quoting({ direct: 0.9, ...Object.fromEntries(decoys.flatMap(x => [[`a-${x.identifier}`, 1], [`${x.identifier}-b`, 0.01]])) }));
    const router = new Router({ ...defaultConfig });
    router.loadVaults(vaults);
    const route = await router.findBestRoute(a.contractId, b.contractId, 1_000_000);
    expect(route.amountOut).toBe(900_000);
    expect(route.hops.map(h => name(h.vault))).toEqual(['direct']);
  });

  it("takes a two-hop route when it pays more than the direct pool", async () => {
    mockCallReadOnly.mockImplementation(quoting({ 'a-b': 1, 'a-c': 0.5, 'c-b': 4 }));
    const router = new Router({ ...defaultConfig });
    router.loadVaults([pool('a-b', a, b), pool('a-c', a, c), pool('c-b', c, b)]);
    const route = await router.findBestRoute(a.contractId, b.contractId, 1_000_000);
    expect(route.amountOut).toBe(2_000_000);
    expect(route.path.map(t => t.identifier)).toEqual(['a', 'c', 'b']);
    expect(route.hops.map(h => h.quote)).toEqual([{ amountIn: 1_000_000, amountOut: 500_000 }, { amountIn: 500_000, amountOut: 2_000_000 }]);
  });

  it("routes around a pool whose quote fails", async () => {
    mockCallReadOnly.mockImplementation(quoting({ 'a-b': 1, 'a-c': 0.5, 'c-b': 1 }, ['a-b']));
    const router = new Router({ ...defaultConfig });
    router.loadVaults([pool('a-b', a, b), pool('a-c', a, c), pool('c-b', c, b)]);
    const route = await router.findBestRoute(a.contractId, b.contractId, 1_000_000);
    expect(route.amountOut).toBe(500_000);
    expect(route.hops.map(h => name(h.vault))).toEqual(['a-c', 'c-b']);
  });

  it("gives a trade out of a subnet one extra hop for the 1:1 unwrap", async () => {
    const sa: Token = { ...token('a-subnet', 'SUBNET'), base: a.contractId };
    mockCallReadOnly.mockImplementation(quoting({ 'a-wrap': 1, 'a-b': 2 }));
    const router = new Router({ ...defaultConfig, maxHops: 1 });
    router.loadVaults([pool('a-wrap', a, sa), pool('a-b', a, b)]);
    const route = await router.findBestRoute(sa.contractId, b.contractId, 1_000_000);
    expect(route.hops.map(h => h.opcode)).toEqual([OPCODES.OP_WITHDRAW, OPCODES.SWAP_A_TO_B]);
    expect(route.amountOut).toBe(2_000_000);
  });

  it("closes a loop back to the starting token when from and to are the same", async () => {
    mockCallReadOnly.mockImplementation(quoting({ 'a-b-1': 2, 'a-b-2': 1 }));
    const router = new Router({ ...defaultConfig });
    router.loadVaults([pool('a-b-1', a, b), pool('a-b-2', a, b)]);
    const route = await router.findBestRoute(a.contractId, a.contractId, 1_000_000);
    // Out through the pool paying 2 B per A, back through the one paying 1 A per B
    expect(route.amountOut).toBe(2_000_000);
    expect(route.hops.map(h => name(h.vault))).toEqual(['a-b-1', 'a-b-2']);
  });

  it("returns an empty route, without quoting, when no pools connect the tokens", async () => {
    const router = new Router({ ...defaultConfig });
    router.loadVaults([pool('a-b', a, b), pool('c-d', c, d)]);
    expect(await router.findBestRoute(a.contractId, c.contractId, 1_000_000)).toEqual({ path: [], hops: [], amountIn: 0, amountOut: 0 });
    expect(mockCallReadOnly).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them; the lopsided-pools test must fail**

Run: `cd packages/dexterity && pnpm exec vitest run -t "exact search"`
Expected: "finds the direct pool even when four lopsided pools look far better on paper" FAILS (the old router quotes only the 3 best-looking routes, all decoys, so `amountOut` is 10000, not 900000). The others may pass.

- [ ] **Step 3: Replace the search**

In `packages/dexterity/src/index.ts`:

1. Header comment (lines 1–10) becomes:

```ts
/*--------------------------------------------------------------
 * Charisma DEX ― Router: exact route search with real quotes
 *
 *  ‣ Finds the best route with on-chain quotes only, hop by hop
 *  ‣ Quote result caching with TTL
 *
 *  All business logic lives in testable, side‑effect‑free helpers,
 *  keeping the mutable surface small and predictable.
 *-------------------------------------------------------------*/
```

2. Delete the `spotPrice` field (and its doc comment) from `Vault`, and delete `isPricedByQuote` with its comment.

3. `RouterConfig` loses `maxPathsToEvaluate`; `defaultConfig` becomes:

```ts
export const defaultConfig: RouterConfig = {
  maxHops: 4,
  debug: false,
  defaultSlippage: 0.01,
  routerContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop',
  quoteCacheTTL: 30000, // 30 seconds
};
```

4. Replace the `EstimatedPath` interface (and its comment) with:

```ts
/** Part of a route found so far: how much of `token` it holds after `hops` */
interface Reach {
  token: Token;
  amount: number;
  hops: Hop[];
}
```

5. In `Router`, delete `estimateOutput`, `estimatePath`, `findAllPaths`, `evaluatePath` and `findBestRoute`, and put this in their place (after `clearStaleCache`):

```ts
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
```

6. `loadVaults` stops probing, and `withSpotPrices` (with its comment) is deleted:

```ts
export const loadVaults = async (router: Router, dexCacheUrl: string = getDexCacheUrl()): Promise<Vault[]> => {
  const vaults = await fetchVaults(dexCacheUrl);
  router.loadVaults(vaults);
  return vaults;
};
```

- [ ] **Step 4: Run all dexterity tests**

Run: `cd packages/dexterity && pnpm exec vitest run`
Expected: 12 passed (the 6 original tests and the 6 new ones).

Run: `cd packages/dexterity && pnpm exec tsc --noEmit --types node 2>&1 | grep "^src/index.ts"`
Expected: no output. (`--types node` skips the stale `jest` types entry, which otherwise stops `tsc` before it checks anything; the test file's two existing `global.fetch` errors are not ours.)

Run: `git grep -n "withSpotPrices\|isPricedByQuote\|spotPrice\|maxPathsToEvaluate\|estimatePath\|findAllPaths" -- apps packages services ':!docs'`
Expected: only the two docs lines that Task 2 rewrites (`packages/dexterity/README.md`, `apps/docs/docs/prices/overview.md`).

- [ ] **Step 5: Commit**

```bash
git add packages/dexterity/src/index.ts packages/dexterity/src/__tests__/index.test.ts
git commit -F - <<'EOF'
feat(dexterity): The router finds the best route with real quotes only, so no guess about a pool can hide it

findBestRoute now searches hop by hop: it quotes every pool out of every token held so far, toward tokens that can
still reach the destination, and keeps the most of each token. The x·y=k estimates, the top-3 shortlist and the
withSpotPrices probes are gone; a lopsided pool's estimate sent USDCx's sell route through dust pools on 17–18 Oct.
maxHops stays 4 (5 in or out of a subnet), and the default drops from 5 to 4.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Docs

**Files:**
- Modify: `packages/dexterity/README.md`
- Modify: `apps/docs/docs/prices/overview.md`

- [ ] **Step 1: README**

In `packages/dexterity/README.md`, replace

```
`buildSwapTransaction` and `buildSwapPostConditions` build the contract call with deny-mode post-conditions for a
route. Bin (DLMM) and stableswap pools are priced with an on-chain spot-price probe (`withSpotPrices`).
```

with

```
`findBestRoute` uses real on-chain quotes only: hop by hop it quotes every pool out of every token reached and keeps
the most of each token, up to `maxHops` (default 4, one more for a trade in or out of a subnet). Nothing is
estimated, so a pool whose balances don't show its price (bin or stable pools) can't hide the best route.

`buildSwapTransaction` and `buildSwapPostConditions` build the contract call with deny-mode post-conditions for a
route.
```

- [ ] **Step 2: Version 2.0**

Removing `withSpotPrices`, `isPricedByQuote`, `Vault.spotPrice` and `maxPathsToEvaluate`, and the `maxHops` default going from 5 to 4, break the 1.0 API, and the README promises semver. In `packages/dexterity/package.json` set `"version": "2.0.0"`. In `packages/dexterity/README.md`, above `## 1.0`, add:

```
## 2.0

2.0 finds routes with real quotes only. `withSpotPrices`, `isPricedByQuote`, `Vault.spotPrice` and `maxPathsToEvaluate` are gone, and `maxHops` defaults to 4 (was 5).

```

- [ ] **Step 3: Prices docs**

In `apps/docs/docs/prices/overview.md`, replace the paragraph under `## Routes` that starts "The router (`dexterity-sdk`) searches paths of up to 4 hops" with:

```
The router (`dexterity-sdk`) searches paths of up to 4 hops through Charisma pools and wrapped external pools from Bitflow, ALEX, Arkadiko and Velar. A trade in or out of a Blaze subnet gets one extra step for the 1:1 wrap. It uses real on-chain quotes only: hop by hop it quotes every pool out of every token reached and keeps the most of each, so a pool whose balances don't show its price (Bitflow DLMM bin pools, stableswaps) can't hide the best route.
```

- [ ] **Step 4: Commit**

```bash
git add packages/dexterity/README.md packages/dexterity/package.json apps/docs/docs/prices/overview.md
git commit -F - <<'EOF'
docs(dexterity,prices): The router's docs describe the exact, quote-only route search; dexterity-sdk is 2.0.0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Before and after, on mainnet

Compare the old and new router on every priced token, buying with 1000 sats and selling about $1 back, the way the prices recorder does. Nothing here is committed.

- [ ] **Step 1: Hiro key.** Link a scratch dir to `charisma-simple-swap` (scope `pointblankdev`), `vercel env pull` production into it, and check `HIRO_API_KEY` is non-empty without printing it. If it's missing or empty, run Step 3 on 10 tokens only (USDCx, PEPE, STX, CHA, WELSH, aeUSDC, USDA, LEO, ALEX, DOG) and say so.

- [ ] **Step 2: Inputs.** `git show 04ee851a:packages/dexterity/src/index.ts > packages/dexterity/src/old-router.tmp.ts` (next to `index.ts`, so its `./burn-swapper-standalone` export resolves) and `curl -s https://prices.charisma.rocks/api/v1/prices -o <scratch>/prices.json`.

- [ ] **Step 3: Compare.** Write `packages/dexterity/src/__tests__/compare.tmp.test.ts`:

```ts
import { it } from "vitest";
import { readFileSync } from "fs";
import * as next from "../index";
import * as prev from "../old-router.tmp";

const SBTC = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';
const INVEST = 'https://invest.charisma.rocks/api/v1';
const ONLY = process.env.ONLY?.split(',');

it("new search matches or beats the old one", async () => {
  const before = new prev.Router({ maxHops: 4 });
  await prev.loadVaults(before, INVEST);
  const after = new next.Router({ maxHops: 4 });
  await next.loadVaults(after, INVEST);
  const tokens = (JSON.parse(readFileSync(process.env.PRICES_JSON!, 'utf8')).tokens as any[])
    .filter(t => t.contractId !== SBTC && after.nodes.get(t.contractId)?.token.type !== 'SUBNET' && after.nodes.has(t.contractId))
    .filter(t => !ONLY || ONLY.includes(t.symbol));
  const rows: { token: string; side: string; before: number; after: number }[] = [];
  const out = async (r: any, from: string, to: string, amt: number) => { try { return (await r.findBestRoute(from, to, amt)).amountOut; } catch { return 0; } };
  for (const t of tokens) {
    const sell = Math.round(10 ** t.decimals / t.usd);
    for (const [side, from, to, amt] of [['buy', SBTC, t.contractId, 1000], ['sell', t.contractId, SBTC, sell]] as const) {
      rows.push({ token: t.symbol, side, before: await out(before, from, to, amt), after: await out(after, from, to, amt) });
    }
  }
  const better = rows.filter(r => r.after > r.before * 1.001);
  const worse = rows.filter(r => r.after < r.before * 0.999);
  process.stdout.write(`RESULT ${rows.length} quotes: ${better.length} better, ${worse.length} worse, ${rows.length - better.length - worse.length} same\n`);
  for (const r of [...better, ...worse]) process.stdout.write(`RESULT ${r.after > r.before ? 'better' : 'worse '} ${r.token} ${r.side}: ${r.before} -> ${r.after}\n`);
}, 3_600_000);
```

Run: `cd packages/dexterity && HIRO_API_KEY=… PRICES_JSON=<scratch>/prices.json pnpm exec vitest run src/__tests__/compare.tmp.test.ts 2>&1 | grep RESULT` (add `ONLY=USDCx,PEPE,…` if Step 1 found no key).
Expected: 0 worse. (Without a key, expect some "worse" rows that are really 429s.) USDCx and PEPE sells are at least as good as the old router's best windows. Look into any "worse" row before going on: a quote that failed only in the new run (429) shows up as worse.

- [ ] **Step 4: Clean up.** Delete `packages/dexterity/src/old-router.tmp.ts`, `packages/dexterity/src/__tests__/compare.tmp.test.ts`, and the scratch dir with the pulled env file. `git status` shows no stray files.

---

### Task 4: Ship and watch

- [ ] **Step 1:** Ask Ross before pushing. Then `git push origin main`.
- [ ] **Step 2:** Wait for `charisma-simple-swap` and `charisma-prices` production deploys to be Ready (`vercel ls <project> --scope pointblankdev`).
- [ ] **Step 3:** Spot-check `https://swap.charisma.rocks/api/v1/quote` (add 1 to amounts to skip the CDN cache): 100 USDCx → sBTC about 122k sats; sBTC 1000 → PEPE and back about 990 sats; `.stx` → CHA works.
- [ ] **Step 4:** After the next 5-minute recording, USDCx's `roundTripLoss` on `https://prices.charisma.rocks/api/v1/prices/SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` is under 1%.
- [ ] **Step 5:** Check `charisma-simple-swap` runtime logs over the next hour for `429` / `Too Many Requests` and report what's there.
