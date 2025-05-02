'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import VaultList from './VaultList';
import { previewVault, confirmVault, fetchTokensAndAnalyze } from '@/app/actions';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, HelpCircle, Info, Edit, ExternalLink } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface Vault {
    contractId: string;
    name: string;
    symbol: string;
    description: string;
    image: string;
    fee: number;
    externalPoolId: string;
    engineContractId: string;
    reservesA: number;
    reservesB: number;
}

// Helper: detect contract id
const looksLikeContractId = (id: string) => id.includes('.') && id.length > 10;

// Define the structure for preview data state
interface PreviewDataState {
    lpToken: any;
    tokenA?: any;
    tokenB?: any;
    requiresManualInput?: boolean;
}

export default function PoolImporter({ initialVaults = [] }: { initialVaults?: Vault[] }) {
    const searchParams = useSearchParams();
    const [vaults, setVaults] = useState<Vault[]>(initialVaults);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [debugMode, setDebugMode] = useState(true);

    // Preview state
    const [previewData, setPreviewData] = useState<PreviewDataState | null>(null);

    // State for manual input (Tokens A/B)
    const [manualTokenAId, setManualTokenAId] = useState('');
    const [manualTokenBId, setManualTokenBId] = useState('');
    const [isFetchingManualTokens, setIsFetchingManualTokens] = useState(false);

    // State for manual overrides (LP Token)
    const [manualLpName, setManualLpName] = useState('');
    const [manualLpSymbol, setManualLpSymbol] = useState('');
    const [manualLpDecimals, setManualLpDecimals] = useState('');
    const [manualLpIdentifier, setManualLpIdentifier] = useState('');
    const [manualLpFeePercent, setManualLpFeePercent] = useState('');
    const [manualExternalPoolId, setManualExternalPoolId] = useState('');

    // Effect to initialize manual LP overrides when preview data loads
    useEffect(() => {
        if (previewData?.lpToken) {
            setManualLpName(previewData.lpToken.name || '');
            setManualLpSymbol(previewData.lpToken.symbol || '');
            setManualLpDecimals(previewData.lpToken.decimals?.toString() || '');
            setManualLpIdentifier(previewData.lpToken.identifier || '');
            setManualLpFeePercent(previewData.lpToken.lpRebatePercent?.toString() || '');
            setManualExternalPoolId(previewData.lpToken.externalPoolId || '');
        }
    }, [previewData?.lpToken]);

    // Read ?search param
    useEffect(() => {
        const term = searchParams.get('search') || '';
        setSearchTerm(term);
    }, [searchParams]);

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
        setManualTokenAId('');
        setManualTokenBId('');
        setManualLpName('');
        setManualLpSymbol('');
        setManualLpDecimals('');
        setManualLpIdentifier('');
        setManualLpFeePercent('');
        setManualExternalPoolId('');

        try {
            const result = await previewVault(id);

            if (result.success) {
                if (result.requiresManualInput && result.lpToken) {
                    setPreviewData({
                        lpToken: result.lpToken,
                        requiresManualInput: true
                    });
                } else if (result.lpToken && result.tokenA && result.tokenB) {
                    setPreviewData({
                        lpToken: result.lpToken,
                        tokenA: result.tokenA,
                        tokenB: result.tokenB,
                        requiresManualInput: false
                    });
                } else {
                    setError('Preview succeeded but returned incomplete data.');
                }
            } else {
                setError(result.error || 'Failed to preview vault');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred during preview');
        } finally {
            setIsLoading(false);
        }
    };

    // Step 1.5: Fetch Tokens after manual input
    const handleFetchManualTokens = async () => {
        if (!previewData?.lpToken || !looksLikeContractId(manualTokenAId) || !looksLikeContractId(manualTokenBId)) {
            setError('Please enter valid contract IDs for both Token A and Token B.');
            return;
        }

        setIsFetchingManualTokens(true);
        setError(null);

        try {
            const result = await fetchTokensAndAnalyze(previewData.lpToken, manualTokenAId, manualTokenBId);

            if (result.success && result.tokenA && result.tokenB) {
                setPreviewData({
                    ...previewData,
                    tokenA: result.tokenA,
                    tokenB: result.tokenB,
                    requiresManualInput: false
                });
            } else {
                setError(result.error || 'Failed to fetch or analyze manually provided tokens.');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred while fetching manual tokens');
        } finally {
            setIsFetchingManualTokens(false);
        }
    };

    // Step 2: Confirm and save the vault
    const handleConfirm = async () => {
        if (!previewData || !previewData.lpToken || !previewData.tokenA || !previewData.tokenB || previewData.requiresManualInput) {
            setError('Cannot confirm: Missing complete token data.');
            return;
        }

        const vaultContractId = searchTerm.trim();
        setIsLoading(true);
        setError(null);

        const modifiedLpToken = {
            ...previewData.lpToken,
            name: manualLpName || previewData.lpToken.name,
            symbol: manualLpSymbol || previewData.lpToken.symbol,
            decimals: manualLpDecimals !== '' ? parseInt(manualLpDecimals, 10) : previewData.lpToken.decimals,
            identifier: manualLpIdentifier || previewData.lpToken.identifier,
            lpRebatePercent: manualLpFeePercent !== '' ? parseFloat(manualLpFeePercent) : previewData.lpToken.lpRebatePercent,
            externalPoolId: manualExternalPoolId || previewData.lpToken.externalPoolId || '',
        };

        if (isNaN(modifiedLpToken.decimals) || modifiedLpToken.decimals < 0) {
            setError('Invalid LP Token Decimals entered.');
            setIsLoading(false);
            return;
        }
        if (isNaN(modifiedLpToken.lpRebatePercent) || modifiedLpToken.lpRebatePercent < 0) {
            setError('Invalid LP Token Fee Percentage entered.');
            setIsLoading(false);
            return;
        }

        try {
            const result = await confirmVault(
                vaultContractId,
                modifiedLpToken,
                previewData.tokenA,
                previewData.tokenB
            );

            if (result.success) {
                if (result.vault && setVaults) {
                    setVaults(prevVaults => [...(prevVaults || []), result.vault as Vault]);
                }
                setPreviewData(null);
                setSearchTerm('');
                setError(null);
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
        setError(null);
        setManualTokenAId('');
        setManualTokenBId('');
        setManualLpName('');
        setManualLpSymbol('');
        setManualLpDecimals('');
        setManualLpIdentifier('');
        setManualLpFeePercent('');
        setManualExternalPoolId('');
    };

    // Determine button states
    const canPreview = looksLikeContractId(searchTerm) && !isLoading && !isFetchingManualTokens;
    const canFetchManual = looksLikeContractId(manualTokenAId) && looksLikeContractId(manualTokenBId) && !isLoading && !isFetchingManualTokens;
    const canConfirm = previewData && previewData.lpToken && previewData.tokenA && previewData.tokenB && !previewData.requiresManualInput && !isLoading && !isFetchingManualTokens;

    return (
        <div className="w-full">
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
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                            type="text"
                            placeholder="Enter LP token or External Pool contract ID..."
                            value={searchTerm}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                            disabled={isLoading}
                            className="flex-grow"
                        />
                        <Button
                            onClick={handlePreview}
                            disabled={!canPreview}
                            className="flex-shrink-0"
                        >
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isLoading ? 'Loading...' : 'Preview Contract'}
                        </Button>
                    </div>
                )}

                {/* Step 1.5 & 2: Preview Data & Actions */}
                {previewData && (
                    <div className="animate-fadeIn space-y-6">
                        <h2 className="text-lg font-semibold text-primary flex items-center">
                            Vault Preview: {manualLpName || '(Name Missing)'} ({manualLpSymbol || '(Symbol Missing)'})
                            {previewData.requiresManualInput && (
                                <Badge variant="destructive" className="ml-2">Manual Input Required</Badge>
                            )}
                        </h2>

                        {/* Debug Mode: Raw Data Display - Apply theme bg/border */}
                        {debugMode && (
                            <div className="mb-6 p-4 bg-muted/50 rounded-md border border-yellow-500/50 text-xs font-mono overflow-auto max-h-96">
                                <h3 className="font-bold text-md mb-2 text-yellow-400">Debug: Raw Data</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <h4 className="text-yellow-300 mb-1">LP Token (Original Fetched):</h4>
                                        <pre className="text-muted-foreground whitespace-pre-wrap break-all">{JSON.stringify(previewData.lpToken, null, 2)}</pre>
                                    </div>
                                    <div>
                                        <h4 className="text-yellow-300 mb-1">Token A:</h4>
                                        <pre className="text-muted-foreground whitespace-pre-wrap break-all">{JSON.stringify(previewData.tokenA || 'Not loaded', null, 2)}</pre>
                                    </div>
                                    <div>
                                        <h4 className="text-yellow-300 mb-1">Token B:</h4>
                                        <pre className="text-muted-foreground whitespace-pre-wrap break-all">{JSON.stringify(previewData.tokenB || 'Not loaded', null, 2)}</pre>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* LP Token Info & Edit Section */}
                        <div className="mb-6 p-4 bg-muted/30 rounded-md border border-border relative group">
                            <h3 className="font-bold text-md mb-4 text-primary flex items-center">
                                <Edit className="w-4 h-4 mr-2 opacity-50 group-hover:opacity-100 transition-opacity" /> LP Token Details (Editable)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label htmlFor="lpName">Name</Label>
                                    <Input
                                        id="lpName" type="text"
                                        value={manualLpName} onChange={(e) => setManualLpName(e.target.value)}
                                        placeholder={previewData.lpToken?.name || "Enter LP Token Name"}
                                        disabled={isLoading || isFetchingManualTokens}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="lpSymbol">Symbol</Label>
                                    <Input
                                        id="lpSymbol" type="text"
                                        value={manualLpSymbol} onChange={(e) => setManualLpSymbol(e.target.value)}
                                        placeholder={previewData.lpToken?.symbol || "Enter LP Symbol"}
                                        disabled={isLoading || isFetchingManualTokens}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="lpDecimals">Decimals</Label>
                                    <Input
                                        id="lpDecimals" type="number" min="0" step="1"
                                        value={manualLpDecimals} onChange={(e) => setManualLpDecimals(e.target.value)}
                                        placeholder={previewData.lpToken?.decimals?.toString() || "Enter Decimals"}
                                        disabled={isLoading || isFetchingManualTokens}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="lpIdentifier">Identifier</Label>
                                    <Input
                                        id="lpIdentifier" type="text"
                                        value={manualLpIdentifier} onChange={(e) => setManualLpIdentifier(e.target.value)}
                                        placeholder={previewData.lpToken?.identifier || "(Optional) Enter Identifier"}
                                        disabled={isLoading || isFetchingManualTokens}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="lpFeePercent">Fee (%)</Label>
                                    <Input
                                        id="lpFeePercent" type="number" min="0" step="0.01"
                                        value={manualLpFeePercent} onChange={(e) => setManualLpFeePercent(e.target.value)}
                                        placeholder={previewData.lpToken?.lpRebatePercent?.toString() || "Enter Fee %"}
                                        disabled={isLoading || isFetchingManualTokens}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="vaultContract">Vault Contract ID</Label>
                                    <Input id="vaultContract" type="text" value={searchTerm} disabled className="font-mono bg-muted/80" />
                                </div>
                            </div>
                            <div className="border-t border-border/50 pt-4 mt-4">
                                <Label htmlFor="manualExternalId" className="flex items-center gap-1 mb-1">
                                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                    External Pool ID <span className="text-xs text-muted-foreground">(Optional)</span>
                                </Label>
                                <Input
                                    id="manualExternalId" type="text"
                                    value={manualExternalPoolId} onChange={(e) => setManualExternalPoolId(e.target.value)}
                                    placeholder={previewData.lpToken?.externalPoolId || "e.g., SP...uniswap-v2-pool"}
                                    disabled={isLoading || isFetchingManualTokens}
                                    className="font-mono"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    If this vault wraps or interacts with an external pool (like a UniV2 core), enter its contract ID here.
                                </p>
                            </div>
                            {/* Display original image/description if available */}
                            <div className="mt-4 flex items-start gap-4">
                                {previewData.lpToken.image && (
                                    <img
                                        src={previewData.lpToken.image}
                                        alt={`${manualLpName || 'LP'} logo`}
                                        className="w-16 h-16 rounded-md object-contain bg-background/50 p-1 border border-border flex-shrink-0"
                                    />
                                )}
                                {previewData.lpToken.description && (
                                    <p className="text-sm text-muted-foreground italic pt-1">
                                        Original Description: {previewData.lpToken.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Manual Input Section (Conditional for Token A/B) */}
                        {previewData.requiresManualInput && (
                            <div className="space-y-4 p-4 border border-dashed border-amber-500 rounded-md bg-amber-500/5">
                                <h3 className="font-semibold text-amber-400 flex items-center gap-2">
                                    <HelpCircle className="h-5 w-5" /> Manual Input Required (Token A & B)
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    We couldn't automatically determine the underlying token contracts. Please enter them below.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="tokenAId">Token A Contract ID</Label>
                                        <Input
                                            id="tokenAId"
                                            type="text"
                                            placeholder="SP...contract.token-a"
                                            value={manualTokenAId}
                                            onChange={(e) => setManualTokenAId(e.target.value)}
                                            disabled={isFetchingManualTokens}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="tokenBId">Token B Contract ID</Label>
                                        <Input
                                            id="tokenBId"
                                            type="text"
                                            placeholder="SP...contract.token-b"
                                            value={manualTokenBId}
                                            onChange={(e) => setManualTokenBId(e.target.value)}
                                            disabled={isFetchingManualTokens}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={handleCancelPreview}
                                        disabled={isLoading || isFetchingManualTokens}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleFetchManualTokens}
                                        disabled={!canFetchManual}
                                    >
                                        {isFetchingManualTokens ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        {isFetchingManualTokens ? 'Fetching...' : 'Fetch Token Details'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Token A/B Side by Side (Conditional - Full Preview Only) */}
                        {!previewData.requiresManualInput && previewData.tokenA && previewData.tokenB && (
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
                        )}

                        {/* Action Buttons (Confirm/Cancel - Conditional) */}
                        {!previewData.requiresManualInput && (
                            <div className="flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={handleCancelPreview}
                                    disabled={isLoading || isFetchingManualTokens}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleConfirm}
                                    disabled={!canConfirm}
                                    variant="default"
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {isLoading ? 'Saving...' : 'Confirm & Save Vault'}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
