import { NftCollectionWizard } from '@/components/nft-collection/collection-wizard';

export default async function Sip009TemplatePage({ searchParams }: { searchParams: Promise<{ contract?: string }> }) {
    const { contract } = await searchParams;

    return (
        <div className="container px-4 py-8 mx-auto">
            <NftCollectionWizard initialContract={contract} />
        </div>
    );
}
