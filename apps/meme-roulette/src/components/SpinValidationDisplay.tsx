import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Users, DollarSign, AlertTriangle } from 'lucide-react';
import type { ValidationResults } from '@/types/spin';
import TokenAmountDisplay from '@/components/TokenAmountDisplay';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface SpinValidationDisplayProps {
    validationResults: ValidationResults;
    chaPrice?: number;
    onContinue?: () => void;
}

const CHA_DECIMALS = 6;

export default function SpinValidationDisplay({
    validationResults,
    chaPrice,
    onContinue
}: SpinValidationDisplayProps) {
    const { validUsers, invalidUsers, totalValidCHA, totalInvalidCHA } = validationResults;
    const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
    const [loadingDisplayNames, setLoadingDisplayNames] = useState(false);

    const totalUsers = validUsers.length + invalidUsers.length;
    const validUserPercentage = totalUsers > 0 ? (validUsers.length / totalUsers) * 100 : 0;

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
            const allUserIds = [
                ...validUsers.map(user => user.userId),
                ...invalidUsers.map(user => user.userId)
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
    }, [validUsers, invalidUsers]);

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-[60] p-4">
            <div className="bg-card/95 backdrop-blur-lg border border-border rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold font-display mb-2 text-primary">
                        🔍 Validating User Balances
                    </h2>
                    <p className="text-muted-foreground">
                        Checking that all users have sufficient CHA tokens for their votes
                    </p>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-muted/20 border border-border rounded-lg p-4 text-center">
                        <Users className="h-5 w-5 text-primary mx-auto mb-2" />
                        <div className="text-2xl font-bold text-foreground">{totalUsers}</div>
                        <div className="text-xs text-muted-foreground">Total Users</div>
                    </div>

                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-green-400">{validUsers.length}</div>
                        <div className="text-xs text-muted-foreground">Valid Users</div>
                    </div>

                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                        <XCircle className="h-5 w-5 text-red-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-red-400">{invalidUsers.length}</div>
                        <div className="text-xs text-muted-foreground">Invalid Users</div>
                    </div>

                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                        <DollarSign className="h-5 w-5 text-primary mx-auto mb-2" />
                        <div className="text-lg font-bold text-primary">
                            {validUserPercentage.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Valid Rate</div>
                    </div>
                </div>

                {/* CHA Amount Summary */}
                <div className="bg-muted/20 border border-border rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        CHA Amount Breakdown
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="text-center">
                            <div className="text-green-400 text-2xl font-bold mb-1">
                                <TokenAmountDisplay
                                    amount={totalValidCHA}
                                    decimals={CHA_DECIMALS}
                                    symbol="CHA"
                                    usdPrice={chaPrice}
                                    className="text-green-400"
                                    size="lg"
                                    showUsd={true}
                                />
                            </div>
                            <div className="text-sm text-muted-foreground">Valid CHA (will be processed)</div>
                        </div>

                        <div className="text-center">
                            <div className="text-red-400 text-2xl font-bold mb-1">
                                <TokenAmountDisplay
                                    amount={totalInvalidCHA}
                                    decimals={CHA_DECIMALS}
                                    symbol="CHA"
                                    usdPrice={chaPrice}
                                    className="text-red-400"
                                    size="lg"
                                    showUsd={true}
                                />
                            </div>
                            <div className="text-sm text-muted-foreground">Invalid CHA (excluded)</div>
                        </div>
                    </div>
                </div>

                {/* User Lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Valid Users */}
                    <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-3 text-green-400 flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" />
                            Valid Users ({validUsers.length})
                        </h3>
                        <ScrollArea className="h-32">
                            <div className="space-y-2">
                                {validUsers.map((user, index) => (
                                    <div key={index} className="bg-green-500/10 border border-green-500/20 rounded p-2">
                                        <div className="flex justify-between items-start text-xs">
                                            <div className="text-green-400 truncate flex-1 mr-2">
                                                <div className="font-semibold">
                                                    {getDisplayName(user.userId)}
                                                </div>
                                                {displayNames[user.userId] && displayNames[user.userId] !== truncateAddress(user.userId) && (
                                                    <div className="font-mono text-xs text-green-400/70">
                                                        {truncateAddress(user.userId)}
                                                    </div>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs">
                                                ✓ Valid
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            <TokenAmountDisplay
                                                amount={user.totalCommitted}
                                                decimals={CHA_DECIMALS}
                                                symbol="CHA"
                                                className="text-green-400"
                                                size="sm"
                                            />
                                        </div>
                                    </div>
                                ))}
                                {validUsers.length === 0 && (
                                    <div className="text-center text-muted-foreground text-sm py-4">
                                        No valid users
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Invalid Users */}
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-3 text-red-400 flex items-center gap-2">
                            <XCircle className="h-5 w-5" />
                            Invalid Users ({invalidUsers.length})
                        </h3>
                        <ScrollArea className="h-32">
                            <div className="space-y-2">
                                {invalidUsers.map((user, index) => (
                                    <div key={index} className="bg-red-500/10 border border-red-500/20 rounded p-2">
                                        <div className="flex justify-between items-start text-xs">
                                            <div className="text-red-400 truncate flex-1 mr-2">
                                                <div className="font-semibold">
                                                    {getDisplayName(user.userId)}
                                                </div>
                                                {displayNames[user.userId] && displayNames[user.userId] !== truncateAddress(user.userId) && (
                                                    <div className="font-mono text-xs text-red-400/70">
                                                        {truncateAddress(user.userId)}
                                                    </div>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">
                                                ✗ Invalid
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Committed: <TokenAmountDisplay
                                                amount={user.totalCommitted}
                                                decimals={CHA_DECIMALS}
                                                symbol="CHA"
                                                className="text-red-400"
                                                size="sm"
                                            />
                                        </div>
                                        {user.balanceShortfall && user.balanceShortfall > 0 && (
                                            <div className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" />
                                                Short: <TokenAmountDisplay
                                                    amount={user.balanceShortfall}
                                                    decimals={CHA_DECIMALS}
                                                    symbol="CHA"
                                                    size="sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {invalidUsers.length === 0 && (
                                    <div className="text-center text-muted-foreground text-sm py-4">
                                        All users have valid balances! 🎉
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center">
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
                        <p className="text-sm text-muted-foreground">
                            ✅ Validation complete! Only votes from users with sufficient balances will count.
                        </p>
                    </div>

                    {onContinue && (
                        <button
                            onClick={onContinue}
                            className="button-primary px-6 py-3"
                        >
                            Continue to Spin
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
} 