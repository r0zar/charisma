import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { validateUserBalances } from '@/lib/admin-api';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import SpinValidationDisplay from '@/components/SpinValidationDisplay';
import SpinReadyDisplay from '@/components/SpinReadyDisplay';
import SpinAnimationOverlay from '@/components/SpinAnimationOverlay';
import type { ValidationResults, Token as SpinToken, UserValidation } from '@/types/spin';

interface BalanceValidationPanelProps {
    status: any;
}

export function BalanceValidationPanel({ status }: BalanceValidationPanelProps) {
    const { chaPrice } = useTokenPrices();
    const [validationResults, setValidationResults] = useState<any>(null);
    const [validationLoading, setValidationLoading] = useState(false);
    const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
    const [loadingDisplayNames, setLoadingDisplayNames] = useState(false);
    const [testSpinActive, setTestSpinActive] = useState(false);
    const [testSpinPhase, setTestSpinPhase] = useState<'idle' | 'starting' | 'validating' | 'validation_display' | 'ready' | 'spinning' | 'complete'>('idle');
    const [testValidationResults, setTestValidationResults] = useState<ValidationResults | null>(null);
    const [testFinalData, setTestFinalData] = useState<any>(null);
    const [showTestAnimation, setShowTestAnimation] = useState(false);

    const formatCHA = (atomicAmount: number) => {
        const decimalAmount = atomicAmount / 1_000_000;
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6
        }).format(decimalAmount);
    };

    const formatUSD = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        }).format(amount);
    };

    // Helper function to truncate address for display
    const truncateAddress = (address: string): string => {
        if (!address) return 'Anonymous';
        if (address.length <= 12) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    // Helper to get display name with BNS fallback
    const getDisplayName = (userId: string): string => {
        if (loadingDisplayNames) return 'Loading...';
        return displayNames[userId] || truncateAddress(userId);
    };

    // Load BNS display names when validation results change
    useEffect(() => {
        const loadDisplayNames = async () => {
            if (!validationResults) return;

            const allUserIds = [
                ...(validationResults.validUsers || []).map((user: any) => user.userId),
                ...(validationResults.partialUsers || []).map((user: any) => user.userId),
                ...(validationResults.invalidUsers || []).map((user: any) => user.userId)
            ];

            if (allUserIds.length === 0) return;

            setLoadingDisplayNames(true);
            try {
                // Call server-side API for BNS lookups
                const response = await fetch('/api/admin/bns-names', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ userIds: allUserIds }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const { displayNames } = await response.json();
                setDisplayNames(displayNames);
            } catch (error) {
                console.error('Failed to load display names:', error);
                // Fallback to truncated addresses
                const fallbackNames: Record<string, string> = {};
                allUserIds.forEach(userId => {
                    fallbackNames[userId] = truncateAddress(userId);
                });
                setDisplayNames(fallbackNames);
            } finally {
                setLoadingDisplayNames(false);
            }
        };

        loadDisplayNames();
    }, [validationResults]);

    const handleValidateBalances = async () => {
        setValidationLoading(true);
        try {
            const result = await validateUserBalances();
            if (result.error) {
                toast.error(`Validation failed: ${result.error}`);
                setValidationResults(null);
            } else {
                toast.success('Balance validation completed');
                setValidationResults(result);
            }
        } catch (error) {
            toast.error('Failed to validate balances');
            setValidationResults(null);
        } finally {
            setValidationLoading(false);
        }
    };

    const handleTestSpin = async () => {
        if (!validationResults) {
            toast.error('Please run balance validation first');
            return;
        }

        setTestSpinActive(true);
        setTestSpinPhase('starting');

        try {
            // Phase 1: Starting (1.5s)
            await new Promise(resolve => setTimeout(resolve, 1500));
            setTestSpinPhase('validating');

            // Phase 2: Validation (simulate processing)
            await new Promise(resolve => setTimeout(resolve, 2000));
            setTestSpinPhase('validation_display');

            // Phase 3: Create proper ValidationResults structure
            const mockValidationData: ValidationResults = {
                validUsers: (validationResults.validUsers || []).map((user: any): UserValidation => ({
                    userId: user.userId,
                    hasValidBalance: true,
                    totalCommitted: user.totalVotedCHA,
                    currentBalance: user.totalVotedCHA.toString(),
                    votes: [],
                    balanceShortfall: 0
                })),
                invalidUsers: (validationResults.invalidUsers || []).map((user: any): UserValidation => ({
                    userId: user.userId,
                    hasValidBalance: false,
                    totalCommitted: user.totalVotedCHA,
                    currentBalance: "0",
                    votes: [],
                    balanceShortfall: user.totalVotedCHA
                })),
                validTokenBets: validationResults.validation?.validTokenBets || {},
                totalValidCHA: validationResults.stats?.validCHA || 0,
                totalInvalidCHA: validationResults.stats?.invalidCHA || 0,
                validationTimestamp: Date.now()
            };
            setTestValidationResults(mockValidationData);
        } catch (error) {
            toast.error('Test spin failed');
            console.error('Test spin error:', error);
        }
    };

    const handleStopTestSpin = () => {
        setTestSpinActive(false);
        setTestSpinPhase('idle');
        setTestValidationResults(null);
        setTestFinalData(null);
        setShowTestAnimation(false);
    };

    const handleTestSpinProgress = (phase: string) => {
        switch (phase) {
            case 'ready':
                setTestSpinPhase('ready');
                break;
            case 'spinning':
                setTestSpinPhase('spinning');
                // Simulate spinning for 2 seconds then show animation
                setTimeout(() => {
                    setShowTestAnimation(true);
                }, 2000);
                break;
            case 'complete':
                setTestSpinPhase('complete');
                setShowTestAnimation(false);
                break;
        }
    };

    const mapTokensForComponents = (): SpinToken[] => {
        return status?.tokens?.map((t: any): SpinToken => ({
            id: t.contractId,
            contractId: t.contractId,
            name: t.name,
            symbol: t.symbol,
            imageUrl: t.image || '',
            userBalance: 0,
            decimals: 6,
            type: t.type || 'UNKNOWN'
        })) || [];
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Balance Validation</CardTitle>
                    <CardDescription>
                        Validate user balances against their committed votes. Users can participate with as many complete votes as their balance allows.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button
                                onClick={handleValidateBalances}
                                disabled={validationLoading}
                                className="flex-1"
                            >
                                {validationLoading ? 'Validating...' : 'Run Balance Validation'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setValidationResults(null)}
                                disabled={!validationResults}
                            >
                                Clear Results
                            </Button>
                        </div>

                        {validationLoading && (
                            <div className="border p-4 rounded-md bg-card border-border">
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                    <span className="text-muted-foreground">Validating user balances...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Test Spin Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Test Spin Experience</CardTitle>
                    <CardDescription>
                        Test the complete spin experience using real UI components and real vote data without making any real state changes or broadcasting transactions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button
                                onClick={handleTestSpin}
                                disabled={testSpinActive || !validationResults}
                                className="flex-1"
                            >
                                {testSpinActive ? 'Test Spin Running...' : 'Start Test Spin'}
                            </Button>
                            {testSpinActive && (
                                <Button
                                    variant="outline"
                                    onClick={handleStopTestSpin}
                                >
                                    Stop Test
                                </Button>
                            )}
                        </div>

                        {!validationResults && (
                            <div className="border border-border p-4 rounded-md bg-card">
                                <p className="text-muted-foreground text-sm">
                                    ⚠️ Run balance validation first to enable test spin functionality
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Real UI Component Overlays */}
            {testSpinPhase === 'validation_display' && testValidationResults && (
                <SpinValidationDisplay
                    validationResults={testValidationResults}
                    chaPrice={chaPrice}
                    onContinue={() => handleTestSpinProgress('ready')}
                />
            )}

            {testSpinPhase === 'ready' && testValidationResults && (
                <SpinReadyDisplay
                    validationResults={testValidationResults}
                    tokens={mapTokensForComponents()}
                    chaPrice={chaPrice}
                    onStartSpin={() => handleTestSpinProgress('spinning')}
                />
            )}

            {showTestAnimation && testValidationResults && (
                <SpinAnimationOverlay
                    winningTokenId={Object.keys(testValidationResults.validTokenBets)[0] || ''}
                    tokenBets={testValidationResults.validTokenBets}
                    tokenList={mapTokensForComponents()}
                    onAnimationComplete={() => handleTestSpinProgress('complete')}
                    spinScheduledAt={Date.now()}
                />
            )}

            {/* Validation Results Display */}
            {validationResults && (
                <Card>
                    <CardHeader>
                        <CardTitle>Validation Results</CardTitle>
                        <CardDescription>
                            Latest balance validation results - {new Date(validationResults.timestamp).toLocaleString()}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="border border-border p-4 rounded-md bg-card">
                                    <h3 className="font-semibold text-success">All Votes Valid</h3>
                                    <p className="text-2xl font-bold text-success">
                                        {validationResults.validUsers?.length || 0}
                                    </p>
                                    <p className="text-sm text-muted-foreground">users</p>
                                </div>

                                <div className="border border-border p-4 rounded-md bg-card">
                                    <h3 className="font-semibold text-warning">Some Votes Valid</h3>
                                    <p className="text-2xl font-bold text-warning">
                                        {validationResults.partialUsers?.length || 0}
                                    </p>
                                    <p className="text-sm text-muted-foreground">users</p>
                                </div>

                                <div className="border border-border p-4 rounded-md bg-card">
                                    <h3 className="font-semibold text-destructive">No Votes Valid</h3>
                                    <p className="text-2xl font-bold text-destructive">
                                        {validationResults.invalidUsers?.length || 0}
                                    </p>
                                    <p className="text-sm text-muted-foreground">users</p>
                                </div>

                                <div className="border border-border p-4 rounded-md bg-card">
                                    <h3 className="font-semibold text-primary">Total Valid CHA</h3>
                                    <p className="text-2xl font-bold text-primary numeric">
                                        {formatCHA(validationResults.stats?.validCHA || 0)}
                                    </p>
                                    <p className="text-sm text-muted-foreground numeric">
                                        {formatUSD(validationResults.stats?.validUSD || 0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
} 