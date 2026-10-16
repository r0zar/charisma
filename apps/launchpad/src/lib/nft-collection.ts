import { request } from '@stacks/connect';
import { Cl, Pc, cvToJSON, fetchCallReadOnlyFunction, principalCV } from '@stacks/transactions';

/** Where launchpad collections keep their art (see apps/metadata) */
export const METADATA_URL = 'https://metadata.charisma.rocks';
const HIRO = 'https://api.hiro.so';

export interface NftToken {
    id: string;
    name: string;
    description?: string;
    image?: string;
    attributes?: { trait_type: string; value: string | number }[];
}

/** A collection as metadata.charisma.rocks hosts it */
export interface HostedCollection {
    contractId: string;
    name: string;
    description?: string;
    image?: string;
    tokenCount: number;
}

/** What a launchpad collection contract reports about its mint */
export interface MintInfo {
    creator: string;
    /** Per piece, in micro-STX */
    price: bigint;
    maxSupply: number;
    minted: number;
    /** 0 = no limit */
    walletLimit: number;
    open: boolean;
}

/** The collection and a page of its minted pieces, or null if its art isn't uploaded yet */
export async function fetchHostedCollection(contractId: string, offset = 0, limit = 1) {
    const res = await fetch(`${METADATA_URL}/api/v1/nft/${contractId}/tokens?offset=${offset}&limit=${limit}`);
    if (res.status === 404) return null;
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(`Couldn't load ${contractId}'s art: ${json.error ?? `HTTP ${res.status}`}`);
    return { collection: json.collection as HostedCollection, tokens: json.tokens as NftToken[], total: json.total as number };
}

export async function isDeployed(contractId: string): Promise<boolean> {
    const [address, name] = contractId.split('.');
    const res = await fetch(`${HIRO}/v2/contracts/interface/${address}/${name}`);
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`Couldn't check whether ${contractId} is deployed: HTTP ${res.status}`);
    return true;
}

const readOnly = (contractId: string, functionName: string, functionArgs: ReturnType<typeof principalCV>[] = []) => {
    const [contractAddress, contractName] = contractId.split('.');
    return fetchCallReadOnlyFunction({ contractAddress, contractName, functionName, functionArgs, senderAddress: contractAddress, network: 'mainnet' });
};

export async function fetchMintInfo(contractId: string): Promise<MintInfo> {
    const info = cvToJSON(await readOnly(contractId, 'get-mint-info')).value;
    return {
        creator: info.creator.value,
        price: BigInt(info.price.value),
        maxSupply: Number(info['max-supply'].value),
        minted: Number(info.minted.value),
        walletLimit: Number(info['wallet-limit'].value),
        open: info.open.value,
    };
}

/** How many pieces a wallet has minted (the creator's aren't counted) */
export async function fetchMintedBy(contractId: string, who: string): Promise<number> {
    return Number(cvToJSON(await readOnly(contractId, 'get-minted', [principalCV(who)])).value);
}

/**
 * Mints `count` pieces from the connected wallet. The wallet may send exactly the price, and nothing else;
 * the creator mints free.
 */
export async function mint(contractId: string, count: number, minter: string, info: MintInfo) {
    const cost = minter === info.creator ? BigInt(0) : info.price * BigInt(count);
    const { txid } = await request('stx_callContract', {
        contract: contractId as `${string}.${string}`,
        functionName: 'mint',
        functionArgs: [Cl.uint(count)],
        network: 'mainnet',
        postConditionMode: 'deny',
        postConditions: cost > BigInt(0) ? [Pc.principal(minter).willSendEq(cost).ustx()] : [],
    });
    if (!txid) throw new Error('The wallet did not return a transaction id');
    return txid;
}

/** Creator only: pause or reopen the mint */
export async function setMintOpen(contractId: string, open: boolean) {
    const { txid } = await request('stx_callContract', {
        contract: contractId as `${string}.${string}`,
        functionName: 'set-mint-open',
        functionArgs: [Cl.bool(open)],
        network: 'mainnet',
        postConditionMode: 'deny',
        postConditions: [],
    });
    if (!txid) throw new Error('The wallet did not return a transaction id');
    return txid;
}

/** A transaction's status, and the ids it minted once it succeeds */
export async function fetchMintTx(txid: string): Promise<{ status: string; ids: number[] }> {
    const res = await fetch(`${HIRO}/extended/v1/tx/${txid.startsWith('0x') ? txid : `0x${txid}`}`);
    if (res.status === 404) return { status: 'pending', ids: [] };
    if (!res.ok) throw new Error(`Couldn't check transaction ${txid}: HTTP ${res.status}`);
    const tx = await res.json();
    const ids = tx.tx_status === 'success' ? [...String(tx.tx_result?.repr ?? '').matchAll(/u(\d+)/g)].map(m => Number(m[1])) : [];
    return { status: tx.tx_status, ids };
}

export const formatStx = (ustx: bigint) => {
    const stx = Number(ustx) / 1_000_000;
    return `${stx.toLocaleString(undefined, { maximumFractionDigits: 6 })} STX`;
};
