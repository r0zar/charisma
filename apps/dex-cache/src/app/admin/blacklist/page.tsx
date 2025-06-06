import { Suspense } from 'react';
import { getBlacklistedVaults } from '@/app/actions';
import VaultBlacklistManager from '@/components/ui/vault-blacklist-manager';

export const metadata = {
    title: 'Vault Blacklist Management | DEX Cache Admin',
    description: 'Manage blacklisted vaults to prevent indexing',
};

async function VaultBlacklistData() {
    const result = await getBlacklistedVaults();

    if (!result.success) {
        return (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400">Error loading blacklisted vaults: {result.error}</p>
            </div>
        );
    }

    return <VaultBlacklistManager initialBlacklistedVaults={result.data} />;
}

function VaultBlacklistSkeleton() {
    return (
        <div className="space-y-6">
            <div className="animate-pulse">
                <div className="h-8 bg-muted rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
            <div className="grid gap-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="h-6 bg-muted rounded w-3/4"></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function VaultBlacklistPage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                    Vault Blacklist Management
                    {process.env.NODE_ENV === 'development' && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/20 text-secondary">
                            Dev Only
                        </span>
                    )}
                </h1>
                <p className="text-muted-foreground">
                    Manage vaults that should be excluded from indexing and API responses.
                    Blacklisted vaults are automatically removed from cache and
                    cannot appear in pool listings.
                </p>
                {process.env.NODE_ENV !== 'development' && (
                    <div className="mt-4 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                        <p className="text-red-400 font-medium">
                            ⚠️ Vault blacklist functionality is only available in development mode.
                        </p>
                    </div>
                )}
            </div>

            <Suspense fallback={<VaultBlacklistSkeleton />}>
                <VaultBlacklistData />
            </Suspense>
        </div>
    );
} 