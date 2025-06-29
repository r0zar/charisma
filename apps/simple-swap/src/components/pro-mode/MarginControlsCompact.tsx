"use client";

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
    Wallet,
    Plus,
    Minus,
    RotateCcw,
    AlertTriangle,
    HelpCircle
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useTradingState } from '../../hooks/useTradingState';
import { usePerpetualPositions } from '../../hooks/usePerps';
import MarginDepositWithdrawDialog from './MarginDepositWithdrawDialog';

export default function MarginControlsCompact() {
    const {
        marginAccount,
        openPositions,
        isLoading,
        fetchTradingData,
        resetMarginAccount,
        getLiquidationRisk,
        formatBalance,
        syncPnL,
        depositMargin,
        withdrawMargin
    } = useTradingState();

    // Get detailed perpetual positions for accurate breakdown
    const { positions: apiPerpetualPositions = [] } = usePerpetualPositions();

    // Use margin account state as source of truth - if margin is used, we have active positions
    // This ensures the UI reflects what the margin account actually knows about
    const hasActivePositions = marginAccount ? marginAccount.usedMargin > 0 : false;
    const openPositionCount = openPositions.length;

    const [depositDialogOpen, setDepositDialogOpen] = useState(false);
    const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);

    // Skeleton loading state that matches the full layout
    if (!marginAccount) {
        return (
            <>
                <Card className="p-3 h-fit">
                    {/* Header - Keep static elements, skeleton dynamic ones */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <Wallet className="w-4 h-4 text-muted-foreground" />
                            <h3 className="font-semibold text-sm">Margin Account</h3>
                        </div>
                        <div className="flex items-center space-x-1">
                            {/* Position badge will appear here when data loads */}
                        </div>
                    </div>

                    {/* Account Balance Grid - Keep labels, skeleton values */}
                    <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                        <div>
                            <div className="text-muted-foreground">Equity</div>
                            <div className="h-4 w-16 bg-muted/50 rounded animate-pulse mt-0.5"></div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Available</div>
                            <div className="h-4 w-16 bg-muted/50 rounded animate-pulse mt-0.5"></div>
                        </div>
                    </div>

                    {/* Margin Utilization - Keep structure, skeleton values */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-1">
                                <span className="text-xs text-muted-foreground">Used:</span>
                                <div className="h-3 w-12 bg-muted/50 rounded animate-pulse"></div>
                            </div>
                            <div className="h-3 w-8 bg-muted/50 rounded animate-pulse"></div>
                        </div>
                        {/* Skeleton progress bar */}
                        <div className="h-1.5 bg-muted/30 rounded overflow-hidden">
                            <div className="h-full w-0 bg-muted/50 animate-pulse"></div>
                        </div>
                    </div>

                    {/* Risk Level - Keep structure, skeleton content */}
                    <div className="rounded p-2 mb-3 bg-muted/10 border border-muted/20">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                                <span className="text-xs text-muted-foreground">Risk:</span>
                                <div className="h-3 w-8 bg-muted/50 rounded animate-pulse"></div>
                            </div>
                            <HelpCircle className="w-3 h-3 text-muted-foreground/50" />
                        </div>
                    </div>

                    {/* Quick Actions - Keep buttons, disable them */}
                    <div className="grid grid-cols-3 gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="text-xs h-7 opacity-50"
                        >
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="text-xs h-7 opacity-50"
                        >
                            <Minus className="w-3 h-3 mr-1" />
                            Take
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="text-xs h-7 opacity-50"
                        >
                            <RotateCcw className="w-3 h-3" />
                        </Button>
                    </div>

                    {/* Skeleton P&L section (might appear based on position data) */}
                    <div className="mt-3 pt-2 border-t border-border/40 opacity-50">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Unrealized P&L:</span>
                            <div className="h-3 w-16 bg-muted/50 rounded animate-pulse"></div>
                        </div>
                    </div>
                </Card>

                {/* Don't show dialogs during loading */}
            </>
        );
    }

    const liquidationRisk = getLiquidationRisk();
    const marginCallLevel = marginAccount ? marginAccount.marginRatio > 50 : false;

    // Calculate margin breakdown for segmented progress bar
    const openPositionsMargin = apiPerpetualPositions
        .filter(p => p.status === 'open')
        .reduce((sum, p) => sum + parseFloat(p.marginRequired || '0'), 0);

    const pendingPositionsMargin = apiPerpetualPositions
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + parseFloat(p.marginRequired || '0'), 0);

    // Calculate percentages for the segmented bar
    const totalEquity = marginAccount ? marginAccount.accountEquity : 1;
    const openMarginPercent = (openPositionsMargin / totalEquity) * 100;
    const pendingMarginPercent = (pendingPositionsMargin / totalEquity) * 100;

    // Risk colors based on margin ratio
    const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
        switch (risk) {
            case 'high': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            default: return 'text-green-500 bg-green-500/10 border-green-500/20';
        }
    };

    return (
        <>
            <Card className="p-3 h-fit">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">Margin Account</h3>
                    </div>
                    <div className="flex items-center space-x-1">
                        {/* Position breakdown with three colors */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {/* Only show position breakdown if there are any positions */}
                                {apiPerpetualPositions.length > 0 && (
                                    <Badge variant="outline" className="text-xs cursor-pointer" onClick={syncPnL}>
                                        <span className="text-green-400">{apiPerpetualPositions.filter(p => p.status === 'open' && p.direction === 'long').length}L</span>
                                        <span className="text-muted-foreground mx-0.5">/</span>
                                        <span className="text-red-400">{apiPerpetualPositions.filter(p => p.status === 'open' && p.direction === 'short').length}S</span>
                                        <span className="text-muted-foreground mx-0.5">/</span>
                                        <span className="text-yellow-400">{apiPerpetualPositions.filter(p => p.status === 'pending').length}P</span>
                                    </Badge>
                                )}
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="text-xs">
                                    Position Breakdown:<br />
                                    🟢 {apiPerpetualPositions.filter(p => p.status === 'open' && p.direction === 'long').length} Long (Active)<br />
                                    🔴 {apiPerpetualPositions.filter(p => p.status === 'open' && p.direction === 'short').length} Short (Active)<br />
                                    🟡 {apiPerpetualPositions.filter(p => p.status === 'pending').length} Pending<br />
                                    <br />Click to sync P&L
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* Account Balance - Compact Grid */}
                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                    <div>
                        <div className="text-muted-foreground">Equity</div>
                        <div className="font-medium">{formatBalance(marginAccount.accountEquity)}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Available</div>
                        <div className="font-medium text-green-600">{formatBalance(marginAccount.freeMargin)}</div>
                    </div>
                </div>

                {/* Margin Utilization - Segmented Progress Bar */}
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Used: {formatBalance(marginAccount.usedMargin)}</span>
                        <span className="text-xs font-medium">{marginAccount.marginRatio.toFixed(1)}%</span>
                    </div>
                    {/* Custom segmented progress bar */}
                    <div className="h-1.5 bg-muted/30 rounded overflow-hidden flex">
                        {/* Open positions portion - color based on risk level */}
                        {openMarginPercent > 0 && (
                            <div
                                className={`h-full ${marginAccount.marginRatio > 80 ? 'bg-red-500' :
                                    marginAccount.marginRatio > 50 ? 'bg-orange-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(openMarginPercent, 100)}%` }}
                                title={`Open positions: ${formatBalance(openPositionsMargin)}`}
                            />
                        )}
                        {/* Pending positions portion - yellow */}
                        {pendingMarginPercent > 0 && (
                            <div
                                className="h-full bg-yellow-400"
                                style={{ width: `${Math.min(pendingMarginPercent, 100 - openMarginPercent)}%` }}
                                title={`Pending positions: ${formatBalance(pendingPositionsMargin)}`}
                            />
                        )}
                        {/* Remaining space is automatically handled by the parent container */}
                    </div>
                    {marginCallLevel && (
                        <div className="flex items-center mt-1">
                            <AlertTriangle className="w-3 h-3 text-yellow-500 mr-1" />
                            <span className="text-xs text-yellow-600 dark:text-yellow-400">Margin Call</span>
                        </div>
                    )}
                </div>

                {/* Risk Level - Compact */}
                <div className={`rounded p-2 mb-3 ${getRiskColor(liquidationRisk)}`}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                            Risk: {liquidationRisk.toUpperCase()}
                        </span>
                        <Tooltip>
                            <TooltipTrigger>
                                <HelpCircle className="w-3 h-3" />
                            </TooltipTrigger>
                            <TooltipContent side="top" align="end">
                                <p className="max-w-xs text-xs">
                                    <strong>Low:</strong> &lt;50% margin used<br />
                                    <strong>Medium:</strong> 50-80% margin used<br />
                                    <strong>High:</strong> &gt;80% margin used
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* Quick Actions - Horizontal Layout */}
                <div className="grid grid-cols-3 gap-1.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDepositDialogOpen(true)}
                        className="text-xs h-7"
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWithdrawDialogOpen(true)}
                        disabled={marginAccount.freeMargin <= 0}
                        className="text-xs h-7"
                    >
                        <Minus className="w-3 h-3 mr-1" />
                        Take
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={resetMarginAccount}
                        className="text-xs h-7"
                    >
                        <RotateCcw className="w-3 h-3" />
                    </Button>
                </div>

                {/* P&L Display if margin account has active positions */}
                {hasActivePositions && marginAccount && (
                    <div className="mt-3 pt-2 border-t border-border/40">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Unrealized P&L:</span>
                            <span className={`font-medium ${marginAccount.unrealizedPnL > 0 ? 'text-green-500' :
                                marginAccount.unrealizedPnL < 0 ? 'text-red-500' : ''
                                }`}>
                                {marginAccount.unrealizedPnL >= 0 ? '+' : ''}{formatBalance(marginAccount.unrealizedPnL)}
                            </span>
                        </div>
                    </div>
                )}
            </Card>

            {/* Deposit/Withdraw Dialogs - Only render when open and data is ready */}
            {depositDialogOpen && marginAccount && (
                <MarginDepositWithdrawDialog
                    type="deposit"
                    open={depositDialogOpen}
                    onOpenChange={setDepositDialogOpen}
                    marginAccount={marginAccount}
                    depositMargin={depositMargin}
                    withdrawMargin={withdrawMargin}
                    formatBalance={formatBalance}
                />
            )}
            {withdrawDialogOpen && marginAccount && (
                <MarginDepositWithdrawDialog
                    type="withdraw"
                    open={withdrawDialogOpen}
                    onOpenChange={setWithdrawDialogOpen}
                    marginAccount={marginAccount}
                    depositMargin={depositMargin}
                    withdrawMargin={withdrawMargin}
                    formatBalance={formatBalance}
                />
            )}
        </>
    );
} 