'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Vault } from '@repo/dexterity';
import { useSearchParams } from 'next/navigation';
import VaultList from './VaultList';
import { previewVault, confirmVault } from '@/app/actions';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
        <main className="max-w-[2000px] mx-auto flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-16 bg-background text-foreground">
            <div className="w-full">
                <header className="mb-8 text-center">
                    <h1 className="text-3xl font-bold">Dex Vault Cache</h1>
                    <p className="text-muted-foreground mt-2">
                        Add LP tokens from token-cache to create Vault objects for the DEX.
                    </p>
                    <div className="mt-4 flex items-center justify-center space-x-2">
                        <Switch
                            id="debug-mode"
                            checked={debugMode}
                            onCheckedChange={setDebugMode}
                        />
                        <Label htmlFor="debug-mode" className="text-sm font-medium text-muted-foreground">
                            Debug Mode
                        </Label>
                    </div>
                </header>

                {/* Search & Add Section - Apply theme bg/border */}
                <div className="mb-8 bg-card p-6 rounded-lg shadow-lg border border-border">
                    {/* Error Message - Use Alert component with destructive variant */}
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Step 1: Input + Preview Button */}
                    {!previewData && (
                        <div className="flex gap-3">
                            <Input
                                ref={inputRef}
                                type="text"
                                placeholder="Enter LP token contract ID (e.g., SP...contract.token)"
                                value={searchTerm}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                disabled={isLoading}
                                className="flex-grow"
                            />
                            <Button
                                onClick={handlePreview}
                                disabled={!looksLikeContractId(searchTerm) || isLoading}
                            >
                                {isLoading ? 'Loading...' : 'Preview Vault'}
                            </Button>
                        </div>
                    )}

                    {/* Step 2: Preview Data & Confirm/Cancel Buttons */}
                    {previewData && (
                        <div className="animate-fadeIn space-y-6">
                            <h2 className="text-lg font-semibold text-primary">
                                Vault Preview
                                {previewData.suggestedVault && (
                                    <span className="text-green-500 text-sm ml-2">(AI Enhanced)</span>
                                )}
                            </h2>

                            {/* Debug Mode: Raw Data Display - Apply theme bg/border */}
                            {debugMode && (
                                <div className="mb-6 p-4 bg-muted/50 rounded-md border border-yellow-500/50 text-xs font-mono overflow-auto max-h-96">
                                    <h3 className="font-bold text-md mb-2 text-yellow-400">Debug: Raw Data</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <h4 className="text-yellow-300 mb-1">LP Token:</h4>
                                            <pre className="text-muted-foreground whitespace-pre-wrap">{JSON.stringify(previewData.lpToken, null, 2)}</pre>
                                        </div>
                                        <div>
                                            <h4 className="text-yellow-300 mb-1">Token A:</h4>
                                            <pre className="text-muted-foreground whitespace-pre-wrap">{JSON.stringify(previewData.tokenA, null, 2)}</pre>
                                        </div>
                                        <div>
                                            <h4 className="text-yellow-300 mb-1">Token B:</h4>
                                            <pre className="text-muted-foreground whitespace-pre-wrap">{JSON.stringify(previewData.tokenB, null, 2)}</pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Analysis Section - Use Alert */}
                            {previewData.analysis && (
                                <Alert variant="default" className="mb-6 border-blue-500/50 bg-blue-500/5">
                                    <AlertTitle className="text-blue-400">AI Analysis</AlertTitle>
                                    <AlertDescription className="text-muted-foreground whitespace-pre-line">
                                        {previewData.analysis}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* LP Token Info - Apply theme bg/border */}
                            <div className="mb-6 p-4 bg-muted/30 rounded-md border border-border">
                                <div className="flex flex-col md:flex-row gap-4">
                                    {previewData.lpToken.image && (
                                        <div className="flex-shrink-0">
                                            <img
                                                src={previewData.lpToken.image}
                                                alt={`${previewData.lpToken.name} logo`}
                                                className="w-24 h-24 rounded-md object-contain bg-background/50 p-2 border border-border"
                                            />
                                        </div>
                                    )}
                                    <div className="flex-grow">
                                        <h3 className="font-bold text-md mb-2 text-primary">
                                            LP Token: {previewData.lpToken.name} ({previewData.lpToken.symbol})
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
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

                            {/* Token A/B Side by Side - Apply theme bg/border */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                {/* Token A */}
                                <div className="p-4 bg-primary/5 rounded-md border border-primary/20">
                                    <div className="flex flex-col gap-3 items-center">
                                        {previewData.tokenA.image && (
                                            <img
                                                src={previewData.tokenA.image}
                                                alt={`${previewData.tokenA.name} logo`}
                                                className="w-16 h-16 rounded-md object-contain bg-background/50 p-2 border border-border"
                                            />
                                        )}
                                        <div className="text-center">
                                            <h3 className="font-bold text-md mb-2 text-primary">
                                                Token A: {previewData.tokenA.name} ({previewData.tokenA.symbol})
                                            </h3>
                                            <div className="text-sm text-muted-foreground space-y-1">
                                                <div><span className="font-medium text-gray-400">Contract:</span> {previewData.tokenA.contract_principal || previewData.tokenA.contractId || "Unknown"}</div>
                                                <div><span className="font-medium text-gray-400">Decimals:</span> {previewData.tokenA.decimals}</div>
                                                <div><span className="font-medium text-gray-400">Reserves:</span> {previewData.tokenA.reservesA} / {previewData.tokenA.reservesB}</div>
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
                                <div className="p-4 bg-secondary/5 rounded-md border border-secondary/20">
                                    <div className="flex flex-col gap-3 items-center">
                                        {previewData.tokenB.image && (
                                            <img
                                                src={previewData.tokenB.image}
                                                alt={`${previewData.tokenB.name} logo`}
                                                className="w-16 h-16 rounded-md object-contain bg-background/50 p-2 border border-border"
                                            />
                                        )}
                                        <div className="text-center">
                                            <h3 className="font-bold text-md mb-2 text-secondary">
                                                Token B: {previewData.tokenB.name} ({previewData.tokenB.symbol})
                                            </h3>
                                            <div className="text-sm text-muted-foreground space-y-1">
                                                <div><span className="font-medium text-gray-400">Contract:</span> {previewData.tokenB.contract_principal || previewData.tokenB.contractId || "Unknown"}</div>
                                                <div><span className="font-medium text-gray-400">Decimals:</span> {previewData.tokenB.decimals}</div>
                                                <div><span className="font-medium text-gray-400">Reserves:</span> {previewData.tokenB.reservesA} / {previewData.tokenB.reservesB}</div>
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
                                <Button
                                    variant="outline"
                                    onClick={handleCancelPreview}
                                    disabled={isLoading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleConfirm}
                                    disabled={isLoading}
                                    variant="default" // Use default variant, can override bg if needed
                                    className="bg-green-600 hover:bg-green-700" // Keep green confirm
                                >
                                    {isLoading ? 'Saving...' : (previewData.suggestedVault ? 'Confirm & Save AI-Enhanced Vault' : 'Confirm & Save Vault')}
                                </Button>
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
