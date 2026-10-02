/** The one-tap upgrade: a player's signed v1 intent moves their free v1 CHA into Blaze v2, and the solver pays the fee. */
import { MULTIHOP_V2_CONTRACT_ID } from 'blaze-sdk';
import type { Chain } from './chain';
import type { Store } from './store';
import { BetError, MIN_BET } from './bets';
import { CHA_SUBNET_V1, subnetOf } from './subnets';

export interface UpgradeInput { signature: string; uuid: string; user: string; amount: string }

export interface UpgradeDeps {
    store: Store;
    chain: Pick<Chain, 'balance' | 'upgrade' | 'uuidSpent'>;
    /** the router the v1 intent was signed for; throws when `user` didn't sign it */
    signedRouter: (input: UpgradeInput & { subnet: string }) => Promise<string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** bets that will still spend their subnet: not yet sent, or sent and not yet final */
const PENDING = new Set(['placed', 'sending', 'sent']);

/** v1 CHA the player's bets still need: the live round and any drawn round still settling */
export async function committedV1(store: Store, user: string): Promise<bigint> {
    const ids = [...new Set([await store.getCurrentId(), ...(await store.history(3))].filter((id): id is string => !!id))];
    let total = 0n;
    for (const id of ids) {
        for (const b of await store.getBets(id)) {
            if (b.user === user && subnetOf(b) === CHA_SUBNET_V1 && PENDING.has(b.status)) total += BigInt(b.amount);
        }
    }
    return total;
}

export async function upgradeToV2(deps: UpgradeDeps, input: UpgradeInput): Promise<{ txid: string }> {
    if (!UUID.test(input.uuid)) throw new BetError('The upgrade needs a uuid', 400);
    if (!/^\d+$/.test(input.amount) || BigInt(input.amount) < MIN_BET) throw new BetError('Upgrade at least 1 CHA', 400);

    let router: string;
    try {
        router = await deps.signedRouter({ ...input, subnet: CHA_SUBNET_V1 });
    } catch {
        throw new BetError('The signature does not match this upgrade', 401);
    }
    if (router !== MULTIHOP_V2_CONTRACT_ID) throw new BetError(`Upgrades are signed for ${MULTIHOP_V2_CONTRACT_ID}`, 400);

    const [balance, committed] = await Promise.all([deps.chain.balance(input.user, CHA_SUBNET_V1), committedV1(deps.store, input.user)]);
    const free = balance > committed ? balance - committed : 0n;
    if (BigInt(input.amount) > free) {
        throw new BetError(`You can upgrade ${free / 1_000_000n} CHA now; ${committed / 1_000_000n} CHA is riding on your bets`, 402);
    }
    if (await deps.chain.uuidSpent(input.uuid)) throw new BetError('That signature was already used', 409);
    if (!(await deps.store.once(`upgrade:${input.uuid}`))) throw new BetError('That upgrade is already on its way', 409);
    return deps.chain.upgrade(input);
}
