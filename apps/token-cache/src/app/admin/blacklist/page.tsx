import { Suspense } from 'react';
import { getBlacklistedTokens } from '@/app/actions';
import BlacklistManager from '@/components/ui/blacklist-manager';

export const metadata = {
    title: 'Block list | Charisma Tokens',
    description: 'Manage blacklisted tokens to prevent re-indexing',
};

async function BlacklistData() {
    const result = await getBlacklistedTokens();

    if (!result.success) {
        return (
            <div className="bg-danger-soft border border-danger/30 rounded-lg p-4">
                <p className="text-danger">Error loading blacklisted tokens: {result.error}</p>
            </div>
        );
    }

    return <BlacklistManager initialBlacklistedTokens={result.data} />;
}

function BlacklistSkeleton() {
    return (
        <div className="space-y-6">
            <div className="animate-pulse">
                <div className="h-8 bg-surface-hover rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-surface-hover rounded w-1/2"></div>
            </div>
            <div className="grid gap-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="h-6 bg-surface-hover rounded w-3/4"></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function BlacklistPage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-ink mb-2">
                    Token Blacklist Management
                    {process.env.NODE_ENV === 'development' && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-soft text-warning">
                            Dev Only
                        </span>
                    )}
                </h1>
                <p className="text-ink-body">
                    Manage tokens that should be excluded from indexing and API responses.
                    Blacklisted tokens are automatically removed from the managed list and
                    cannot be re-added through normal indexing processes.
                </p>
                {process.env.NODE_ENV !== 'development' && (
                    <div className="mt-4 bg-danger-soft border border-danger/30 rounded-lg p-4">
                        <p className="text-danger font-medium">
                            ⚠️ Blacklist functionality is only available in development mode.
                        </p>
                    </div>
                )}
            </div>

            <Suspense fallback={<BlacklistSkeleton />}>
                <BlacklistData />
            </Suspense>
        </div>
    );
} 