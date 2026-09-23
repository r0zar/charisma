"use client";

import TokenDropdown from '@/components/TokenDropdown';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { useSubnetTokens } from '@/contexts/subnet-tokens-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';

interface Props {
    label: string;
    selected: TokenCacheData | null;
    onSelect: (token: TokenCacheData) => void;
    /** Contract id to leave out (the other side of the pair). */
    exclude?: string | null;
}

/**
 * Mainnet tokens that have a subnet version the connected wallet actually holds.
 * A range swap sends from both sides, so anything unfunded is not offered.
 */
export function useSubnetFundedTokens(exclude?: string | null): TokenCacheData[] {
    const { tokens } = useTokenMetadata();
    const { getSubnetContractId } = useSubnetTokens();
    const { address } = useWallet();
    const { getSubnetBalance } = useBalances(address ? [address] : []);

    if (!address) return [];
    return Object.values(tokens).filter((t) => {
        if (t.type === 'SUBNET' || t.contractId === exclude) return false;
        const subnetId = getSubnetContractId(t.contractId);
        return !!subnetId && getSubnetBalance(address, subnetId) > 0;
    });
}

export default function SubnetPairSelector({ label, selected, onSelect, exclude }: Props) {
    const tokens = useSubnetFundedTokens(exclude);
    const { address } = useWallet();

    if (!address) {
        return <div className="text-sm text-white/60">Connect a wallet to pick tokens.</div>;
    }
    if (tokens.length === 0) {
        return (
            <div className="text-sm text-white/60">
                Range Swaps need tokens on the subnet. Move some over from the swap page.
            </div>
        );
    }
    return <TokenDropdown tokens={tokens} selected={selected} onSelect={onSelect} label={label} showBalances />;
}
