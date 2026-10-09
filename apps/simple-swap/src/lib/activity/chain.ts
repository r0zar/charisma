import { Cl } from '@stacks/transactions';
import type { Transaction } from '@stacks/stacks-blockchain-api-types';
import { addressTransactions, minedTransactions } from '../balance-sheet/hiro';
import { subnetBases } from '../balance-sheet/mempool';
import { ascii, principal, STX, tuple, uint } from '../balance-sheet/decode';
import { noteOf } from '../balance-sheet/holds';
import { listOrders } from '../orders/store';
import type { LimitOrder } from '../orders/types';
import type { ChainActivity, ChainActivityKind, ChainActivityPage } from './chain-types';

const PAGE = 20;
const bare = (txid: string) => txid.replace(/^0x/, '').toLowerCase();

/**
 * A wallet's activity on the chain, a page at a time, newest first: every mined transaction that moved its tokens,
 * from any app or wallet. Charisma orders run in someone else's transaction, so they're named from the order store.
 */
export async function chainActivity(address: string, offset: number): Promise<ChainActivityPage> {
    const page = await addressTransactions(address, offset, PAGE);
    const [txs, bases, orders] = await Promise.all([
        minedTransactions(page.results.map(r => r.tx.tx_id)),
        subnetBases(),
        listOrders(address),
    ]);
    const orderOf = new Map(orders.filter(o => o.txid).map(o => [bare(o.txid!), o]));
    return {
        items: txs.map(tx => activityOf(tx, address, bases, orderOf.get(bare(tx.tx_id)))),
        next: offset + PAGE < page.total ? offset + PAGE : null,
    };
}

/**
 * The change a subnet's printed note made to `me`'s balance there. Subnet balances live in a map, so their moves
 * leave no token events, only these notes: a deposit credits its recipient, a withdrawal debits its owner, and every
 * other move (transfer, x-transfer, x-transfer-lte, x-redeem…) goes from → to.
 */
function subnetChange(hex: string, me: string): bigint {
    const note = tuple(Cl.deserialize(hex));
    const amount = uint(note?.amount);
    if (!note || amount === undefined) return 0n;
    const event = ascii(note.event);
    if (event === 'deposit') return principal(note.recipient) === me ? amount : 0n;
    if (event === 'withdraw') return principal(note.owner) === me ? -amount : 0n;
    return (principal(note.to) === me ? amount : 0n) - (principal(note.from) === me ? amount : 0n);
}

function activityOf(tx: Transaction, me: string, bases: Map<string, string>, order?: LimitOrder): ChainActivity {
    const flows = new Map<string, bigint>();
    const add = (token: string, amount: bigint) => flows.set(token, (flows.get(token) ?? 0n) + amount);
    // Who else was on the other side of a token moving to or from this wallet
    const others = new Set<string>();
    for (const event of tx.events) {
        if (event.event_type === 'stx_asset' || event.event_type === 'fungible_token_asset') {
            const token = event.event_type === 'stx_asset' ? STX : event.asset.asset_id.split('::')[0];
            const amount = BigInt(event.asset.amount ?? '0');
            if (event.asset.sender === me) {
                add(token, -amount);
                if (event.asset.recipient) others.add(event.asset.recipient);
            }
            if (event.asset.recipient === me) {
                add(token, amount);
                if (event.asset.sender) others.add(event.asset.sender);
            }
        } else if (event.event_type === 'smart_contract_log' && bases.has(event.contract_log.contract_id)) {
            add(event.contract_log.contract_id, subnetChange(event.contract_log.value.hex, me));
        }
    }

    const moved = [...flows].filter(([, amount]) => amount !== 0n);
    const out = moved.some(([, amount]) => amount < 0n);
    const into = moved.some(([, amount]) => amount > 0n);
    const call = tx.tx_type === 'contract_call' ? tx.contract_call : undefined;
    const onSubnet = (fn: string) => !!call && bases.has(call.contract_id) && call.function_name === fn;
    // A move between Standard and Blaze is one token on both sides, so it isn't a swap
    const tokensMoved = new Set(moved.map(([token]) => bases.get(token) ?? token));
    const kind: ChainActivityKind =
        order ? 'order'
            : onSubnet('deposit') ? 'to-blaze'
                : onSubnet('withdraw') ? 'to-standard'
                    : out && into && tokensMoved.size > 1 ? 'swap'
                        : into && !out ? 'receive'
                            : out && !into ? 'send'
                                : 'other';
    const payer = tx.sponsored ? tx.sponsor_address : tx.sender_address;

    return {
        txid: tx.tx_id,
        at: tx.block_time * 1000,
        status: tx.tx_status === 'success' ? 'success' : 'failed',
        kind,
        flows: moved.map(([token, amount]) => ({ token, amount: amount.toString() })),
        ...(payer === me && { fee: tx.fee_rate }),
        ...((kind === 'send' || kind === 'receive') && others.size === 1 && { counterparty: [...others][0] }),
        ...(call && { call: `${call.contract_id} ${call.function_name}` }),
        ...(order && { order: noteOf(order) }),
    };
}
