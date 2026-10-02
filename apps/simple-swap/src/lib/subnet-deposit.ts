import { Pc } from '@stacks/transactions';
import type { TokenCacheData } from '@/lib/contract-registry-adapter';

/**
 * The post-condition for a deposit: exactly `amount` of the subnet's base token leaves `owner`. STX is native (the STX
 * subnet takes it with stx-transfer?), every other base is a SIP-010 token named by its asset.
 */
export function baseTokenLeaves(owner: string, base: TokenCacheData, amount: bigint | number) {
    if (base.contractId === '.stx') return Pc.principal(owner).willSendEq(amount).ustx();
    if (!base.identifier) throw new Error(`${base.symbol} has no asset name in the token list, so it can't be moved safely`);
    return Pc.principal(owner).willSendEq(amount).ft(base.contractId as `${string}.${string}`, base.identifier);
}
