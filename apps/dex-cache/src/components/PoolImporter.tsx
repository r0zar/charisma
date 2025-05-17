'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import VaultList from './VaultList';
import { previewVault, fetchTokensAndAnalyze } from '@/app/actions';
import { useApp } from '@/lib/context/app-context';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, HelpCircle, Info, Edit, ExternalLink } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Vault {
    contractId: string;
    type?: string;
    name: string;
    symbol?: string;
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

export default function VaultImporter({ initialVaults = [] }: { initialVaults?: Vault[] }) {
    const searchParams = useSearchParams();
    const { walletState, fetchWithAdminAuth } = useApp();
    const [vaults, setVaults] = useState<Vault[]>(initialVaults);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [debugMode, setDebugMode] = useState(true);
    const [advancedMode, setAdvancedMode] = useState(false);
    const [manualJsonInput, setManualJsonInput] = useState('');
    const [isValidJson, setIsValidJson] = useState(true);

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
    const [manualVaultType, setManualVaultType] = useState('POOL'); // Default type
    const [manualProtocol, setManualProtocol] = useState('CHARISMA'); // Default protocol

    // Effect to initialize manual LP overrides when preview data loads
    useEffect(() => {
        if (previewData?.lpToken) {
            setManualLpName(previewData.lpToken.name || '');
            setManualLpSymbol(previewData.lpToken.symbol || '');
            setManualLpDecimals(previewData.lpToken.decimals?.toString() || '');
            setManualLpIdentifier(previewData.lpToken.identifier || '');
            setManualLpFeePercent(previewData.lpToken.lpRebatePercent?.toString() || '');
            setManualExternalPoolId(previewData.lpToken.externalPoolId || '');
            setManualVaultType(previewData.lpToken.type || 'POOL');
            setManualProtocol(previewData.lpToken.protocol || 'CHARISMA');
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

    // Handle manual JSON input changes
    const handleJsonInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = event.target.value;
        setManualJsonInput(newValue);

        try {
            JSON.parse(newValue);
            setIsValidJson(true);
        } catch (e) {
            setIsValidJson(false);
        }
    };

    // Step 1: Preview vault data
    const handlePreview = async () => {
        if (advancedMode) {
            // In advanced mode, validate and use the JSON input
            if (!isValidJson) {
                setError('Invalid JSON format. Please correct your input.');
                return;
            }

            try {
                const manualData = JSON.parse(manualJsonInput);
                if (!manualData.contractId) {
                    setError('JSON must include at least a contractId field.');
                    return;
                }

                setIsLoading(true);
                setError(null);
                setPreviewData({
                    lpToken: manualData,
                    tokenA: manualData.tokenA || null,
                    tokenB: manualData.tokenB || null,
                    requiresManualInput: !manualData.tokenA || !manualData.tokenB
                });
                setIsLoading(false);
                return;
            } catch (err: any) {
                setError(err.message || 'Error parsing JSON input');
                return;
            }
        }

        // Standard mode - fetch from contract ID
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
        setManualVaultType('POOL');
        setManualProtocol('CHARISMA');

        try {
            const result = await previewVault(id);
            console.log("Preview result:", result);

            if (result.success) {
                // First, handle the case where only the lpToken is returned
                if (result.lpTokenDetails?.lpToken) {
                    // Check if tokenA/tokenB are required but missing
                    const vaultType = result.lpTokenDetails?.lpToken.type?.toUpperCase() || 'POOL';

                    // POOL and SUBLINK types typically need tokenA/tokenB
                    if ((vaultType === 'POOL' || vaultType === 'SUBLINK') && (!result.lpTokenDetails?.tokenA || !result.lpTokenDetails?.tokenB)) {
                        // If manual input is explicitly flagged, handle gracefully
                        if (result.requiresManualInput) {
                            setPreviewData({
                                lpToken: result.lpTokenDetails?.lpToken,
                                requiresManualInput: true
                            });
                        } else {
                            // Some tokens definitely need manual input
                            setPreviewData({
                                lpToken: result.lpTokenDetails?.lpToken,
                                requiresManualInput: true
                            });
                            setError('Token information incomplete. Please provide Token A and B contract IDs manually.');
                        }
                    } else if (vaultType === 'ENERGY') {
                        // Other vault types may not need tokenA/tokenB
                        setPreviewData({
                            lpToken: result.lpTokenDetails?.lpToken,
                            tokenA: result.lpTokenDetails?.tokenA || null,
                            tokenB: result.lpTokenDetails?.tokenB || null,
                            requiresManualInput: false
                        });
                    } else if (result.lpTokenDetails?.tokenA && result.lpTokenDetails?.tokenB) {
                        // Complete data case
                        setPreviewData({
                            lpToken: result.lpTokenDetails?.lpToken,
                            tokenA: result.lpTokenDetails?.tokenA,
                            tokenB: result.lpTokenDetails?.tokenB,
                            requiresManualInput: false
                        });
                    } else {
                        // Handle edge case - have lpToken but don't know if tokens are needed
                        setPreviewData({
                            lpToken: result.lpTokenDetails?.lpToken,
                            requiresManualInput: true
                        });
                        setError('Not enough information to determine vault structure. Please fill in missing details.');
                    }
                } else if (result.contractMetadata) {
                    setPreviewData({
                        lpToken: result.contractMetadata,
                        requiresManualInput: false
                    });
                } else {
                    // No lpToken at all is a critical failure
                    setError('Preview returned no main vault data. Please check the contract ID.');
                }
            } else {
                // Handle explicit failure case
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

    // Step 2: Confirm and save the vault via API route
    const handleConfirm = async () => {
        if (advancedMode) {
            // In advanced mode, use the manual JSON data
            if (!isValidJson) {
                setError('Invalid JSON format. Cannot save.');
                return;
            }

            setIsLoading(true);
            try {
                const manualData = JSON.parse(manualJsonInput);
                const vaultContractId = manualData.contractId;

                if (!vaultContractId) {
                    setError('JSON must include a contractId field.');
                    setIsLoading(false);
                    return;
                }

                if (!fetchWithAdminAuth) {
                    setError('Admin authentication function not available. Cannot confirm.');
                    setIsLoading(false);
                    return;
                }

                // Call the API with the entire JSON object
                const apiUrl = `/api/v1/admin/vaults/${encodeURIComponent(vaultContractId)}/metadata`;
                const response = await fetchWithAdminAuth(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: manualJsonInput,
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    console.log('Vault saved successfully via API.');
                    setVaults(prevVaults => [...(prevVaults || []), manualData]);
                    setManualJsonInput('');
                    setError(null);
                    setPreviewData(null);
                } else {
                    console.error('API Error Response:', result);
                    setError(result.message || 'Failed to save vault via API');
                }
            } catch (err: any) {
                console.error('Error during confirm:', err);
                setError(err.message || 'An unexpected error occurred while saving');
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // Standard mode - use preview data
        if (!previewData || !previewData.lpToken) {
            setError('Cannot confirm: Missing vault data.');
            return;
        }

        // Check vault type to determine requirements
        const vaultType = (manualVaultType || previewData.lpToken.type || 'POOL').toUpperCase();

        // For POOL and SUBLINK types, we need token A and B
        if ((vaultType === 'POOL' || vaultType === 'SUBLINK') &&
            (previewData.requiresManualInput || !previewData.tokenA || !previewData.tokenB)) {
            setError(`For ${vaultType} type vaults, both Token A and Token B are required.`);
            return;
        }

        if (!fetchWithAdminAuth) {
            setError('Admin authentication function not available. Cannot confirm.');
            return;
        }

        const vaultContractId = searchTerm.trim();
        setIsLoading(true);
        setError(null);

        // Prepare the modifiedLpToken, initially taking values from previewData.lpToken
        const modifiedLpToken: any = {
            ...previewData.lpToken,
            name: manualLpName || previewData.lpToken.name,
            identifier: manualLpIdentifier || previewData.lpToken.identifier,
            externalPoolId: manualExternalPoolId || previewData.lpToken.externalPoolId || '',
            type: manualVaultType || previewData.lpToken.type || 'POOL',
            protocol: manualProtocol || previewData.lpToken.protocol || 'CHARISMA',
        };

        // Handle Decimals (optional)
        if (manualLpDecimals === '') {
            modifiedLpToken.decimals = undefined;
        } else {
            const parsedDecimals = parseInt(manualLpDecimals, 10);
            if (isNaN(parsedDecimals) || parsedDecimals < 0) {
                setError('Invalid LP Token Decimals: must be a non-negative integer if provided.');
                setIsLoading(false);
                return;
            }
            modifiedLpToken.decimals = parsedDecimals;
        }

        // Handle Symbol (optional)
        if (manualLpSymbol === '') {
            modifiedLpToken.symbol = undefined;
        } else {
            modifiedLpToken.symbol = manualLpSymbol;
        }

        // Handle Fee Percentage (lpRebatePercent) (optional)
        if (manualLpFeePercent === '') {
            modifiedLpToken.lpRebatePercent = undefined;
        } else {
            const parsedFee = parseFloat(manualLpFeePercent);
            if (isNaN(parsedFee) || parsedFee < 0) {
                setError('Invalid LP Token Fee Percentage: must be a non-negative number if provided.');
                setIsLoading(false);
                return;
            }
            modifiedLpToken.lpRebatePercent = parsedFee;
        }

        // Prepare the request body for the API (NO contractId here)
        const requestBody = {
            lpToken: modifiedLpToken,
            tokenA: previewData.tokenA,
            tokenB: previewData.tokenB,
        };

        try {
            // Construct dynamic URL
            const apiUrl = `/api/v1/admin/vaults/${encodeURIComponent(vaultContractId)}/confirm`;
            console.log(`Calling ${apiUrl} with admin auth...`);

            // Use fetchWithAdminAuth to call the NEW dynamic API route
            const response = await fetchWithAdminAuth(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                console.log('Vault confirmed successfully via API.');
                if (result.vault && setVaults) {
                    setVaults(prevVaults => [...(prevVaults || []), result.vault as Vault]);
                }
                setPreviewData(null);
                setSearchTerm('');
                setError(null);
                handleCancelPreview();
            } else {
                console.error('API Error Response:', result);
                setError(result.message || 'Failed to save vault via API');
            }
        } catch (err: any) {
            console.error('Fetch Error during confirm:', err);
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
        setManualVaultType('POOL');
        setManualProtocol('CHARISMA');
    };

    // Toggle advanced mode
    const handleToggleAdvancedMode = () => {
        setAdvancedMode(!advancedMode);
        if (!advancedMode) {
            // When switching to advanced mode, clear standard inputs
            setPreviewData(null);
            setError(null);
            setSearchTerm('');
        } else {
            // When switching to standard mode, clear JSON input
            setManualJsonInput('');
        }
    };

    // Determine button states
    const canPreview = advancedMode
        ? isValidJson && manualJsonInput.trim() !== ''
        : looksLikeContractId(searchTerm) && !isLoading && !isFetchingManualTokens;

    const canFetchManual = looksLikeContractId(manualTokenAId) && looksLikeContractId(manualTokenBId) && !isLoading && !isFetchingManualTokens;

    // More flexible canConfirm logic based on vault type
    const canConfirm = advancedMode
        ? isValidJson && manualJsonInput.trim() !== ''
        : (() => {
            // Return false if basic preconditions aren't met
            if (!previewData || !previewData.lpToken || isLoading || isFetchingManualTokens) {
                return false;
            }

            // Get vault type to determine tokens requirement
            const vaultType = (manualVaultType || previewData.lpToken.type || 'POOL').toUpperCase();

            // For POOL and SUBLINK, we need both tokens
            if (vaultType === 'POOL' || vaultType === 'SUBLINK') {
                return !previewData.requiresManualInput && previewData.tokenA && previewData.tokenB;
            }

            // For other types (ENERGY, etc.), tokens may be optional
            return true;
        })();

    return (
        <div className="w-full">
            {/* Mode Toggle */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Switch
                        id="advanced-mode"
                        checked={advancedMode}
                        onCheckedChange={handleToggleAdvancedMode}
                    />
                    <Label htmlFor="advanced-mode">Advanced Mode (Direct JSON Editing)</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch
                        id="debug-mode"
                        checked={debugMode}
                        onCheckedChange={() => setDebugMode(!debugMode)}
                    />
                    <Label htmlFor="debug-mode">Debug Mode</Label>
                </div>
            </div>

            {/* Search & Add Section - Apply theme bg/border */}
            <div className="mb-8 bg-card p-6 rounded-lg shadow-lg border border-border">
                {/* Error Message - Use Alert component with destructive variant */}
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {advancedMode ? (
                    /* Advanced Mode: JSON Editor */
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="json-input">Direct Vault JSON</Label>
                            <div className="text-xs text-muted-foreground mb-2">
                                Enter complete vault data in JSON format. Must include a contractId field.
                            </div>
                            <Textarea
                                id="json-input"
                                value={manualJsonInput}
                                onChange={handleJsonInputChange}
                                placeholder='{"contractId": "SP...", "name": "My Vault", "type": "POOL", ...}'
                                className={`font-mono h-64 ${!isValidJson && manualJsonInput.trim() !== '' ? 'border-destructive' : ''}`}
                                disabled={isLoading}
                            />
                            {!isValidJson && manualJsonInput.trim() !== '' && (
                                <p className="text-destructive text-xs mt-1">Invalid JSON format</p>
                            )}
                        </div>
                        <div className="flex justify-end space-x-3">
                            <Button
                                onClick={handlePreview}
                                disabled={!canPreview}
                                variant="outline"
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {isLoading ? 'Processing...' : 'Preview JSON'}
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={!canConfirm || isLoading}
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {isLoading ? 'Saving...' : 'Save Vault Directly'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* Standard Mode: Input + Preview Button */
                    !previewData && (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                type="text"
                                placeholder="Enter vault or token contract ID..."
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
                    )
                )}

                {/* Step 1.5 & 2: Preview Data & Actions (Standard Mode Only) */}
                {!advancedMode && previewData && (
                    <div className="animate-fadeIn space-y-6">
                        <h2 className="text-lg font-semibold text-primary flex items-center">
                            Vault Preview: {manualLpName || previewData.lpToken?.name || '(Name Missing)'} ({manualLpSymbol || previewData.lpToken?.symbol})
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

                        {/* Vault Info & Edit Section */}
                        <div className="mb-6 p-4 bg-muted/30 rounded-md border border-border relative group">
                            <h3 className="font-bold text-md mb-4 text-primary flex items-center">
                                <Edit className="w-4 h-4 mr-2 opacity-50 group-hover:opacity-100 transition-opacity" /> Vault Details (Editable)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label htmlFor="lpName">Name</Label>
                                    <Input
                                        id="lpName" type="text"
                                        value={manualLpName} onChange={(e) => setManualLpName(e.target.value)}
                                        placeholder={previewData.lpToken?.name || "Enter Vault Name"}
                                        disabled={isLoading || isFetchingManualTokens}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="lpSymbol">Symbol</Label>
                                    <Input
                                        id="lpSymbol" type="text"
                                        value={manualLpSymbol} onChange={(e) => setManualLpSymbol(e.target.value)}
                                        placeholder={previewData.lpToken?.symbol || "Enter Symbol (Optional)"}
                                        disabled={isLoading || isFetchingManualTokens}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="lpDecimals">Decimals</Label>
                                    <Input
                                        id="lpDecimals" type="number" min="0" step="1"
                                        value={manualLpDecimals} onChange={(e) => setManualLpDecimals(e.target.value)}
                                        placeholder={previewData.lpToken?.decimals?.toString() || "Enter Decimals (Optional)"}
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
                                        placeholder={previewData.lpToken?.lpRebatePercent?.toString() || "Enter Fee % (Optional)"}
                                        disabled={isLoading || isFetchingManualTokens}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="vaultContract">Vault Contract ID</Label>
                                    <Input id="vaultContract" type="text" value={searchTerm} disabled className="font-mono bg-muted/80" />
                                </div>
                                <div>
                                    <Label htmlFor="vaultType">Vault Type</Label>
                                    <select
                                        id="vaultType"
                                        value={manualVaultType}
                                        onChange={(e) => setManualVaultType(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        disabled={isLoading || isFetchingManualTokens}
                                    >
                                        <option value="POOL">POOL (Liquidity Pool)</option>
                                        <option value="SUBLINK">SUBLINK (Subnet Bridge)</option>
                                        <option value="ENERGY">ENERGY (Hold-to-Earn Rewards)</option>
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="protocol">Protocol</Label>
                                    <Input
                                        id="protocol" type="text"
                                        value={manualProtocol} onChange={(e) => setManualProtocol(e.target.value)}
                                        placeholder="e.g., CHARISMA, ARKADIKO, etc."
                                        disabled={isLoading || isFetchingManualTokens}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="manualExternalId" className="flex items-center gap-1 mb-1">
                                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                        External Pool ID <span className="text-xs text-muted-foreground">(Optional)</span>
                                    </Label>
                                    <Input
                                        id="manualExternalId" type="text"
                                        value={manualExternalPoolId} onChange={(e) => setManualExternalPoolId(e.target.value)}
                                        placeholder={previewData.lpToken?.externalPoolId || "e.g., SP...uniswap-v2-pool"}
                                        disabled={isLoading || isFetchingManualTokens}
                                        className="font-mono"
                                    />
                                </div>
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

                        {/* Action Buttons (Confirm/Cancel - Standard Mode) */}
                        {previewData && !previewData.requiresManualInput && (
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