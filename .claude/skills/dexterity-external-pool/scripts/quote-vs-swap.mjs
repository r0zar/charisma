// Fork test: quote must equal execute, across sizes and both directions. Run in the sandbox project.
import { initSimnet } from '@stacks/clarinet-sdk';
import { Cl } from '@stacks/transactions';
import { WRAPPER_NAME, WHALE } from './config.mjs';
const simnet = await initSimnet('./Clarinet.toml', false, { trackCosts: true });
const W = `${simnet.deployer}.${WRAPPER_NAME}`;
const delta = (r) => r.type === 'ok' ? { dx: r.value.value.dx.value, dy: r.value.value.dy.value } : { err: JSON.stringify(r.value, (k, v) => typeof v === 'bigint' ? v.toString() : v) };
const run = (amt, op) => {
  const q = simnet.callReadOnlyFn(W, 'quote', [Cl.uint(amt), Cl.some(Cl.bufferFromHex(op))], WHALE);
  const e = delta(simnet.callPublicFn(W, 'execute', [Cl.uint(amt), Cl.some(Cl.bufferFromHex(op))], WHALE).result);
  const qd = delta(q.result), readLength = q.costs.total.readLength;
  console.log(`${op === '00' ? 'A->B' : 'B->A'} in=${amt} | quote ${qd.dx}/${qd.dy} | swap ${e.dx ?? 'ERR ' + e.err}/${e.dy ?? ''} ${e.dx === qd.dx && e.dy === qd.dy ? 'MATCH' : 'MISMATCH'} | quote readLength ${readLength} ${readLength > 500000 ? 'OVER PUBLIC BUDGET' : 'ok'}`);
};
for (const s of [1e6, 1e7, 1e8, 3e8]) run(s, '01'); // keep B sizes within the whale's balance
for (const s of [1e6, 1e8, 5e9, 2e11]) run(s, '00');
