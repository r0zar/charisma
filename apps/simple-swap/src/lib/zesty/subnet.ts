import { request } from '@stacks/connect';
import { Cl, Pc } from '@stacks/transactions';
import { TxMonitorClient } from '@repo/tx-monitor-client';
import { buildSwapTransaction, Router } from 'dexterity-sdk';
import { getQuote } from '@/app/actions';
import type { ZestyToken } from './config';

const txMonitor = new TxMonitorClient();

/** Move a token from the wallet into Zesty (its subnet token). Returns the txid. */
export async function addToZesty(wallet: string, token: ZestyToken, micro: bigint): Promise<string> {
  const result = await request('stx_callContract', {
    address: wallet,
    contract: token.subnet,
    functionName: 'deposit',
    functionArgs: [Cl.uint(micro), Cl.none()],
    postConditionMode: 'deny',
    network: 'mainnet',
    postConditions: [Pc.principal(wallet).willSendEq(micro).ft(token.mainnet, token.asset)],
  });
  if (!result?.txid) throw new Error(`Adding ${token.symbol} to Zesty was not broadcast`);
  return result.txid;
}

/**
 * STX can't be moved into Zesty directly, so swap it on the way in: STX → token → Zesty, in one wallet transaction.
 * The token's link contract credits whoever sends the transaction, so it lands in the user's Zesty money.
 */
export async function swapStxIntoZesty(wallet: string, token: ZestyToken, microStx: bigint): Promise<string> {
  const quote = await getQuote('.stx', token.subnet, microStx.toString());
  if (!quote.success || !quote.data || quote.data instanceof Error) {
    throw new Error(`No route to swap STX into ${token.symbol}: ${quote.error ?? 'empty quote'}`);
  }
  const router = new Router({ maxHops: 4, defaultSlippage: 0.02, routerContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop' });
  const result = await request('stx_callContract', { ...(await buildSwapTransaction(router, quote.data, wallet)), address: wallet, network: 'mainnet' });
  if (!result?.txid) throw new Error(`Swapping STX into ${token.symbol} was not broadcast`);
  return result.txid;
}

/** Move a token from Zesty back to the wallet. Returns the txid. */
export async function moveToWallet(wallet: string, token: ZestyToken, micro: bigint): Promise<string> {
  const result = await request('stx_callContract', {
    address: wallet,
    contract: token.subnet,
    functionName: 'withdraw',
    functionArgs: [Cl.uint(micro), Cl.none()],
    postConditionMode: 'deny',
    network: 'mainnet',
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
    if (status === 'abort_by_response' || status === 'abort_by_post_condition' || status === 'dropped') {
      throw new Error(`Transaction ${txid} failed (${status})`);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error(`Transaction ${txid} did not confirm within ${Math.round(timeoutMs / 60000)} minutes`);
}
