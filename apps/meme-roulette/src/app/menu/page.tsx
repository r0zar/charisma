'use client';

import React from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { DepositCharismaButton } from '@/components/DepositCharismaButton';
import { SwapStxToChaButton } from '@/components/SwapStxToChaButton';
import { Button } from '@/components/ui/button';
import { Plus, ArrowUpDown, Wallet, User, LogOut, Settings } from 'lucide-react';

// Helper to format balance (assuming 6 decimals by default)
const formatBalance = (balance: string, decimals: number = 6) => {
    try {
        const num = BigInt(balance);
        const divisor = BigInt(10 ** decimals);
        const integerPart = num / divisor;
        const fractionalPart = num % divisor;

        if (fractionalPart === 0n) {
            return integerPart.toLocaleString();
        } else {
            const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
            return `${integerPart.toLocaleString()}.${fractionalStr}`;
        }
    } catch {
        return '0';
    }
};

// Helper to truncate Stacks address
const truncateAddress = (address: string, length = 8) => {
    if (!address) return "";
    if (address.length <= length * 2 + 3) return address;
    return `${address.substring(0, length)}...${address.substring(address.length - length)}`;
};

export default function MenuPage() {
    const {
        connected,
        address,
        mainnetBalance,
        subnetBalance,
        balanceLoading,
        subnetBalanceLoading,
        connectWallet,
        disconnectWallet,
        isConnecting
    } = useWallet();

    if (!connected) {
        return (
            <div className="w-full max-w-none sm:max-w-2xl mx-auto py-0 sm:py-12">
                {/* Connect Wallet Section */}
                <div className="bg-background/50 md:glass-card px-4 py-8 md:p-8 border-b border-border/20 md:border md:rounded-xl text-center">
                    <div className="mb-6">
                        <Wallet className="h-16 w-16 mx-auto text-primary/30 mb-4" />
                        <h1 className="text-2xl sm:text-3xl font-bold mb-4 font-display">Connect Your Wallet</h1>
                        <p className="text-muted-foreground mb-6">
                            Connect your Stacks wallet to start voting and pumping tokens
                        </p>
                    </div>

                    <Button
                        onClick={connectWallet}
                        disabled={isConnecting}
                        className="button-primary text-lg px-8 py-4"
                        size="lg"
                    >
                        <Wallet className="h-5 w-5" />
                        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                    </Button>
                </div>

                {/* Information Section */}
                <div className="bg-background/30 md:glass-card px-4 py-6 md:p-8 md:border md:rounded-xl">
                    <h2 className="text-xl font-semibold mb-4 font-display">What You Can Do</h2>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <Plus className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-medium">Deposit CHA</h3>
                                <p className="text-sm text-muted-foreground">Move CHA from mainnet to subnet for voting</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <ArrowUpDown className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-medium">Buy CHA</h3>
                                <p className="text-sm text-muted-foreground">Swap STX for CHA tokens</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Settings className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-medium">Manage Account</h3>
                                <p className="text-sm text-muted-foreground">View balances and transaction history</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-none sm:max-w-2xl mx-auto py-0 sm:py-12">
            {/* Account Overview Section */}
            <div className="bg-background/50 md:glass-card px-4 py-6 md:p-8 border-b border-border/20 md:border md:rounded-xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold font-display">Your Account</h1>
                        <p className="text-sm text-muted-foreground font-mono truncate">
                            {truncateAddress(address, 10)}
                        </p>
                    </div>
                </div>

                {/* Balance Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-muted/20 p-4 rounded-lg border border-border/20">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                            <span className="text-sm font-medium text-muted-foreground">Mainnet CHA</span>
                        </div>
                        <p className="text-lg font-bold font-mono text-primary">
                            {balanceLoading ? '...' : formatBalance(mainnetBalance)}
                        </p>
                        <p className="text-xs text-muted-foreground">Available to deposit</p>
                    </div>

                    <div className="bg-muted/20 p-4 rounded-lg border border-border/20">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium text-muted-foreground">Subnet CHA</span>
                        </div>
                        <p className="text-lg font-bold font-mono text-primary">
                            {subnetBalanceLoading ? '...' : formatBalance(subnetBalance)}
                        </p>
                        <p className="text-xs text-muted-foreground">Ready to vote</p>
                    </div>
                </div>
            </div>

            {/* Actions Section */}
            <div className="bg-background/30 md:glass-card px-4 py-6 md:p-8 border-b border-border/20 md:border md:rounded-xl">
                <h2 className="text-lg font-semibold mb-4 font-display">Manage CHA</h2>
                <div className="space-y-3">
                    <DepositCharismaButton
                        size="lg"
                        className="w-full justify-start gap-3 h-14"
                        variant="outline"
                    >
                        <Plus className="h-5 w-5" />
                        <div className="text-left">
                            <div className="font-medium">Deposit CHA to Subnet</div>
                            <div className="text-xs text-muted-foreground">Move CHA from mainnet for voting</div>
                        </div>
                    </DepositCharismaButton>

                    <SwapStxToChaButton
                        size="lg"
                        buttonLabel="Buy CHA with STX"
                        className="w-full justify-start gap-3 h-14"
                        variant="outline"
                    >
                        <ArrowUpDown className="h-5 w-5" />
                    </SwapStxToChaButton>
                </div>
            </div>

            {/* Account Actions Section */}
            <div className="bg-background/20 md:glass-card px-4 py-6 md:p-8 md:border md:rounded-xl">
                <h2 className="text-lg font-semibold mb-4 font-display">Account</h2>
                <div className="space-y-3">
                    <div className="bg-muted/20 p-4 rounded-lg border border-border/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-medium">Wallet Address</h3>
                                <p className="text-sm text-muted-foreground font-mono">{truncateAddress(address, 12)}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(address)}
                                className="text-xs"
                            >
                                Copy
                            </Button>
                        </div>
                    </div>

                    <Button
                        onClick={disconnectWallet}
                        variant="ghost"
                        className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive h-12"
                        size="lg"
                    >
                        <LogOut className="h-4 w-4" />
                        Disconnect Wallet
                    </Button>
                </div>
            </div>
        </div>
    );
} 