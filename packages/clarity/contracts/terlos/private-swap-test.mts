// Mainnet-fork test: private STX -> sBTC swap through Terlos (real proofs from Terlos's own prover) and Charisma pools.
//   1. A tester shields 5 STX into a Terlos note (an ordinary Terlos deposit).
//   2. A relayer submits private-swap: the note is withdrawn to the router, swapped STX -> sBTC on a Charisma pool, and
//      shielded into a new sBTC note.
//   3. The new note is withdrawn to a brand-new address, proving it is real and spendable.
// Run in a scratch clarinet-sdk project with @terlos/stacks-sdk and @terlos/stark installed:
//   tsx private-swap-test.mts <path to private-swap.clar>
import { initSimnet } from '@stacks/clarinet-sdk';
import { Cl, cvToValue, hexToCV, getAddressFromPrivateKey, randomPrivateKey } from '@stacks/transactions';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { randomBytes } from 'crypto';
import { Engine, ShieldedTree, IndexerClient, syncFromIndexer, shieldRequest, withdrawRequest, bindRequest, prove, poolCall, proofCV, MEMO_LEN } from '@terlos/stacks-sdk';
import { Notes, Digests } from '@terlos/stark/primitives';

const T = 'SP2NY3DGSVNJFQCNQ4JSKYM433YDHJCPJ9M31DPC5', P = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const POOLS = { stx: 'zion-stx', sip10: 'zion-sip10' };
const SBTC = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', SBTC_UID = 1;
const SWAP_POOL = `${P}.satoshis-private-key`; // sBTC-STX; opcode 0x01 swaps STX for sBTC
const TESTER = 'SP3J3HK9HDZCT7XXDZ345E4MX5XZ3SCCNKMWEV5PN';   // real STX holder, shields the first note
const RELAYER = 'SP3AP6DRSQ6P4FETB5M33D082Q2ABGJW60MT6103Q';  // real STX holder, submits the private swap
const ROUTER = `${P}.private-swap`;

const simnet = await initSimnet('./Clarinet.toml');
simnet.deployContract('private-swap', readFileSync(process.argv[2], 'utf8'), { clarityVersion: 3 }, P);

const json = (v: unknown) => JSON.stringify(v, (k, x) => typeof x === 'bigint' ? x.toString() : x);
const ro = (contract: string, fn: string, args: any[] = []) => cvToValue(simnet.callReadOnlyFn(contract, fn, args, TESTER).result as any);
const stxOf = (who: string) => BigInt(cvToValue(hexToCV(simnet.runSnippet(`(stx-get-balance '${who})`) as any)));
const sbtcOf = (who: string) => BigInt(ro(SBTC, 'get-balance', [Cl.principal(who)]).value);
const registry = () => ro(`${T}.privacy-registry`, 'get-info');
const rootOnChain = () => registry()['current-root'].value as string;
const memo = () => '0x' + randomBytes(MEMO_LEN).toString('hex');
const secret = () => Digests.digestFromBigint(BigInt('0x' + randomBytes(31).toString('hex')));
let failures = 0;
const report = (name: string, ok: boolean, detail: string) => { if (!ok) failures++; console.log(`${ok ? '✅' : '❌'} ${name} — ${detail}`); };

// Terlos's prover, pinned to its published hash, and the live note tree checked against the fork's root.
const req = createRequire(import.meta.url);
const wasmPath = req.resolve('@terlos/stacks-sdk/wasm/stacks_shield_wasm.wasm');
const engine = await Engine.load(readFileSync(wasmPath), { sha256: readFileSync(wasmPath.replace(/\.wasm$/, '.sha256'), 'utf8').trim().split(/\s+/)[0] });
const tree = new ShieldedTree(engine);
await syncFromIndexer(new IndexerClient('https://indexer.terlosonstacks.xyz'), tree, [], { outputs: 0, nullifiers: 0 } as any, rootOnChain());
tree.assertRoot(rootOnChain());
console.log(`tree synced: ${tree.size} notes, root ${rootOnChain().slice(0, 18)}…`);

// 1. Tester shields 5 STX into note N1 (owner key sk1).
const sk1 = secret(), pk1 = Notes.deriveOwnerPk(sk1), b1 = secret(), amount1 = 5_000_000n, memo1 = memo();
let t0 = Date.now();
const shield1 = prove(engine, bindRequest(shieldRequest(tree, { pk: pk1, blinding: b1, amount: amount1 }, null), T, [memo1], POOLS));
console.log(`shield proof: ${Date.now() - t0} ms`);
const call1 = poolCall(shield1, { pools: POOLS, maxFee: 1_000_000n, memos: [memo1] });
const r1 = simnet.callPublicFn(`${T}.${call1.contractName}`, call1.functionName, call1.functionArgs, TESTER);
report('shield 5 STX into a Terlos note (plain Terlos deposit)', r1.result.type === 'ok', json(r1.result));
const n1Index = Number(shield1.args.leafIndex);
tree.applyInsertion(n1Index, [shield1.args.commitment as string], shield1.args.newRoot as string);
tree.assertRoot(rootOnChain());

// 2. Proofs for the private swap: withdraw N1 to the router (relayer = RELAYER, fee 0), and shield an sBTC note N2.
const wFee = BigInt(ro(`${T}.asset-registry`, 'withdraw-terms', [Cl.uint(0), Cl.uint(amount1)]).value.fee.value);
const received = amount1 - wFee;
const quoted = BigInt(ro(SWAP_POOL, 'quote', [Cl.uint(received), Cl.some(Cl.bufferFromHex('01'))]).value.dy.value);
const amount2 = quoted * 990n / 1000n * 10000n / 10025n; // leave room for the 0.25% shield fee and 1% slippage
const sk2 = secret(), pk2 = Notes.deriveOwnerPk(sk2), b2 = secret(), memo2 = memo();
t0 = Date.now();
const withdraw1 = prove(engine, bindRequest(withdrawRequest(tree, { sk: sk1, blinding: b1, amount: amount1, index: n1Index, asset: null }, ROUTER, { principal: RELAYER, fee: 0n }), T, [], POOLS));
const shield2 = prove(engine, bindRequest(shieldRequest(tree, { pk: pk2, blinding: b2, amount: amount2 }, SBTC_UID), T, [memo2], POOLS));
console.log(`withdraw + shield proofs: ${Date.now() - t0} ms; note pays ${received} uSTX, pool quotes ${quoted} sats, new note ${amount2} sats`);

const hex = (h: unknown) => Cl.bufferFromHex((h as string).replace(/^0x/, ''));
const swapArgs = (w: any, sh: any, shMemo: string) => [
  Cl.tuple({ nullifier: hex(w.args.nullifier), amount: Cl.uint(w.args.amount), root: hex(w.args.root), 'relayer-fee': Cl.uint(w.args.relayerFee), 'max-fee': Cl.uint(1_000_000n) }),
  proofCV(w.proof),
  Cl.list([Cl.tuple({ vault: Cl.principal(SWAP_POOL), opcode: Cl.bufferFromHex('01') })]),
  Cl.principal(SBTC), Cl.uint(SBTC_UID),
  Cl.tuple({ amount: Cl.uint(sh.args.amount), commitment: hex(sh.args.commitment), 'old-root': hex(sh.args.oldRoot), 'new-root': hex(sh.args.newRoot),
             'leaf-index': Cl.uint(sh.args.leafIndex), 'max-fee': Cl.uint(1_000_000n), memo: hex(shMemo) }),
  proofCV(sh.proof),
];
const unchanged = (x: any) => rootOnChain() === x['current-root'].value && registry()['total-nullifiers'].value === x['total-nullifiers'].value;

// Refusals first (each reverts, so the real swap below still works with the same proofs).
{
  const info = registry();
  const copy = simnet.callPublicFn(ROUTER, 'stx-note-to-token', swapArgs(withdraw1, shield2, memo2), TESTER);
  report('refused: someone else resubmits the swap (the proof names the relayer)', copy.result.type === 'err' && unchanged(info), json(copy.result));
  const greedyMemo = memo();
  const greedy = prove(engine, bindRequest(shieldRequest(tree, { pk: pk2, blinding: secret(), amount: quoted * 2n }, SBTC_UID), T, [greedyMemo], POOLS));
  const short = simnet.callPublicFn(ROUTER, 'stx-note-to-token', swapArgs(withdraw1, greedy, greedyMemo), RELAYER);
  report('refused: the swap can\'t cover the promised note', short.result.type === 'err' && json(short.result).includes('701') && unchanged(info), json(short.result));
}

const before = { relayerSbtc: sbtcOf(RELAYER), routerSbtc: sbtcOf(ROUTER), routerStx: stxOf(ROUTER), info: registry() };
const s = shield2.args;
const r2 = simnet.callPublicFn(ROUTER, 'stx-note-to-token', swapArgs(withdraw1, shield2, memo2), RELAYER);
const after = { relayerSbtc: sbtcOf(RELAYER), routerSbtc: sbtcOf(ROUTER), routerStx: stxOf(ROUTER), info: registry() };
const res = r2.result.type === 'ok' ? cvToValue(r2.result).value : null;
report('private swap: note → router → Charisma STX→sBTC → new sBTC note', r2.result.type === 'ok', r2.result.type === 'ok' ? json(res) : json(r2.result));
if (r2.result.type === 'ok') {
  report('the new note is in the tree', after.info['next-index'].value === String(Number(before.info['next-index'].value) + 1) && rootOnChain() === s.newRoot,
    `notes ${before.info['next-index'].value} → ${after.info['next-index'].value}`);
  report('the old note is spent', after.info['total-nullifiers'].value === String(Number(before.info['total-nullifiers'].value) + 1), `spent ${before.info['total-nullifiers'].value} → ${after.info['total-nullifiers'].value}`);
  report('router keeps nothing; the relayer gets only the leftover tip', after.routerSbtc === before.routerSbtc && after.routerStx === before.routerStx && after.relayerSbtc - before.relayerSbtc === BigInt(res.tip.value),
    `router sBTC ${after.routerSbtc}, STX ${after.routerStx}; relayer tip ${after.relayerSbtc - before.relayerSbtc} sats`);
  const visible = r2.events.filter((e: any) => /transfer_event/.test(e.event)).map((e: any) => `${e.data.sender.split('.').pop()}→${e.data.recipient.split('.').pop()}`);
  console.log(`   what an observer sees moving: ${[...new Set(visible)].join(', ')} (no tester address)`);
  report('the tester\'s address appears nowhere in the swap', !JSON.stringify(r2.events).includes(TESTER), 'checked every event');
  tree.applyInsertion(Number(s.leafIndex), [s.commitment as string], s.newRoot as string);
  tree.assertRoot(rootOnChain());

  // 3. Withdraw the new sBTC note N2 to a brand-new address.
  const fresh = getAddressFromPrivateKey(randomPrivateKey(), 'mainnet');
  const withdraw2 = prove(engine, bindRequest(withdrawRequest(tree, { sk: sk2, blinding: b2, amount: amount2, index: Number(s.leafIndex), asset: SBTC_UID }, fresh, { principal: RELAYER, fee: 0n }), T, [], POOLS));
  const call3 = poolCall(withdraw2, { pools: POOLS, token: SBTC, recipient: fresh, relayer: RELAYER, maxFee: 1_000_000n });
  const r3 = simnet.callPublicFn(`${T}.${call3.contractName}`, call3.functionName, call3.functionArgs, RELAYER);
  report('the new sBTC note withdraws to a brand-new address', r3.result.type === 'ok' && sbtcOf(fresh) > 0n, `${json(r3.result)}, fresh address holds ${sbtcOf(fresh)} sats`);
}

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
