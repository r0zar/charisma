// Liquidity census: every pool on Bitflow, ALEX, Velar and Arkadiko, read on-chain, priced in USD, and marked
// covered when Charisma's vault registry already routes through it. Writes census.json and prints a summary.
// Usage (needs HIRO_API_KEY): node --env-file=.env.local scripts/liquidity-census.mjs
import { Cl, cvToHex, hexToCV, cvToValue } from '@stacks/transactions';
import fs from 'fs';

const KEY = process.env.HIRO_API_KEY;
if (!KEY) throw new Error('HIRO_API_KEY is not set');
const H = { 'x-api-key': KEY };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: H });
    if (r.status === 429) { await sleep(1500 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  }
  throw new Error(`${url} kept answering 429`);
};
const ro = async (id, fn, args = []) => {
  const [a, n] = id.split('.');
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`https://api.hiro.so/v2/contracts/call-read/${a}/${n}/${fn}`, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ sender: a, arguments: args.map(cvToHex) }) });
    if (r.status === 429) { await sleep(1500 * (i + 1)); continue; }
    const d = await r.json();
    if (!d.okay) throw new Error(`${id}.${fn}: ${d.cause}`);
    return cvToValue(hexToCV(d.result), true);
  }
  throw new Error(`${id}.${fn} kept answering 429`);
};
const pool = async (items, n, fn) => { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; };
const val = (x) => (x && typeof x === 'object' && 'value' in x ? val(x.value) : x);

// Prices (USD per whole token) and decimals, from Charisma's price service
const pr = await (await fetch('https://prices.charisma.rocks/api/v1/prices')).json();
const PRICES = new Map((Array.isArray(pr.tokens) ? pr.tokens : Object.values(pr.tokens)).map((t) => [t.contractId, { usd: t.usd, decimals: t.decimals, symbol: t.symbol }]));
// Wrappers that stand for another token
const ALIAS = {
  'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wstx': '.stx', 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wstx-v2': '.stx',
  'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wrapped-stx-token': '.stx', 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx': '.stx',
  'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2': '.stx',
  'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wcorgi': 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token',
  'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wleo': 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token',
  'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wlialex': 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.auto-alex-v3',
};
const canon = (id) => ALIAS[id] ?? id;
const sym = (id) => PRICES.get(canon(id))?.symbol ?? canon(id).split('.').pop();
const usdOf = (id, units, decimalsOverride) => {
  const p = PRICES.get(canon(id));
  if (!p) return null;
  return Number(units) / 10 ** (decimalsOverride ?? p.decimals) * p.usd;
};

// Charisma's registry: what we already route through
const reg = await (await fetch('https://invest.charisma.rocks/api/v1/vaults')).json();
const vaults = (reg.data ?? reg).filter((v) => v.type === 'POOL');
const coveredContracts = new Set(vaults.map((v) => v.externalPoolId).filter(Boolean));
const pairKey = (proto, a, b) => `${proto}|${[canon(a), canon(b)].sort().join('|')}`;
const coveredPairs = new Set(vaults.filter((v) => ['ALEX', 'ARKADIKO', 'VELAR'].includes(v.protocol)).map((v) => pairKey(v.protocol, v.tokenA.contractId, v.tokenB.contractId)));

// Contracts a deployer created
const deployed = async (addr) => {
  const names = [];
  for (let off = 0; ; off += 50) {
    const d = await get(`https://api.hiro.so/extended/v1/address/${addr}/transactions?limit=50&offset=${off}`);
    for (const t of d.results) if (t.tx_type === 'smart_contract' && t.tx_status === 'success') names.push(t.smart_contract.contract_id);
    if (off + 50 >= d.total) break;
  }
  return names;
};
// Value held by a contract that is itself the pool
const holdings = async (id) => {
  const [ft, stx] = await Promise.all([get(`https://api.hiro.so/extended/v2/addresses/${id}/balances/ft?limit=50`), get(`https://api.hiro.so/extended/v2/addresses/${id}/balances/stx`)]);
  const parts = [{ token: '.stx', units: BigInt(stx.balance ?? 0) }, ...ft.results.map((r) => ({ token: r.token.split('::')[0], units: BigInt(r.balance) }))].filter((p) => p.units > 0n);
  let usd = 0, unpriced = [];
  for (const p of parts) { const u = usdOf(p.token, p.units); if (u === null) unpriced.push(sym(p.token)); else usd += u; }
  return { usd, tokens: parts.map((p) => sym(p.token)), unpriced };
};

const rows = [];
// Bitflow: xyk / stableswap / DLMM pools, one contract each
const bitflowPools = (await Promise.all(['SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR', 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD', 'SPQC38PW542EQJ5M11CR25P7BS1CA6QT4TBXGB3M'].map(deployed)))
  .flat().filter((id) => /\.(xyk-pool-|stableswap-pool-|dlmm-pool-|stableswap-)/.test(id) && !/trait/.test(id));
await pool(bitflowPools, 4, async (id) => { const h = await holdings(id); rows.push({ dex: 'BITFLOW', pool: id.split('.')[1], id, ...h, covered: coveredContracts.has(id) }); });
// Velar: standalone pools (one contract each) and core pools (all inside univ2-core)
const velarStandalone = (await deployed('SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1')).filter((id) => /\.(univ2-pool-v|curve-pool-v)/.test(id));
await pool(velarStandalone, 4, async (id) => { const h = await holdings(id); rows.push({ dex: 'VELAR', pool: id.split('.')[1], id, ...h, covered: coveredContracts.has(id) }); });
const nr = Number(val(await ro('SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-core', 'get-nr-pools')));
await pool(Array.from({ length: nr }, (_, i) => i + 1), 4, async (n) => {
  const p = await ro('SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-core', 'do-get-pool', [Cl.uint(n)]);
  const t0 = val(p.token0), t1 = val(p.token1), u0 = usdOf(t0, val(p.reserve0)), u1 = usdOf(t1, val(p.reserve1));
  rows.push({ dex: 'VELAR', pool: `core #${n} ${sym(t0)}-${sym(t1)}`, id: `univ2-core:${n}`, usd: (u0 ?? 0) + (u1 ?? 0), tokens: [sym(t0), sym(t1)],
    unpriced: [u0 === null && sym(t0), u1 === null && sym(t1)].filter(Boolean), covered: coveredPairs.has(pairKey('VELAR', t0, t1)) });
});
// ALEX: every pool lives in amm-pool-v2-01; balances are 8-decimal fixed point
for (let n = 1, misses = 0; misses < 3 && n < 500; n++) {
  let d;
  try { d = await ro('SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-pool-v2-01', 'get-pool-details-by-id', [Cl.uint(n)]); } catch { misses++; continue; }
  const x = val(d?.value?.['token-x']), y = val(d?.value?.['token-y']), f = val(d?.value?.factor);
  if (typeof x !== 'string' || typeof y !== 'string') { misses++; continue; }
  misses = 0;
  let bx = 0n, by = 0n;
  try {
    const det = await ro('SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-pool-v2-01', 'get-pool-details', [Cl.principal(x), Cl.principal(y), Cl.uint(f)]);
    bx = BigInt(val(det.value['balance-x'])); by = BigInt(val(det.value['balance-y']));
  } catch { /* pool details unavailable: counts as empty */ }
  const ux = usdOf(x, bx, 8), uy = usdOf(y, by, 8);
  rows.push({ dex: 'ALEX', pool: `#${n} ${sym(x)}-${sym(y)}`, id: `amm-pool-v2-01:${n}`, usd: (ux ?? 0) + (uy ?? 0), tokens: [sym(x), sym(y)],
    unpriced: [ux === null && sym(x), uy === null && sym(y)].filter(Boolean), covered: coveredPairs.has(pairKey('ALEX', x, y)) });
}
// Arkadiko: pairs in arkadiko-swap-v2-1
const pc = Number(val(await ro('SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1', 'get-pair-count')));
for (let n = 1; n <= pc; n++) {
  const c = await ro('SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1', 'get-pair-contracts', [Cl.uint(n)]);
  const x = val(c['token-x']), y = val(c['token-y']);
  const det = await ro('SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1', 'get-pair-details', [Cl.principal(x), Cl.principal(y)]);
  const inner = val(val(det));
  const ux = usdOf(x, val(inner['balance-x'])), uy = usdOf(y, val(inner['balance-y']));
  rows.push({ dex: 'ARKADIKO', pool: `#${n} ${sym(x)}-${sym(y)}`, id: `arkadiko-swap-v2-1:${n}`, usd: (ux ?? 0) + (uy ?? 0), tokens: [sym(x), sym(y)],
    unpriced: [ux === null && sym(x), uy === null && sym(y)].filter(Boolean), covered: coveredPairs.has(pairKey('ARKADIKO', x, y)) });
}

// Charisma-only sources (our own pools, fak.fun, StackingDAO, Hermetica), from the registry's reserves
const own = {};
for (const v of vaults.filter((v) => ['CHARISMA', 'FAKTORY', 'STACKINGDAO', 'HERMETICA'].includes(v.protocol))) {
  const u = (usdOf(v.tokenA.contractId, v.reservesA) ?? 0) + (usdOf(v.tokenB.contractId, v.reservesB) ?? 0);
  own[v.protocol] = (own[v.protocol] ?? 0) + u;
}
fs.writeFileSync('census.json', JSON.stringify({ at: new Date().toISOString(), rows, own }, null, 1));

const f = (n) => '$' + Math.round(n).toLocaleString();
console.log('DEX        pools  covered   total USD     covered USD   coverage');
for (const dex of ['BITFLOW', 'ALEX', 'VELAR', 'ARKADIKO']) {
  const r = rows.filter((x) => x.dex === dex), c = r.filter((x) => x.covered);
  const t = r.reduce((s, x) => s + x.usd, 0), ct = c.reduce((s, x) => s + x.usd, 0);
  console.log(`${dex.padEnd(10)} ${String(r.length).padStart(5)} ${String(c.length).padStart(8)} ${f(t).padStart(12)} ${f(ct).padStart(14)} ${(100 * ct / (t || 1)).toFixed(1).padStart(8)}%`);
}
const T = rows.reduce((s, x) => s + x.usd, 0), C = rows.filter((x) => x.covered).reduce((s, x) => s + x.usd, 0);
console.log(`ALL 4 DEXes: ${f(T)} total, ${f(C)} covered (${(100 * C / T).toFixed(1)}%)`);
console.log('Charisma-only sources:', Object.entries(own).map(([k, v]) => `${k} ${f(v)}`).join(', '));
console.log('\nBiggest pools Charisma does NOT reach yet:');
for (const x of rows.filter((x) => !x.covered && x.usd > 0).sort((a, b) => b.usd - a.usd).slice(0, 25))
  console.log(`  ${f(x.usd).padStart(11)}  ${x.dex.padEnd(9)} ${x.pool}${x.unpriced.length ? `  (unpriced: ${x.unpriced.join(', ')})` : ''}`);
const unpricedBig = rows.filter((x) => x.unpriced.length).length;
console.log(`\n${rows.length} pools read; ${unpricedBig} have a token Charisma can't price (counted at $0 for that side).`);
