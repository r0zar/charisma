"use client";

import React, { useState, useCallback } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle, Loader2, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { getTokenMetadata } from '@/app/actions';
import { debounce } from 'lodash';
import { signedFetch } from 'blaze-sdk';

interface AddNewPoolDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

interface LookupState {
    isLoading: boolean;
    isSuccess: boolean;
    isError: boolean;
    error?: string;
}

export default function AddNewPoolDialog({ isOpen, onOpenChange }: AddNewPoolDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [contractId, setContractId] = useState('');
    const [vaultType, setVaultType] = useState('POOL');
    const [protocol, setProtocol] = useState('CHARISMA');
    const [externalPoolId, setExternalPoolId] = useState('');

    // LP Token fields
    const [lpName, setLpName] = useState('');
    const [lpSymbol, setLpSymbol] = useState('');
    const [lpDecimals, setLpDecimals] = useState('6');
    const [lpDescription, setLpDescription] = useState('');
    const [lpImage, setLpImage] = useState('');
    const [feePercent, setFeePercent] = useState('3.00');

    // Token A fields
    const [tokenAContract, setTokenAContract] = useState('');
    const [tokenAName, setTokenAName] = useState('');
    const [tokenASymbol, setTokenASymbol] = useState('');
    const [tokenADecimals, setTokenADecimals] = useState('6');
    const [tokenAImage, setTokenAImage] = useState('');

    // Token B fields
    const [tokenBContract, setTokenBContract] = useState('');
    const [tokenBName, setTokenBName] = useState('');
    const [tokenBSymbol, setTokenBSymbol] = useState('');
    const [tokenBDecimals, setTokenBDecimals] = useState('6');
    const [tokenBImage, setTokenBImage] = useState('');

    // Lookup states
    const [lpLookupState, setLpLookupState] = useState<LookupState>({ isLoading: false, isSuccess: false, isError: false });
    const [tokenALookupState, setTokenALookupState] = useState<LookupState>({ isLoading: false, isSuccess: false, isError: false });
    const [tokenBLookupState, setTokenBLookupState] = useState<LookupState>({ isLoading: false, isSuccess: false, isError: false });

    const resetForm = () => {
        setContractId('');
        setVaultType('POOL');
        setProtocol('CHARISMA');
        setExternalPoolId('');
        setLpName('');
        setLpSymbol('');
        setLpDecimals('6');
        setLpDescription('');
        setLpImage('');
        setFeePercent('3.00');
        setTokenAContract('');
        setTokenAName('');
        setTokenASymbol('');
        setTokenADecimals('6');
        setTokenAImage('');
        setTokenBContract('');
        setTokenBName('');
        setTokenBSymbol('');
        setTokenBDecimals('6');
        setTokenBImage('');
        setError(null);
        setLpLookupState({ isLoading: false, isSuccess: false, isError: false });
        setTokenALookupState({ isLoading: false, isSuccess: false, isError: false });
        setTokenBLookupState({ isLoading: false, isSuccess: false, isError: false });
    };

    // Debounced lookup function factory
    const createDebouncedLookup = useCallback((
        contractSetter: (value: string) => void,
        nameSetter: (value: string) => void,
        symbolSetter: (value: string) => void,
        decimalsSetter: (value: string) => void,
        imageSetter: (value: string) => void,
        stateSetter: (state: LookupState) => void
    ) => {
        return debounce(async (contractId: string) => {
            if (!contractId || (!contractId.includes('.') && contractId !== '.stx')) {
                stateSetter({ isLoading: false, isSuccess: false, isError: false });
                return;
            }

            stateSetter({ isLoading: true, isSuccess: false, isError: false });

            try {
                const result = await getTokenMetadata(contractId);

                if (result.success && result.data) {
                    nameSetter(result.data.name || '');
                    symbolSetter(result.data.symbol || '');
                    decimalsSetter(String(result.data.decimals || 6));
                    imageSetter(result.data.image || '');
                    stateSetter({ isLoading: false, isSuccess: true, isError: false });
                } else {
                    stateSetter({
                        isLoading: false,
                        isSuccess: false,
                        isError: true,
                        error: result.error || 'Metadata not found'
                    });
                }
            } catch (err) {
                console.error('Metadata lookup error:', err);
                stateSetter({
                    isLoading: false,
                    isSuccess: false,
                    isError: true,
                    error: 'Failed to fetch metadata'
                });
            }
        }, 1000);
    }, []);

    // Create debounced lookup functions
    const debouncedLpLookup = useCallback(
        createDebouncedLookup(
            setContractId, setLpName, setLpSymbol, setLpDecimals, setLpImage, setLpLookupState
        ), [createDebouncedLookup]
    );

    const debouncedTokenALookup = useCallback(
        createDebouncedLookup(
            setTokenAContract, setTokenAName, setTokenASymbol, setTokenADecimals, setTokenAImage, setTokenALookupState
        ), [createDebouncedLookup]
    );

    const debouncedTokenBLookup = useCallback(
        createDebouncedLookup(
            setTokenBContract, setTokenBName, setTokenBSymbol, setTokenBDecimals, setTokenBImage, setTokenBLookupState
        ), [createDebouncedLookup]
    );

    // Handle contract ID changes with metadata lookup
    const handleLpContractChange = (value: string) => {
        setContractId(value);
        debouncedLpLookup(value);
    };

    const handleTokenAContractChange = (value: string) => {
        setTokenAContract(value);
        debouncedTokenALookup(value);
    };

    const handleTokenBContractChange = (value: string) => {
        setTokenBContract(value);
        debouncedTokenBLookup(value);
    };

    // Status indicator component
    const StatusIndicator = ({ state }: { state: LookupState }) => {
        if (state.isLoading) {
            return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
        }
        if (state.isSuccess) {
            return <CheckCircle className="w-4 h-4 text-green-500" />;
        }
        if (state.isError) {
            return <X className="w-4 h-4 text-red-500" />;
        }
        return null;
    };

    const handleSubmit = async () => {
        setError(null);

        // Basic validation
        if (!contractId.includes('.')) {
            setError('Contract ID must be in format: address.contract-name');
            return;
        }

        if (!lpName || !lpSymbol) {
            setError('LP Token name and symbol are required');
            return;
        }

        if (vaultType === 'POOL' && (!tokenAContract || !tokenBContract || !tokenAName || !tokenBName)) {
            setError('For POOL type, both Token A and Token B information is required');
            return;
        }

        setIsSubmitting(true);

        try {
            // Prepare the request body
            const requestBody = {
                lpToken: {
                    contractId,
                    name: lpName,
                    symbol: lpSymbol,
                    decimals: parseInt(lpDecimals),
                    identifier: lpSymbol,
                    description: lpDescription,
                    image: lpImage,
                    lpRebatePercent: parseFloat(feePercent),
                    type: vaultType,
                    protocol: protocol,
                    externalPoolId: externalPoolId || undefined
                },
                tokenA: tokenAContract ? {
                    contractId: tokenAContract,
                    name: tokenAName,
                    symbol: tokenASymbol,
                    decimals: parseInt(tokenADecimals),
                    identifier: tokenASymbol,
                    image: tokenAImage
                } : undefined,
                tokenB: tokenBContract ? {
                    contractId: tokenBContract,
                    name: tokenBName,
                    symbol: tokenBSymbol,
                    decimals: parseInt(tokenBDecimals),
                    identifier: tokenBSymbol,
                    image: tokenBImage
                } : undefined
            };

            console.log('Sending request to:', `/api/v1/admin/vaults/${contractId}/confirm`);
            console.log('Request body:', requestBody);

            // Call the confirm API endpoint
            const response = await signedFetch(`/api/v1/admin/vaults/${contractId}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                message: 'dex-cache-admin-access'
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            // Check if response has content before trying to parse as JSON
            const contentType = response.headers.get('content-type');
            const responseText = await response.text();

            console.log('Response text:', responseText);
            console.log('Content-Type:', contentType);

            let result;
            if (contentType && contentType.includes('application/json') && responseText.trim()) {
                try {
                    result = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('JSON parse error:', parseError);
                    setError(`Invalid JSON response: ${responseText.substring(0, 200)}`);
                    return;
                }
            } else {
                // Handle non-JSON responses
                result = {
                    status: response.ok ? 'success' : 'error',
                    message: responseText || `HTTP ${response.status}: ${response.statusText}`
                };
            }

            if (response.ok && (result.status === 'success' || result.success)) {
                toast.success('Pool added successfully!', {
                    description: `${lpName} (${lpSymbol}) has been added to the DEX cache.`
                });
                resetForm();
                onOpenChange(false);
                // Reload the page to show the new pool
                window.location.reload();
            } else {
                const errorMessage = result.message || result.error || responseText || `HTTP ${response.status}: ${response.statusText}`;
                setError(errorMessage);
            }
        } catch (err) {
            console.error('Error adding pool:', err);
            setError(`Failed to add pool: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            onOpenChange(open);
            if (!open) resetForm();
        }}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Existing Pool to DEX Cache</DialogTitle>
                    <DialogDescription className="pt-2">
                        Add an already deployed liquidity pool contract to the DEX cache system for tracking and management.
                        Contract metadata will be automatically populated when you enter valid contract IDs.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Basic Pool Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">Pool Contract Information</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contractId">Contract ID *</Label>
                                <div className="relative">
                                    <Input
                                        id="contractId"
                                        value={contractId}
                                        onChange={(e) => handleLpContractChange(e.target.value)}
                                        placeholder="SP000000000000000000.pool-contract"
                                        className="font-mono text-sm pr-10"
                                    />
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        <StatusIndicator state={lpLookupState} />
                                    </div>
                                </div>
                                {lpLookupState.isError && (
                                    <p className="text-xs text-red-500">{lpLookupState.error}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="vaultType">Pool Type</Label>
                                <Select value={vaultType} onValueChange={setVaultType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="POOL">POOL</SelectItem>
                                        <SelectItem value="SUBLINK">SUBLINK</SelectItem>
                                        <SelectItem value="VAULT">VAULT</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="protocol">Protocol</Label>
                                <Select value={protocol} onValueChange={setProtocol}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CHARISMA">CHARISMA</SelectItem>
                                        <SelectItem value="BITFLOW">BITFLOW</SelectItem>
                                        <SelectItem value="VELAR">VELAR</SelectItem>
                                        <SelectItem value="ALEX">ALEX</SelectItem>
                                        <SelectItem value="OTHER">OTHER</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="feePercent">Fee Percentage</Label>
                                <Input
                                    id="feePercent"
                                    type="number"
                                    step="0.01"
                                    value={feePercent}
                                    onChange={(e) => setFeePercent(e.target.value)}
                                    placeholder="3.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="externalPoolId">External Pool ID</Label>
                                <Input
                                    id="externalPoolId"
                                    value={externalPoolId}
                                    onChange={(e) => setExternalPoolId(e.target.value)}
                                    placeholder="pool-123"
                                />
                            </div>
                        </div>
                    </div>

                    {/* LP Token Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">LP Token Information</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="lpName">LP Token Name *</Label>
                                <Input
                                    id="lpName"
                                    value={lpName}
                                    onChange={(e) => setLpName(e.target.value)}
                                    placeholder="Token A-Token B LP"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lpSymbol">LP Token Symbol *</Label>
                                <Input
                                    id="lpSymbol"
                                    value={lpSymbol}
                                    onChange={(e) => setLpSymbol(e.target.value)}
                                    placeholder="TOKENA-TOKENB-LP"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="lpDecimals">LP Token Decimals</Label>
                                <Input
                                    id="lpDecimals"
                                    type="number"
                                    value={lpDecimals}
                                    onChange={(e) => setLpDecimals(e.target.value)}
                                    placeholder="6"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lpImage">LP Token Image URL</Label>
                                <Input
                                    id="lpImage"
                                    value={lpImage}
                                    onChange={(e) => setLpImage(e.target.value)}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="lpDescription">LP Token Description</Label>
                            <Textarea
                                id="lpDescription"
                                value={lpDescription}
                                onChange={(e) => setLpDescription(e.target.value)}
                                placeholder="Description of the liquidity pool..."
                                rows={2}
                            />
                        </div>
                    </div>

                    {/* Token A Info */}
                    {(vaultType === 'POOL' || vaultType === 'SUBLINK') && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium">Token A Information</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tokenAContract">Token A Contract *</Label>
                                    <div className="relative">
                                        <Input
                                            id="tokenAContract"
                                            value={tokenAContract}
                                            onChange={(e) => handleTokenAContractChange(e.target.value)}
                                            placeholder="SP000000000000000000.token-a"
                                            className="font-mono text-sm pr-10"
                                        />
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            <StatusIndicator state={tokenALookupState} />
                                        </div>
                                    </div>
                                    {tokenALookupState.isError && (
                                        <p className="text-xs text-red-500">{tokenALookupState.error}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tokenAName">Token A Name *</Label>
                                    <Input
                                        id="tokenAName"
                                        value={tokenAName}
                                        onChange={(e) => setTokenAName(e.target.value)}
                                        placeholder="Token A"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tokenASymbol">Token A Symbol *</Label>
                                    <Input
                                        id="tokenASymbol"
                                        value={tokenASymbol}
                                        onChange={(e) => setTokenASymbol(e.target.value)}
                                        placeholder="TOKENA"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tokenADecimals">Token A Decimals</Label>
                                    <Input
                                        id="tokenADecimals"
                                        type="number"
                                        value={tokenADecimals}
                                        onChange={(e) => setTokenADecimals(e.target.value)}
                                        placeholder="6"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tokenAImage">Token A Image</Label>
                                    <Input
                                        id="tokenAImage"
                                        value={tokenAImage}
                                        onChange={(e) => setTokenAImage(e.target.value)}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Token B Info */}
                    {(vaultType === 'POOL' || vaultType === 'SUBLINK') && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium">Token B Information</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tokenBContract">Token B Contract *</Label>
                                    <div className="relative">
                                        <Input
                                            id="tokenBContract"
                                            value={tokenBContract}
                                            onChange={(e) => handleTokenBContractChange(e.target.value)}
                                            placeholder="SP000000000000000000.token-b"
                                            className="font-mono text-sm pr-10"
                                        />
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            <StatusIndicator state={tokenBLookupState} />
                                        </div>
                                    </div>
                                    {tokenBLookupState.isError && (
                                        <p className="text-xs text-red-500">{tokenBLookupState.error}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tokenBName">Token B Name *</Label>
                                    <Input
                                        id="tokenBName"
                                        value={tokenBName}
                                        onChange={(e) => setTokenBName(e.target.value)}
                                        placeholder="Token B"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tokenBSymbol">Token B Symbol *</Label>
                                    <Input
                                        id="tokenBSymbol"
                                        value={tokenBSymbol}
                                        onChange={(e) => setTokenBSymbol(e.target.value)}
                                        placeholder="TOKENB"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tokenBDecimals">Token B Decimals</Label>
                                    <Input
                                        id="tokenBDecimals"
                                        type="number"
                                        value={tokenBDecimals}
                                        onChange={(e) => setTokenBDecimals(e.target.value)}
                                        placeholder="6"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tokenBImage">Token B Image</Label>
                                    <Input
                                        id="tokenBImage"
                                        value={tokenBImage}
                                        onChange={(e) => setTokenBImage(e.target.value)}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-4">
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isSubmitting}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Adding Pool...
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Pool
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 