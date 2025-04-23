import { TokensList } from '@/components/tokens/tokens-list';

// Set this to dynamic to ensure we always get fresh data
export const dynamic = 'force-dynamic';

export default function TokensPage() {
    return (
        <div className="container pb-12">
            <TokensList />
        </div>
    );
} 