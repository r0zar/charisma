// Real mainnet swap through the deployed wrapper with strict deny-mode post-conditions.
// Usage: node live-swap.mjs <op 00|01> <amount>
import { makeContractCall, broadcastTransaction, fetchCallReadOnlyFunction, Cl, Pc, PostConditionMode, getAddressFromPrivateKey } from '@stacks/transactions';
import { WRAPPER_NAME, DEPLOYER, EXTERNAL_POOL, TOKEN_A, TOKEN_B, readKey } from './config.mjs';
const senderKey = await readKey(), me = getAddressFromPrivateKey(senderKey, 'mainnet');
const [op, amount] = [process.argv[2], BigInt(process.argv[3])];
const args = [Cl.uint(amount), Cl.some(Cl.bufferFromHex(op))];
const q = await fetchCallReadOnlyFunction({ contractAddress: DEPLOYER, contractName: WRAPPER_NAME, functionName: 'quote', functionArgs: args, senderAddress: me, network: 'mainnet' });
const dy = BigInt(q.value.value.dy.value), minOut = dy * 99n / 100n;
const [tin, tout] = op === '00' ? [TOKEN_A, TOKEN_B] : [TOKEN_B, TOKEN_A];
const pc = (who, cond, amt, t) => { const p = Pc.principal(who)[cond](amt); if (t.asset === 'STX') return p.ustx(); const [c, n] = t.asset.split('::'); return p.ft(c, n); };
console.log(`quote: in ${amount} -> out ${dy} (min ${minOut})`);
const tx = await makeContractCall({ contractAddress: DEPLOYER, contractName: WRAPPER_NAME, functionName: 'execute', functionArgs: args, senderKey, network: 'mainnet', fee: 20_000n,
  postConditionMode: PostConditionMode.Deny, postConditions: [pc(me, 'willSendLte', amount, tin), pc(EXTERNAL_POOL, 'willSendGte', minOut, tout)] });
const res = await broadcastTransaction({ transaction: tx, network: 'mainnet' });
console.log(res);
for (let i = 0; res.txid && i < 60; i++) {
  const d = await (await fetch(`https://api.hiro.so/extended/v1/tx/0x${res.txid}`)).json().catch(() => ({}));
  if (d.tx_status && d.tx_status !== 'pending') { console.log(d.tx_status, d.tx_result?.repr); for (const e of d.events ?? []) if (e.asset?.asset_event_type === 'transfer') console.log(' ', e.asset.asset_id ?? 'STX', e.asset.amount, e.asset.sender, '->', e.asset.recipient); break; }
  await new Promise(r => setTimeout(r, 15000));
}
