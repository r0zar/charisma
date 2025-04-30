"use client"

import * as React from 'react';
import { useApp } from '@/lib/context/app-context';
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";

interface WalletConnectorProps extends React.HTMLAttributes<HTMLDivElement> { }

export function WalletConnector({ className, ...props }: WalletConnectorProps) {
    const { walletState, connectWallet, disconnectWallet } = useApp();

    const truncateAddress = (address: string) => {
        if (!address) return "";
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    return (
        <div className={cn("flex items-center", className)} {...props}>
            {walletState.connected ? (
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
                        {truncateAddress(walletState.address)}
                    </span>
                    <Button variant="outline" size="sm" onClick={disconnectWallet}>
                        Disconnect
                    </Button>
                </div>
            ) : (
                <Button size="sm" onClick={connectWallet}>
                    Connect Wallet
                </Button>
            )}
        </div>
    );
} 