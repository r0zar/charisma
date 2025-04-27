'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Vault } from '@repo/dexterity';
import { useSearchParams } from 'next/navigation';
import VaultList from './VaultList';
import { previewVault, confirmVault } from '@/app/actions';

// Helper: detect contract id
const looksLikeContractId = (id: string) => id.includes('.') && id.length > 10;

export default function ClientPage({ initialVaults = [] }: { initialVaults?: Vault[] }) {
    const searchParams = useSearchParams();
    const [vaults, setVaults] = useState<Vault[]>(initialVaults);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [debugMode, setDebugMode] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Preview state
    const [previewData, setPreviewData] = useState<{
        lpToken: any;
        tokenA: any;
        tokenB: any;
        suggestedVault?: Vault;
        analysis?: string;
    } | null>(null);

    // Read ?search param
    useEffect(() => {
        const term = searchParams.get('search') || '';
        setSearchTerm(term);
    }, [searchParams]);

    // Focus
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Filter
    const filteredVaults = useMemo(() => {
        if (!searchTerm) return vaults;
        const term = searchTerm.toLowerCase();
        return vaults.filter(v =>
            v.name?.toLowerCase().includes(term) ||
            v.symbol?.toLowerCase().includes(term) ||
            v.contractId.toLowerCase().includes(term)
        );
    }, [vaults, searchTerm]);

    // Step 1: Preview vault data
    const handlePreview = async () => {
        const id = searchTerm.trim();
        if (!looksLikeContractId(id)) {
            setError('Invalid contract ID format');
            return;
        }

        setIsLoading(true);
        setError(null);
        setPreviewData(null);

        try {
            const result = await previewVault(id);

            if (result.success && result.lpToken && result.tokenA && result.tokenB) {
                setPreviewData({
                    lpToken: result.lpToken,
                    tokenA: result.tokenA,
                    tokenB: result.tokenB,
                    suggestedVault: result.suggestedVault,
                    analysis: result.analysis
                });
            } else {
                setError(result.error || 'Failed to preview vault');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Confirm and save the vault
    const handleConfirm = async () => {
        if (!previewData) return;

        const id = searchTerm.trim();
        setIsLoading(true);

        try {
            const result = await confirmVault(
                id,
                previewData.lpToken,
                previewData.tokenA,
                previewData.tokenB,
                previewData.suggestedVault
            );

            if (result.success) {
                // Add to local state to avoid full page reload
                if (result.vault) {
                    setVaults(prevVaults => [...prevVaults, result.vault as Vault]);
                }
                setPreviewData(null); // Clear preview
                setSearchTerm(''); // Clear search
            } else {
                setError(result.error || 'Failed to save vault');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred while saving');
        } finally {
            setIsLoading(false);
        }
    };

    // Cancel preview
    const handleCancelPreview = () => {
        setPreviewData(null);
    };

    return (
        <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-16 bg-gray-900 text-gray-100">
            <div className="w-full max-w-6xl mx-auto">
                <header className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-100">Dex Vault Cache</h1>
                    <p className="text-gray-400 mt-2">
                        Add LP tokens from token-cache to create Vault objects for the DEX.
                    </p>
                    <div className="mt-2">
                        <label className="inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={debugMode}
                                onChange={() => setDebugMode(!debugMode)}
                            />
                            <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ml-3 text-sm font-medium text-gray-300">Debug Mode</span>
                        </label>
                    </div>
                </header>

                {/* Search & Add Section */}
                <div className="mb-8 bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-900/50 text-red-200 rounded-md border border-red-700">
                            <strong className="text-red-300">Error:</strong> {error}
                        </div>
                    )}

                    {/* Step 1: Input + Preview Button */}
                    {!previewData && (
                        <div className="flex gap-3">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Enter LP token contract ID"
                                className="flex-grow px-3 py-2 border bg-gray-700 border-gray-600 rounded text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                disabled={isLoading}
                            />
                            <button
                                onClick={handlePreview}
                                disabled={!looksLikeContractId(searchTerm) || isLoading}
                                className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Loading...' : 'Preview Vault'}
                            </button>
                        </div>
                    )}

                    {/* Step 2: Preview Data & Confirm/Cancel Buttons */}
                    {previewData && (
                        <div className="animate-fadeIn">
                            <h2 className="text-lg font-semibold mb-3 text-blue-300">
                                Vault Preview
                                {previewData.suggestedVault && (
                                    <span className="text-green-300 text-sm ml-2">(AI Enhanced)</span>
                                )}
                            </h2>

                            {/* Debug Mode: Raw Data Display */}
                            {debugMode && (
                                <div className="mb-6 p-4 bg-gray-800 rounded-md border border-yellow-900 text-xs font-mono overflow-auto max-h-96">
                                    <h3 className="font-bold text-md mb-2 text-yellow-400">Debug: Raw Data</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <h4 className="text-yellow-300 mb-1">LP Token:</h4>
                                            <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(previewData.lpToken, null, 2)}</pre>
                                        </div>
                                        <div>
                                            <h4 className="text-yellow-300 mb-1">Token A:</h4>
                                            <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(previewData.tokenA, null, 2)}</pre>
                                        </div>
                                        <div>
                                            <h4 className="text-yellow-300 mb-1">Token B:</h4>
                                            <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(previewData.tokenB, null, 2)}</pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Analysis Section (if available) */}
                            {previewData.analysis && (
                                <div className="mb-6 p-4 bg-gray-800 rounded-md border border-blue-900">
                                    <h3 className="font-bold text-md mb-2 text-blue-400">AI Analysis</h3>
                                    <p className="text-sm text-gray-300 whitespace-pre-line">{previewData.analysis}</p>
                                </div>
                            )}

                            {/* LP Token Info */}
                            <div className="mb-6 p-4 bg-gray-700/50 rounded-md border border-gray-700">
                                <div className="flex flex-col md:flex-row gap-4">
                                    {/* LP Token Image */}
                                    {previewData.lpToken.image && (
                                        <div className="flex-shrink-0">
                                            <img
                                                src={previewData.lpToken.image}
                                                alt={`${previewData.lpToken.name} logo`}
                                                className="w-24 h-24 rounded-md object-contain bg-white/10 p-2"
                                            />
                                        </div>
                                    )}

                                    <div className="flex-grow">
                                        <h3 className="font-bold text-md mb-2 text-blue-200">
                                            LP Token: {previewData.lpToken.name} ({previewData.lpToken.symbol})
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                                            <div>
                                                <span className="font-medium text-gray-400">Contract:</span> {searchTerm}
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-400">Decimals:</span> {previewData.lpToken.decimals}
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-400">Fee (%):</span> {Number(previewData.lpToken.lpRebatePercent)}
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-400">Identifier:</span> {previewData.lpToken.identifier || "—"}
                                            </div>
                                            {previewData.lpToken.engineContractId && (
                                                <div className="col-span-2">
                                                    <span className="font-medium text-gray-400">Engine:</span> {previewData.lpToken.engineContractId}
                                                </div>
                                            )}
                                        </div>

                                        {/* LP Token Description */}
                                        {previewData.lpToken.description && (
                                            <div className="mt-3 text-sm">
                                                <p className="text-gray-400 italic">{previewData.lpToken.description}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Token A/B Side by Side */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                {/* Token A */}
                                <div className="p-4 bg-blue-900/30 rounded-md border border-blue-900/50">
                                    <div className="flex flex-col gap-3">
                                        {/* Token A Image */}
                                        {previewData.tokenA.image && (
                                            <div className="flex justify-center">
                                                <img
                                                    src={previewData.tokenA.image}
                                                    alt={`${previewData.tokenA.name} logo`}
                                                    className="w-16 h-16 rounded-md object-contain bg-blue-800/30 p-2"
                                                />
                                            </div>
                                        )}

                                        <div>
                                            <h3 className="font-bold text-md mb-2 text-blue-300">
                                                Token A: {previewData.tokenA.name} ({previewData.tokenA.symbol})
                                            </h3>
                                            <div className="text-sm text-gray-300 space-y-1">
                                                <div><span className="font-medium text-gray-400">Contract:</span> {previewData.tokenA.contract_principal || previewData.tokenA.contractId || "Unknown"}</div>
                                                <div><span className="font-medium text-gray-400">Decimals:</span> {previewData.tokenA.decimals}</div>
                                                {previewData.tokenA.identifier && (
                                                    <div><span className="font-medium text-gray-400">Identifier:</span> {previewData.tokenA.identifier}</div>
                                                )}
                                            </div>

                                            {/* Token A Description */}
                                            {previewData.tokenA.description && (
                                                <div className="mt-2 text-sm">
                                                    <p className="text-gray-400 italic">{previewData.tokenA.description}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Token B */}
                                <div className="p-4 bg-purple-900/30 rounded-md border border-purple-900/50">
                                    <div className="flex flex-col gap-3">
                                        {/* Token B Image */}
                                        {previewData.tokenB.image && (
                                            <div className="flex justify-center">
                                                <img
                                                    src={previewData.tokenB.image}
                                                    alt={`${previewData.tokenB.name} logo`}
                                                    className="w-16 h-16 rounded-md object-contain bg-purple-800/30 p-2"
                                                />
                                            </div>
                                        )}

                                        <div>
                                            <h3 className="font-bold text-md mb-2 text-purple-300">
                                                Token B: {previewData.tokenB.name} ({previewData.tokenB.symbol})
                                            </h3>
                                            <div className="text-sm text-gray-300 space-y-1">
                                                <div><span className="font-medium text-gray-400">Contract:</span> {previewData.tokenB.contract_principal || previewData.tokenB.contractId || "Unknown"}</div>
                                                <div><span className="font-medium text-gray-400">Decimals:</span> {previewData.tokenB.decimals}</div>
                                                {previewData.tokenB.identifier && (
                                                    <div><span className="font-medium text-gray-400">Identifier:</span> {previewData.tokenB.identifier}</div>
                                                )}
                                            </div>

                                            {/* Token B Description */}
                                            {previewData.tokenB.description && (
                                                <div className="mt-2 text-sm">
                                                    <p className="text-gray-400 italic">{previewData.tokenB.description}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={handleCancelPreview}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800"
                                >
                                    {isLoading ? 'Saving...' : (previewData.suggestedVault ? 'Confirm & Save AI-Enhanced Vault' : 'Confirm & Save Vault')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Vault List */}
                <VaultList vaults={filteredVaults} />
            </div>
        </main>
    );
}
