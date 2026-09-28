// Posts vault metadata (metadata service) and registers the vault (invest registry), signed by DEPLOYER.
// Usage: node register.mjs metadata|register <metadata.json>
// metadata.json shape: { name, symbol, decimals, identifier, description, image,
//   properties: { externalPoolId, engineContractId: '', lpRebatePercent, tokenAContract, tokenBContract, tokenAMetadata, tokenBMetadata } }
// tokenA/B metadata: { contractId, identifier, name, symbol, decimals, description, image }, in OPCODE order (0x00 = A -> B).
import fs from 'fs';
import { signMessageHashRsv, privateKeyToPublic } from '@stacks/transactions';
import { hashMessage } from '@stacks/encryption';
import { bytesToHex } from '@stacks/common';
import { WRAPPER_NAME, DEPLOYER, readKey } from './config.mjs';
const PROTOCOL = 'BITFLOW'; // BITFLOW | ALEX | VELAR | ...
const privateKey = await readKey();
const sign = (message) => ({ 'content-type': 'application/json', 'x-public-key': privateKeyToPublic(privateKey), 'x-signature': signMessageHashRsv({ messageHash: bytesToHex(hashMessage(message)), privateKey }) });
const ID = `${DEPLOYER}.${WRAPPER_NAME}`;
const [step, file] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
if (step === 'metadata') {
  const r = await fetch(`https://metadata.charisma.rocks/api/v1/metadata/${ID}`, { method: 'POST', headers: sign(ID), body: JSON.stringify({ ...meta, contractId: ID }) });
  console.log('metadata', r.status, (await r.text()).slice(0, 400));
}
if (step === 'register') {
  const p = meta.properties;
  const body = {
    lpToken: { contractId: ID, name: meta.name, symbol: meta.symbol, decimals: meta.decimals, identifier: meta.identifier, description: meta.description, image: meta.image,
      lpRebatePercent: p.lpRebatePercent, externalPoolId: p.externalPoolId, engineContractId: '', type: 'POOL', protocol: PROTOCOL },
    tokenA: p.tokenAMetadata, tokenB: p.tokenBMetadata,
  };
  const r = await fetch(`https://invest.charisma.rocks/api/v1/admin/vaults/${ID}/confirm`, { method: 'POST', headers: sign('dex-cache-admin-access'), body: JSON.stringify(body) });
  console.log('register', r.status, (await r.text()).slice(0, 400));
}
