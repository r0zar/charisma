---
name: dexterity-external-pool
description: Wrap a third-party AMM/LP pool (Bitflow XYK or DLMM, ALEX, Velar, etc.) as a Dexterity vault so Charisma's routers can swap through it. Use when integrating, wrapping, normalizing, deploying, testing, or registering an external liquidity pool in the Dexterity protocol, or when an external-pool vault won't quote, route, or pass post-conditions.
---

# Integrating an external pool into Dexterity

A wrapper vault is a **translator**. It holds no tokens. It exposes the Dexterity interface
(`execute` + `quote`) and forwards to the external protocol. Tokens move directly between the
caller and the **external pool contract**, which is why `externalPoolId` must point at the
contract that actually holds and sends the tokens.

Reference wrappers:
- `packages/clarity/contracts/vaults/feeling-zesty.clar`: Bitflow **DLMM** (bins, custom quote replay). Deployed and verified.
- On-chain only (fetch the source): `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.nakamoto-flow` (Bitflow **XYK**, simplest),
  `.lightning-in-a-bottle` (XYK), `.biochemical-reaction` (ALEX, decimal scaling to 8-dec fixed).
- Source: `curl -s "https://api.hiro.so/v2/contracts/source/<addr>/<name>?proof=0"`

## 1. Find the right pool

- Pools often ship in **versions** (e.g. `dlmm-pool-zest-stx-v-1/-v-2/-v-3`). Check every version's balances.
  The first one you find is often not the biggest (ZEST-STX v-1 held 215 STX, v-2 held 154k).
- Find holders of the base token: `https://api.hiro.so/extended/v1/tokens/ft/<token>::<asset>/holders`
- Read the pool's config (`get-pool` etc.) to learn: core/router contracts, x/y tokens, fees, whether it's live.

## 2. Map the wiring (do this before writing code)

Answer each of these from the source:

| Question | Why it matters |
|---|---|
| Which contract is the entry point (router/core)? | That's what `execute` calls |
| Who does the protocol treat as the caller (`tx-sender` vs `contract-caller`)? | Our routers differ (see below) |
| Which contract **holds** the tokens and sends output? | Becomes `externalPoolId` (drives post-conditions) |
| Which token is x/A and which is y/B? | Opcode 0x00 = A→B. The metadata order must match. |
| Is there a read-only quote? What's its exact math? | The quote must equal the swap to the unit |
| Is the LP a SIP-010 token? | If not (e.g. DLMM = SIP-013 per bin), make the wrapper swap-only |

Our two routers:
- `SP2ZNG…multihop` (dexterity SDK): plain `contract-call?`, so **the user** is `tx-sender`. Tokens: user ⇄ pool.
- `SP2ZNG…x-multihop-rc9` (blaze SDK): `as-contract`, so **the router** is `tx-sender`. Tokens: router ⇄ pool.
- Post-conditions (`packages/dexterity/src/index.ts` `buildSwapPostConditions`, `packages/blaze-sdk/src/solvers/vaults/utils/postconditions.ts`):
  input is sent by user/router; output is sent by `vault.externalPoolId || vault.contractId`.
  **Never use `as-contract` in the wrapper**, or the sender changes and deny-mode post-conditions fail.

## 3. Write the wrapper

- `(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)`
- `execute`: 0x00 A→B, 0x01 B→A, returning `{dx: consumed-in, dy: out, dk: u0}`.
- `quote`: 0x00/0x01 with the same shape, and 0x04 reserves `{dx: reserve-A, dy: reserve-B, dk: lp-supply}`.
- Add `get-name`, `get-symbol`, `get-decimals`, `get-token-uri` (URI =
  `https://metadata.charisma.rocks/api/v1/metadata/<deployer>.<contract-name>`). Registration looks these up.
- Hardcode the external principals (contract-call targets must be literals). Immutable config (e.g. DLMM bin
  factors) can be read once into a `define-constant` at deploy.
- Reserves: the external pool's token balances minus any protocol fees it holds (STX = `stx-get-balance`).

## 4. Test on a mainnet fork (no risk)

The installed `clarinet` may be too old for Clarity 4 contracts. Use the latest `@stacks/clarinet-sdk` in a
**scratch** project (not the repo). Templates are in `scripts/`:

```
mkdir -p $SCRATCH/sim/contracts && cd $SCRATCH/sim
cp <skill>/scripts/Clarinet.toml.template Clarinet.toml   # set initial_height to tip-5, contract name
cp -r <repo>/packages/clarity/settings . && cp <wrapper>.clar contracts/
printf '{"name":"sim","private":true,"type":"module"}' > package.json
pnpm add -D @stacks/clarinet-sdk @stacks/transactions @stacks/encryption @stacks/common
```

- **Use a real SP wallet as the sender** (a holder of both tokens). Devnet ST addresses fail mainnet
  `is-standard` checks inside external pools.
- `scripts/quote-vs-swap.mjs`: quote must **equal** execute for tiny→huge sizes, both directions,
  including multi-bin/multi-tick trades.
- `scripts/routers.mjs`: both routers, single hop and 2-hop through a deep Charisma STX pool
  (e.g. `welsh-community-lp`), with a deny-mode post-condition check built exactly as each SDK builds them.
- **Read budget:** run `quote` with `initSimnet(..., false, { trackCosts: true })` and check
  `costs.total.readLength < 500000`. Public Hiro read-only calls are capped at 500 KB of read length. Every
  `contract-call?` re-loads the callee (DLMM ≈ 23.6 KB per bin, so only ~19 bins fit). On-chain execution has a
  ~200× bigger budget, so swaps still work; oversized quotes just fail over the API and the router skips them.
- The sandbox can't load freshly deployed Clarity 4 contracts from mainnet (analysis-metadata parse error),
  so test an identical local copy (`cmp` the source).

## 5. Deploy

- Deployer key for `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS`: `apps/simple-swap/.env.local` `PRIVATE_KEY`.
  Read it in-script; **never print it**.
- Naming: named wrappers are unversioned (`nakamoto-flow`, `feeling-zesty`). Ship a fix as `<name>-v2`.
  The name is baked into the token URI.
- Check the name is free (`/v2/contracts/interface/<addr>/<name>` → 404). Estimate the fee with
  `fetchFeeEstimateTransaction`. When the network is quiet, ~0.1 STX is plenty.
- `scripts/deploy.mjs`: Clarity 4, deny mode, broadcast, then poll `/extended/v1/tx/<txid>`.

## 6. Verify live

1. Interface and `get-name` etc. read back correctly.
2. Live quotes over the public API, including a size sweep to find where the read budget breaks.
3. Tiny real round trip (`scripts/live-swap.mjs 01 1000000`, then `00 <received>`) with deny-mode
   post-conditions: sender ≤ amount, **external pool** ≥ 99% of the quote. Confirm dy == quote exactly.

## 7. Metadata and registration

`scripts/register.mjs` signs both requests with the deployer key:
- **Metadata** → `POST https://metadata.charisma.rocks/api/v1/metadata/<id>`, signing the message `<id>`.
  Posts merge into the existing entry.
- **Vault registry** → `POST https://invest.charisma.rocks/api/v1/admin/vaults/<id>/confirm`, signing the
  message `dex-cache-admin-access`. Body `lpToken`: `type: 'POOL'`, `protocol: 'BITFLOW'|'ALEX'|…`,
  `externalPoolId: <pool that holds tokens>`, `lpRebatePercent: <total fee %>` (becomes `fee` on a 1e6 scale),
  plus `tokenA`/`tokenB` in **opcode order**. STX is `contractId: '.stx'`.

## 8. Make it routable

- Reserves start at 0 and the cron `/api/cron/update-reserves` (every 10 min) fills them via `quote 0x04`.
- The invest vault list is edge-cached for 10 min, and the swap server reloads vaults every 10 min.
  So a new vault routes within ~10–20 min.
- If you're impatient: purge the invest CDN. Link a scratch dir with
  `vercel link --yes --project charisma-dex-cache --scope pointblankdev --cwd <dir>`, then
  `vercel cache purge --yes --cwd <dir>`, then **delete the `.env.local` that `link` pulls**.
- Verify with `https://swap.charisma.rocks/api/v1/quote?tokenIn=<A>&tokenOut=<B>&amount=<n>`: the hops
  should include the new vault.

## 9. Check the external tokens' metadata

- Check both tokens (and any subnet versions) on `https://tokens.charisma.rocks/api/v1/sip10/<id>`.
  Placeholder names or `ui-avatars.com` images mean a stale cache (30-day TTL).
- Force-refresh with `scripts/refresh-token.mts`
  (`cd apps/token-cache && node --env-file=.env.local --import tsx <script> <id>`).
- Subnet tokens hold the base token and have no FT of their own. Their `identifier` must be the **base
  asset name** (e.g. `zest`), not the contract name. A refresh can overwrite it, so re-check after refreshing.
- The token cache doesn't read the metadata service (it calls an outdated path that returns 404). That's
  intentional for now: the service holds placeholder entries for many third-party tokens.
