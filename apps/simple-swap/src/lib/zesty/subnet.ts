import { request } from '@stacks/connect';
import { Cl, Pc } from '@stacks/transactions';
import { TxMonitorClient } from '@repo/tx-monitor-client';
import type { ZestyToken } from './config';

const txMonitor = new TxMonitorClient();

/** Move a token from the wallet into Zesty (its subnet token). Returns the txid. */
export async function addToZesty(wallet: string, token: ZestyToken, micro: bigint): Promise<string> {
  const result = await request('stx_callContract', {
    contract: token.subnet,
    functionName: 'deposit',
    functionArgs: [Cl.uint(micro), Cl.none()],
    postConditionMode: 'deny',
    postConditions: [Pc.principal(wallet).willSendEq(micro).ft(token.mainnet, token.asset)],
  });
  if (!result?.txid) throw new Error(`Adding ${token.symbol} to Zesty was not broadcast`);
  return result.txid;
}

/** Move a token from Zesty back to the wallet. Returns the txid. */
export async function moveToWallet(token: ZestyToken, micro: bigint): Promise<string> {
  const result = await request('stx_callContract', {
    contract: token.subnet,
    functionName: 'withdraw',
    functionArgs: [Cl.uint(micro), Cl.none()],
    postConditionMode: 'deny',
    postConditions: [Pc.principal(token.subnet).willSendEq(micro).ft(token.mainnet, token.asset)],
  });
  if (!result?.txid) throw new Error(`Moving ${token.symbol} to your wallet was not broadcast`);
  return result.txid;
}

/** Resolve once the transaction confirms; throw if it fails or doesn't confirm in time. */
export async function waitForConfirmation(txid: string, timeoutMs = 10 * 60 * 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { status } = await txMonitor.getTransactionStatus(txid);
    if (status === 'success') return;
    if (status === 'abort_by_response' || status === 'abort_by_post_condition') {
      throw new Error(`Transaction ${txid} failed (${status})`);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error(`Transaction ${txid} did not confirm within ${Math.round(timeoutMs / 60000)} minutes`);
}
