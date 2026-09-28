// Fork test: both Charisma routers, 1 hop + 2 hops via a deep STX pool, with SDK-style deny-mode post-condition checks.
// Assumes TOKEN_B is STX (edit HOP2 otherwise). Run in the sandbox project.
import { initSimnet } from '@stacks/clarinet-sdk';
import { Cl } from '@stacks/transactions';
import { WRAPPER_NAME, EXTERNAL_POOL, TOKEN_A, TOKEN_B, WHALE, DEPLOYER } from './config.mjs';
const simnet = await initSimnet('./Clarinet.toml');
const W = `${simnet.deployer}.${WRAPPER_NAME}`;
const MULTIHOP = `${DEPLOYER}.multihop`, RC9 = `${DEPLOYER}.x-multihop-rc9`;
const HOP2 = { vault: `${DEPLOYER}.welsh-community-lp`, op: '00', tokenIn: 'STX', tokenOut: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token::welshcorgicoin' };
const vaults = { [W]: { externalPoolId: EXTERNAL_POOL }, [HOP2.vault]: { externalPoolId: '' } };
const outSender = (v) => vaults[v].externalPoolId || v;
const quote = (v, amt, op) => BigInt(simnet.callReadOnlyFn(v, 'quote', [Cl.uint(amt), Cl.some(Cl.bufferFromHex(op))], WHALE).result.value.value.dy.value);
const plan = (amount, hops) => { let a = BigInt(amount); return hops.map(h => { const out = quote(h.vault, a, h.op); const r = { ...h, in: a, out }; a = out; return r; }); };
const pcsMultihop = (route) => route.flatMap(h => [{ who: WHALE, asset: h.tokenIn, cond: 'lte', amt: h.in * 105n / 100n }, { who: outSender(h.vault), asset: h.tokenOut, cond: 'gte', amt: h.out * 95n / 100n }]);
const pcsRc9 = (route) => [...route.flatMap(h => [{ who: RC9, asset: h.tokenIn, cond: 'lte', amt: h.in * 101n / 100n }, { who: outSender(h.vault), asset: h.tokenOut, cond: 'gte', amt: h.out * 99n / 100n }]), { who: RC9, asset: route.at(-1).tokenOut, cond: 'gte', amt: route.at(-1).out * 99n / 100n }];
const check = (events, pcs) => {
  const sent = new Map();
  for (const e of events) if (e.event.endsWith('transfer_event')) { const k = `${e.data.sender}|${e.data.asset_identifier ?? 'STX'}`; sent.set(k, (sent.get(k) ?? 0n) + BigInt(e.data.amount)); }
  const merged = new Map(); for (const p of pcs) { const k = `${p.who}|${p.asset}|${p.cond}`; merged.set(k, { ...p, amt: (merged.get(k)?.amt ?? 0n) + p.amt }); }
  const bad = [];
  for (const [k, amt] of sent) { const [who, asset] = k.split('|'); const ps = [...merged.values()].filter(p => p.who === who && p.asset === asset);
    if (!ps.length) bad.push(`UNCOVERED ${who} sent ${amt} ${asset}`);
    for (const p of ps) if (p.cond === 'lte' ? amt > p.amt : amt < p.amt) bad.push(`FAILS ${p.cond} ${who} ${asset} ${amt} vs ${p.amt}`); }
  return bad.length ? '❌ ' + bad.join('; ') : '✅ all transfers allowed';
};
const flows = (evs) => evs.filter(e => e.event.endsWith('transfer_event')).map(e => `    ${(e.data.asset_identifier ?? 'STX').split('::').pop()} ${e.data.amount} ${e.data.sender.split('.').pop()} -> ${e.data.recipient.split('.').pop()}`).join('\n');
const routes = {
  'A->B': [{ vault: W, op: '00', tokenIn: TOKEN_A.asset, tokenOut: TOKEN_B.asset }],
  'B->A': [{ vault: W, op: '01', tokenIn: TOKEN_B.asset, tokenOut: TOKEN_A.asset }],
  'A->B->WELSH': [{ vault: W, op: '00', tokenIn: TOKEN_A.asset, tokenOut: TOKEN_B.asset }, HOP2],
};
const AMT = 10_000_000n;
console.log('=== multihop (user is caller) ===');
for (const [name, hops] of Object.entries(routes)) {
  const route = plan(AMT, hops);
  const r = simnet.callPublicFn(MULTIHOP, `swap-${hops.length}`, [Cl.uint(AMT), ...hops.map(h => Cl.tuple({ pool: Cl.principal(h.vault), opcode: Cl.some(Cl.bufferFromHex(h.op)) }))], WHALE);
  console.log(`${name}: ${r.result.type}\n${flows(r.events)}\n  post-conditions: ${r.result.type === 'ok' ? check(r.events, pcsMultihop(route)) : 'n/a'}`);
}
console.log('=== x-multihop-rc9 (router is caller; emulates x-swap-N via test-* functions) ===');
for (const [name, hops] of Object.entries(routes)) {
  const route = plan(AMT, hops);
  const [inContract, inFt] = hops[0].tokenIn.split('::');
  hops[0].tokenIn === 'STX' ? simnet.transferSTX(AMT, RC9, WHALE) : simnet.callPublicFn(inContract, 'transfer', [Cl.uint(AMT), Cl.principal(WHALE), Cl.principal(RC9), Cl.none()], WHALE);
  const events = []; let a = AMT;
  for (const h of hops) { const r = simnet.callPublicFn(RC9, 'test-execute', [Cl.tuple({ vault: Cl.principal(h.vault), opcode: Cl.bufferFromHex(h.op) }), Cl.uint(a)], WHALE); events.push(...r.events); a = BigInt(r.result.value.value.dy.value); }
  const out = hops.at(-1).tokenOut; const trait = out === 'STX' ? 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx' : out.split('::')[0];
  const w = simnet.callPublicFn(RC9, 'test-withdraw', [Cl.tuple({ token: Cl.principal(trait), to: Cl.principal(WHALE) }), Cl.uint(a)], WHALE); events.push(...w.events);
  console.log(`${name}: withdraw ${w.result.type}\n${flows(events)}\n  post-conditions: ${check(events, pcsRc9(route))}`);
}
