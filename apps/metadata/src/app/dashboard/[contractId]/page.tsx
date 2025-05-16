import { MetadataDetail } from '@/components/metadata/metadata-detail';

// always fetch fresh data
export const dynamic = 'force-dynamic';

export default async function TokenDetailPage({ params }: { params: Promise<{ contractId: string }> }) {
    const { contractId } = await params;
    const decoded = decodeURIComponent(contractId);

    return (
        <div className="container pb-12">
            <MetadataDetail contractId={decoded} />
        </div>
    );
}
