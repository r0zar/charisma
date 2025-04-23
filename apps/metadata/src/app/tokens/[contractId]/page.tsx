// src/app/tokens/[contractId]/page.tsx
import { TokenDetail } from '@/components/tokens/token-detail';

// always fetch fresh data
export const dynamic = 'force-dynamic';

export default async function TokenDetailPage({
    params,
}: {
    params: Promise<{ contractId: string }>;   // 👈 params is now a Promise
}) {
    const { contractId } = await params;       // 👈 unwrap it first
    const decoded = decodeURIComponent(contractId);

    return (
        <div className="container pb-12">
            <TokenDetail contractId={decoded} />
        </div>
    );
}
