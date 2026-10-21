// Mainnet-fork test: Charisma pool adapters driven by Zest's real, deployed routers.
// Run in a scratch clarinet-sdk project (see .claude/skills/dexterity-external-pool step 4) with the
// adapters for welsh-community-lp, charismatic-flow, satoshis-private-key, sbtc-fakfun-amm-lp-v1 and dexterity-pool-v1.
import { initSimnet } from '@stacks/clarinet-sdk';
import { Cl, cvToValue, hexToCV } from '@stacks/transactions';

const simnet = await initSimnet('./Clarinet.toml');
const ZEST = 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST';
const PARTNER = `${ZEST}.partner-router-v1`, SPLIT = `${ZEST}.split-router-v1`;
// The simulator can't run Clarity 5's contract-call on a constant, which Zest's live bitflow-adapter uses.
// So deploy an exact copy under Zest's address with only that call target written out.
const bitflowSrc = (await (await fetch(`https://api.hiro.so/v2/contracts/source/${ZEST}/bitflow-adapter?proof=0`)).json()).source.replaceAll('(contract-call? CORE ', "(contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2 ");
simnet.deployContract('bitflow-adapter-sim', bitflowSrc, { clarityVersion: 4 }, ZEST); // throws if it fails
const BITFLOW_ADAPTER = `${ZEST}.bitflow-adapter-sim`;
const P = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const A = (pool) => `${simnet.deployer}.zest-${pool}-v1`;

const STX = 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2'; // Bitflow's STX wrapper; Zest passes it on STX legs
const SBTC = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';
const WELSH = 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token';
const CHA = `${P}.charisma-token`;
const DMG = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token';
const FAKFUN = 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.fakfun-faktory';

const TESTER = 'SP3J3HK9HDZCT7XXDZ345E4MX5XZ3SCCNKMWEV5PN'; // real sBTC holder
const json = (v) => JSON.stringify(v, (k, x) => typeof x === 'bigint' ? x.toString() : x);
const bal = (who, token) => token === STX
  ? BigInt(cvToValue(hexToCV(simnet.runSnippet(`(stx-get-balance '${who})`))))
  : BigInt(cvToValue(simnet.callReadOnlyFn(token, 'get-balance', [Cl.principal(who)], TESTER).result).value);
const quote = (pool, amt, op) => BigInt(cvToValue(simnet.callReadOnlyFn(`${P}.${pool}`, 'quote', [Cl.uint(amt), Cl.some(Cl.bufferFromHex(op))], TESTER).result).value.dy.value);

// Fund the tester from real holders (simnet signs as anyone).
const fund = (token, from, amt) => {
  const r = simnet.callPublicFn(token, 'transfer', [Cl.uint(amt), Cl.principal(from), Cl.principal(TESTER), Cl.none()], from);
  if (r.result.type !== 'ok') throw new Error(`Funding ${token} from ${from} failed: ${json(r.result)}`);
};
fund(WELSH, 'SP3AP6DRSQ6P4FETB5M33D082Q2ABGJW60MT6103Q', 1_000_000_000_000n);
fund(CHA, 'SP2YHM8WK50C6BC1HZHR25AQZ07S6ZPHPDMQ43348', 1_000_000_000n);
fund(FAKFUN, 'SP1RB1V65A1PAAXYT8PVFFFC6T1FN9E8RQX7HMDKC', 10_000_000_000_000n);
const stxR = simnet.transferSTX(1_000_000_000n, TESTER, 'SP3AP6DRSQ6P4FETB5M33D082Q2ABGJW60MT6103Q');
if (stxR.result.type !== 'ok') throw new Error(`Funding STX failed: ${json(stxR.result)}`);
console.log('tester STX', bal(TESTER, STX), 'sBTC', bal(TESTER, SBTC), 'WELSH', bal(TESTER, WELSH), 'CHA', bal(TESTER, CHA), 'FAKFUN', bal(TESTER, FAKFUN));

const hop = ({ tin, tout, min = 1n, t, x }) => Cl.tuple({
  'token-in': Cl.principal(tin), 'token-out': Cl.principal(tout),
  'is-stx-in': Cl.bool(tin === STX), 'is-stx-out': Cl.bool(tout === STX), 'x-to-y': Cl.bool(true), 'min-out': Cl.uint(min),
  t: t ? Cl.some(Cl.tuple({ adapter: Cl.principal(t), 'pool-id': Cl.uint(0) })) : Cl.none(),
  x: x ? Cl.some(Cl.tuple({ adapter: Cl.principal(BITFLOW_ADAPTER), pool: Cl.principal(x) })) : Cl.none(),
  s: Cl.none(), d: Cl.none(), c: Cl.none(), a: Cl.none(),
});
const path = (amt, hops) => Cl.tuple({ 'amount-in': Cl.uint(amt), hops: Cl.list(hops.map(hop)) });
const routeArgs = (tin, tout, amt, paths, minOut) => [
  Cl.principal(tin), Cl.principal(tout), Cl.bool(tin === STX), Cl.bool(tout === STX), Cl.uint(amt), Cl.list(paths),
  Cl.uint(minOut), Cl.uint(simnet.blockHeight + 50), Cl.uint(0), Cl.uint(0), Cl.principal(TESTER)];
const partnerSwap = (tin, tout, amt, hops, minOut = 1n) =>
  simnet.callPublicFn(PARTNER, 'swap', [...routeArgs(tin, tout, amt, [path(amt, hops)], minOut), Cl.uint(0), Cl.principal(TESTER), Cl.uint(0)], TESTER);

const adapterEmpty = (adapter, tokens) => tokens.every((t) => bal(adapter, t) === 0n);
let failures = 0;
const report = (name, ok, detail) => { if (!ok) failures++; console.log(`${ok ? '✅' : '❌'} ${name} — ${detail}`); };

// 1. Single hops through each Charisma pool, both directions, via partner-router-v1.
const singles = [
  ['welsh-community-lp', STX, WELSH, '00', 100_000_000n],
  ['welsh-community-lp', WELSH, STX, '01', 50_000_000_000n],
  ['charismatic-flow', STX, CHA, '00', 20_000_000n],
  ['charismatic-flow', CHA, STX, '01', 50_000_000n],
  ['satoshis-private-key', SBTC, STX, '00', 10_000n],
  ['satoshis-private-key', STX, SBTC, '01', 5_000_000n],
  ['sbtc-fakfun-amm-lp-v1', SBTC, FAKFUN, '00', 20_000n],
  ['sbtc-fakfun-amm-lp-v1', FAKFUN, SBTC, '01', 1_000_000_000_000n],
  ['dexterity-pool-v1', CHA, DMG, '00', 10_000_000n],
];
for (const [pool, tin, tout, op, amt] of singles) {
  const expected = quote(pool, amt, op);
  const before = bal(TESTER, tout), beforeIn = bal(TESTER, tin);
  const r = partnerSwap(tin, tout, amt, [{ tin, tout, t: A(pool) }]);
  const got = bal(TESTER, tout) - before, spent = beforeIn - bal(TESTER, tin);
  const sym = (t) => t.split('.')[1].split('-')[0];
  report(`${pool} ${sym(tin)}→${sym(tout)}`, r.result.type === 'ok' && got === expected && spent === amt && adapterEmpty(A(pool), [tin, tout]),
    r.result.type === 'ok' ? `in ${amt}, got ${got}, pool quote ${expected}, adapter empty ${adapterEmpty(A(pool), [tin, tout])}` : `ERR ${json(r.result)}`);
}

// The fork loads contracts lazily; touch the Bitflow pools so the routers can reach them through traits.
for (const p of ['xyk-pool-sbtc-stx-v-1-1', 'xyk-pool-welsh-stx-v-1-1']) simnet.callReadOnlyFn(`SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.${p}`, 'get-pool', [], TESTER);

// 2. Mixed route: sBTC → STX on Bitflow (Zest's own adapter) → WELSH on Charisma (our adapter).
{
  const amt = 20_000n, before = bal(TESTER, WELSH);
  const bitflowQuote = BigInt(cvToValue(simnet.callReadOnlyFn('SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2', 'get-dy',
    [Cl.principal('SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1'), Cl.principal(SBTC), Cl.principal(STX), Cl.uint(amt)], TESTER).result).value);
  const expected = quote('welsh-community-lp', bitflowQuote, '00'); // both legs quoted before the trade moves the pools
  const r = partnerSwap(SBTC, WELSH, amt, [
    { tin: SBTC, tout: STX, x: 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1' },
    { tin: STX, tout: WELSH, t: A('welsh-community-lp') },
  ]);
  const mid = r.events.filter((e) => e.event === 'stx_transfer_event' && e.data.recipient === A('welsh-community-lp')).map((e) => BigInt(e.data.amount))[0];
  const got = bal(TESTER, WELSH) - before;
  report('Bitflow sBTC→STX then Charisma STX→WELSH', r.result.type === 'ok' && mid === bitflowQuote && got === expected,
    r.result.type === 'ok' ? `mid STX ${mid} (Bitflow quote ${bitflowQuote}), got WELSH ${got} (expected ${expected})` : `ERR ${json(r.result)}`);
}

// 3. Split route via split-router-v1: STX → WELSH, half Charisma, half Bitflow.
{
  const amt = 200_000_000n, half = amt / 2n, before = bal(TESTER, WELSH);
  const r = simnet.callPublicFn(SPLIT, 'swap', routeArgs(STX, WELSH, amt, [
    path(half, [{ tin: STX, tout: WELSH, t: A('welsh-community-lp') }]),
    path(half, [{ tin: STX, tout: WELSH, x: 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-welsh-stx-v-1-1' }]),
  ], 1n), TESTER);
  report('split STX→WELSH (Charisma + Bitflow)', r.result.type === 'ok', r.result.type === 'ok' ? `got WELSH ${bal(TESTER, WELSH) - before}` : `ERR ${json(r.result)}`);
}

// 4. Safety: a hop that names the wrong tokens for the pool, and a minimum the pool can't meet.
{
  const r = partnerSwap(SBTC, FAKFUN, 10_000n, [{ tin: SBTC, tout: FAKFUN, t: A('welsh-community-lp') }]);
  report('wrong pair is refused', r.result.type === 'err', json(r.result));
  const amt = 100_000_000n, q = quote('welsh-community-lp', amt, '00');
  const r2 = partnerSwap(STX, WELSH, amt, [{ tin: STX, tout: WELSH, t: A('welsh-community-lp'), min: q + 1n }]);
  report('hop minimum above the pool quote is refused', r2.result.type === 'err', json(r2.result));
  const r3 = partnerSwap(STX, WELSH, amt, [{ tin: STX, tout: WELSH, t: A('welsh-community-lp') }], q + 1n);
  report('route minimum above the pool quote is refused', r3.result.type === 'err', json(r3.result));
}

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
