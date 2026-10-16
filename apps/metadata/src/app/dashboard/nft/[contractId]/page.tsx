import { NftCollectionDetail } from '@/components/nft/collection-detail';

export default async function NftCollectionPage({ params }: { params: Promise<{ contractId: string }> }) {
    const { contractId } = await params;

    return (
        <div className="container pb-12">
            <NftCollectionDetail contractId={decodeURIComponent(contractId)} />
        </div>
    );
}
