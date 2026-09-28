// Deploys the wrapper to mainnet from DEPLOYER. Usage: node deploy.mjs <fee-ustx>
import fs from 'fs';
import { makeContractDeploy, broadcastTransaction, ClarityVersion, PostConditionMode } from '@stacks/transactions';
import { WRAPPER_NAME, CONTRACT_FILE, readKey } from './config.mjs';
const fee = BigInt(process.argv[2] ?? 100_000);
const tx = await makeContractDeploy({ contractName: WRAPPER_NAME, codeBody: fs.readFileSync(CONTRACT_FILE, 'utf8'), senderKey: await readKey(), network: 'mainnet', clarityVersion: ClarityVersion.Clarity4, fee, postConditionMode: PostConditionMode.Deny });
const res = await broadcastTransaction({ transaction: tx, network: 'mainnet' });
console.log(res);
for (let i = 0; res.txid && i < 60; i++) {
  const d = await (await fetch(`https://api.hiro.so/extended/v1/tx/0x${res.txid}`)).json().catch(() => ({}));
  if (d.tx_status && d.tx_status !== 'pending') { console.log(d.tx_status, d.block_height, d.tx_result?.repr); break; }
  await new Promise(r => setTimeout(r, 15000));
}
