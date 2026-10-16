import { MintPage } from '@/components/nft-collection/mint-page';

export default async function NftMintPage({
    params,
    searchParams,
}: {
    params: Promise<{ contractId: string }>;
    searchParams: Promise<{ deployed?: string }>;
}) {
    const { contractId } = await params;
    const { deployed } = await searchParams;

    return (
        <div className="container px-4 py-8 mx-auto">
            <MintPage contractId={decodeURIComponent(contractId)} deployTxid={deployed} />
        </div>
    );
}
