import { TokenCacheData } from '@/lib/contract-registry-adapter';
// ... existing imports ...

export async function createTriggeredSwap({
    conditionToken,
    baseToken,
    targetPrice,
    direction,
    amountDisplay,
    validFrom,
    validTo,
    walletAddress,
    selectedFromToken,
    selectedToToken,
    signTriggeredSwap,
    convertToMicroUnits
}: {
    conditionToken: TokenCacheData;
    baseToken: TokenCacheData | null;
    targetPrice: string;
    direction: 'lt' | 'gt';
    amountDisplay: string;
    validFrom?: string;
    validTo?: string;
    walletAddress: string;
    selectedFromToken: TokenCacheData;
    selectedToToken: TokenCacheData;
    signTriggeredSwap: (...args: any[]) => Promise<string>;
    convertToMicroUnits: (input: string, decimals: number) => string;
}) {
    if (!walletAddress) throw new Error('Connect wallet');
    const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();
    const micro = convertToMicroUnits(amountDisplay, selectedFromToken?.decimals || 6);
    const signature = await signTriggeredSwap({
        subnetTokenContractId: selectedFromToken?.contractId!,
        uuid,
        amountMicro: BigInt(micro),
        multihopContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9',
    });
    // Build conditions object based on whether baseToken is provided
    const conditions = baseToken ? {
        type: 'ratio' as const,
        validFrom,
        validTo,
        params: {
            targetPrice,
            direction,
            conditionToken: conditionToken.contractId,
            baseAsset: baseToken.contractId,
        },
    } : {
        type: 'price' as const,
        validFrom,
        validTo,
        params: {
            targetPrice,
            direction,
            conditionToken: conditionToken.contractId,
        },
    };

    const payload: Record<string, unknown> = {
        owner: walletAddress,
        inputToken: selectedFromToken?.contractId,
        outputToken: selectedToToken?.contractId,
        amountIn: micro,
        conditions,
        recipient: walletAddress,
        signature,
        uuid,
    };
    const res = await fetch('/api/v1/orders/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'unknown' }));
        throw new Error(j.error || 'Order create failed');
    }
    return await res.json();
} 