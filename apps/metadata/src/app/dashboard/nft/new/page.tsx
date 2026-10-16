import { NewNftCollection } from '@/components/nft/new-collection';

export default async function NewNftCollectionPage({ searchParams }: { searchParams: Promise<{ contract?: string }> }) {
    const { contract } = await searchParams;

    return (
        <div className="container pb-12">
            <NewNftCollection initialContract={contract?.split('.').pop()} />
        </div>
    );
}
