/** Everything the engine needs from the blockchain, behind one interface so the engine can be tested without it. */
import { getUserTokenBalance, buildXSwapTransaction, broadcastMultihopTransaction, routerConfigFor, BLAZE_CONTRACT_ID, MULTIHOP_V2_CONTRACT_ID } from 'blaze-sdk';
import { fetchQuote } from 'dexterity-sdk';
import { Cl, cvToValue, deserializeCV, getAddressFromPrivateKey, PostConditionMode, serializeCV } from '@stacks/transactions';
import type { Bet } from './types';
import { CHA_SUBNET_V1, CHA_SUBNET_V2, subnetOf } from './subnets';

export interface Block { height: number; hash: string; time: number }
export interface TxOutcome { status: 'pending' | 'success' | 'failed'; amountOut?: string; reason?: string }

export interface Chain {
    /** a CHA subnet balance (v1 or v2), micro units, read on-chain */
    balance(user: string, subnet: string): Promise<bigint>;
    /** the earliest Stacks block mined at or after `ms`, or null if none yet */
    firstBlockAtOrAfter(ms: number): Promise<Block | null>;
    /**
     * Route and broadcast one bet's swap into the winner. No price protection: the group buy pumps the winner and each
     * swap takes the price the ones ahead of it left. The payout is still locked to the bettor by x-multihop-v1.
     */
    swap(bet: Bet, winner: string): Promise<{ txid: string }>;
    txOutcome(txid: string): Promise<TxOutcome>;
    /** move a player's v1 CHA to v2 on their signed v1 intent for x-multihop-v2: v1 sublink out, v2 sublink in */
    upgrade(input: { signature: string; uuid: string; user: string; amount: string }): Promise<{ txid: string }>;
    /** whether blaze-v1 has already seen this intent uuid */
    uuidSpent(uuid: string): Promise<boolean>;
}

const HIRO = 'https://api.hiro.so';

async function hiro<T>(path: string): Promise<T> {
    const key = process.env.HIRO_API_KEY;
    if (!key) throw new Error('HIRO_API_KEY is not set');
    const res = await fetch(`${HIRO}${path}`, { headers: { 'x-api-key': key }, cache: 'no-store' });
    if (!res.ok) throw new Error(`Hiro ${path} answered ${res.status}`);
    return res.json() as Promise<T>;
}

function solver() {
    const key = process.env.PRIVATE_KEY;
    if (!key) throw new Error('PRIVATE_KEY (the solver key) is not set');
    return { key, address: getAddressFromPrivateKey(key, 'mainnet') };
}

/** the solver's next nonce, mempool included, so a broadcast never reuses one in flight */
async function nextNonce(address: string): Promise<number> {
    const { possible_next_nonce } = await hiro<{ possible_next_nonce: number }>(`/extended/v1/address/${address}/nonces`);
    return possible_next_nonce;
}

const isNonceConflict = (e: unknown) => /nonce/i.test(e instanceof Error ? e.message : String(e));

/** broadcast from the solver with its next nonce, retrying nonce conflicts */
async function broadcastFromSolver(config: Parameters<typeof broadcastMultihopTransaction>[0]): Promise<{ txid: string }> {
    const { key, address } = solver();
    for (let attempt = 0; ; attempt++) {
        try {
            const result = await broadcastMultihopTransaction({ ...config, nonce: await nextNonce(address) }, key);
            if (!result.txid || 'error' in result) throw new Error(`Broadcast rejected: ${JSON.stringify(result).slice(0, 300)}`);
            return { txid: result.txid };
        } catch (e) {
            if (attempt < 2 && isNonceConflict(e)) continue;
            throw e;
        }
    }
}

export const stacksChain: Chain = {
    async balance(user, subnet) {
        const { preconfirmationBalance } = await getUserTokenBalance(subnet, user);
        return BigInt(preconfirmationBalance);
    },

    async firstBlockAtOrAfter(ms) {
        const target = Math.ceil(ms / 1000);
        let earliest: Block | null = null;
        // blocks come newest first, about every 10 s: walk back until one is older than the target
        for (let offset = 0; offset < 600; offset += 30) {
            const { results } = await hiro<{ results: { height: number; hash: string; block_time: number }[] }>(
                `/extended/v2/blocks?limit=30&offset=${offset}`);
            for (const b of results) {
                if (b.block_time < target) return earliest;
                earliest = { height: b.height, hash: b.hash, time: b.block_time };
            }
            if (results.length < 30) return earliest;
        }
        throw new Error(`No Stacks block found within 600 blocks of ${new Date(ms).toISOString()}`);
    },

    async swap(bet, winner) {
        const quote = await fetchQuote(subnetOf(bet), winner, Number(bet.amount));
        if (!quote?.hops?.length) throw new Error(`No route from ${subnetOf(bet)} to ${winner}`);
        // no price protection on purpose: the group buy pumps the winner (DESIGN.md)
        return broadcastFromSolver({
            ...buildXSwapTransaction(quote as any, { amountIn: bet.amount, signature: bet.signature, uuid: bet.uuid, recipient: bet.user }, routerConfigFor(bet.router)),
            postConditionMode: PostConditionMode.Allow,
            postConditions: [],
        });
    },

    async upgrade({ signature, uuid, user, amount }) {
        const quote = await fetchQuote(CHA_SUBNET_V1, CHA_SUBNET_V2, Number(amount));
        if (!quote?.hops?.length) throw new Error('No route from Blaze v1 CHA to Blaze v2 CHA yet');
        if (BigInt(Math.floor(quote.amountOut)) !== BigInt(amount)) throw new Error(`The upgrade route would deliver ${quote.amountOut}, not ${amount}`);
        // 1:1 through two sublinks, so the default deny-mode post-conditions hold exactly
        return broadcastFromSolver(buildXSwapTransaction(quote as any, { amountIn: amount, signature, uuid, recipient: user }, routerConfigFor(MULTIHOP_V2_CONTRACT_ID)));
    },

    async txOutcome(txid) {
        const id = txid.startsWith('0x') ? txid : `0x${txid}`;
        const key = process.env.HIRO_API_KEY;
        const res = await fetch(`${HIRO}/extended/v1/tx/${id}`, { headers: key ? { 'x-api-key': key } : {}, cache: 'no-store' });
        if (res.status === 404) return { status: 'pending' };
        if (!res.ok) throw new Error(`Hiro tx ${id} answered ${res.status}`);
        const tx = await res.json() as { tx_status: string; tx_result?: { repr: string } };
        if (tx.tx_status === 'pending') return { status: 'pending' };
        const repr = tx.tx_result?.repr ?? '';
        if (tx.tx_status !== 'success') return { status: 'failed', reason: `${tx.tx_status} ${repr}`.trim() };
        // the router returns one {dx, dy} per hop: the last dy is what reached the bettor
        const dy = [...repr.matchAll(/\(dy u(\d+)\)/g)];
        return { status: 'success', amountOut: dy.length ? dy[dy.length - 1][1] : undefined };
    },

    async uuidSpent(uuid) {
        const [address, name] = BLAZE_CONTRACT_ID.split('.');
        const key = process.env.HIRO_API_KEY;
        const res = await fetch(`${HIRO}/v2/contracts/call-read/${address}/${name}/check`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
            body: JSON.stringify({ sender: address, arguments: [`0x${serializeCV(Cl.stringAscii(uuid))}`] }),
            cache: 'no-store',
        });
        if (!res.ok) throw new Error(`blaze-v1 check answered ${res.status}`);
        const { okay, result, cause } = await res.json() as { okay: boolean; result?: string; cause?: string };
        if (!okay || !result) throw new Error(`blaze-v1 check failed: ${cause}`);
        return cvToValue(deserializeCV(result)) === true;
    },
};
