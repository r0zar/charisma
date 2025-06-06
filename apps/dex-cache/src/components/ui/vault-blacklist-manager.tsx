'use client';

import { useState, useTransition } from 'react';
import { blacklistVault, unblacklistVault } from '@/app/actions';

interface VaultBlacklistManagerProps {
    initialBlacklistedVaults: string[];
}

export default function VaultBlacklistManager({ initialBlacklistedVaults }: VaultBlacklistManagerProps) {
    const [blacklistedVaults, setBlacklistedVaults] = useState<string[]>(initialBlacklistedVaults);
    const [newVaultId, setNewVaultId] = useState('');
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleAddVault = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newVaultId.trim()) return;

        startTransition(async () => {
            try {
                const result = await blacklistVault(newVaultId.trim());
                if (result.success) {
                    setBlacklistedVaults(prev => [...prev, newVaultId.trim()]);
                    setNewVaultId('');
                    showMessage('success', 'message' in result ? result.message : 'Vault blacklisted successfully');
                } else {
                    showMessage('error', 'error' in result ? result.error : 'Failed to blacklist vault');
                }
            } catch (error) {
                showMessage('error', 'An unexpected error occurred');
            }
        });
    };

    const handleRemoveVault = async (contractId: string) => {
        startTransition(async () => {
            try {
                const result = await unblacklistVault(contractId);
                if (result.success) {
                    setBlacklistedVaults(prev => prev.filter(id => id !== contractId));
                    showMessage('success', 'message' in result ? result.message : 'Vault removed from blacklist successfully');
                } else {
                    showMessage('error', 'error' in result ? result.error : 'Failed to remove vault from blacklist');
                }
            } catch (error) {
                showMessage('error', 'An unexpected error occurred');
            }
        });
    };

    return (
        <div className="space-y-8">
            {/* Message Display */}
            {message && (
                <div className={`rounded-lg p-4 ${message.type === 'success'
                    ? 'bg-green-900/20 border border-green-500/30 text-green-400'
                    : 'bg-red-900/20 border border-red-500/30 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Add Vault Form */}
            <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                    Add Vault to Blacklist
                </h2>
                <form onSubmit={handleAddVault} className="space-y-4">
                    <div>
                        <label htmlFor="vaultId" className="block text-sm font-medium text-muted-foreground mb-2">
                            Vault Contract ID
                        </label>
                        <input
                            type="text"
                            id="vaultId"
                            value={newVaultId}
                            onChange={(e) => setNewVaultId(e.target.value)}
                            placeholder="e.g., SP2AKWJYC7BNY18W1XXKPGP0YVEK63QJG4793Z2D4.vault-contract"
                            className="block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm bg-background text-foreground"
                            disabled={isPending}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isPending || !newVaultId.trim()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-destructive-foreground bg-destructive hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Adding...
                            </>
                        ) : (
                            'Add to Blacklist'
                        )}
                    </button>
                </form>
            </div>

            {/* Blacklisted Vaults List */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-foreground">
                        Blacklisted Vaults
                    </h2>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {blacklistedVaults.length} vaults
                    </span>
                </div>

                {blacklistedVaults.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-muted">
                            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8V4a1 1 0 00-1-1H6a1 1 0 00-1 1v1m16 0h-2M4 5h2" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-foreground mb-2">No blacklisted vaults</h3>
                        <p className="text-muted-foreground">Vaults you blacklist will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {blacklistedVaults.map((vaultId) => (
                            <div
                                key={vaultId}
                                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate font-mono">
                                        {vaultId}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleRemoveVault(vaultId)}
                                    disabled={isPending}
                                    className="ml-4 inline-flex items-center px-3 py-1 border border-border text-sm font-medium rounded-md text-muted-foreground bg-card hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPending ? 'Removing...' : 'Remove'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info Section */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-primary">
                            About Vault Blacklisting
                        </h3>
                        <div className="mt-2 text-sm text-muted-foreground">
                            <ul className="list-disc list-inside space-y-1">
                                <li>Blacklisted vaults are automatically removed from cache</li>
                                <li>They will not appear in API responses or pool listings</li>
                                <li>Cached data for blacklisted vaults is automatically deleted</li>
                                <li>Blacklisted vaults cannot be accessed through normal pool endpoints</li>
                                <li>Use this feature to permanently exclude problematic or unwanted vaults</li>
                                <li>Only available in development mode for safety</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 