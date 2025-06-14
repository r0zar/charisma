"use client"

import React, { useState, useEffect } from "react";
import { useWallet } from "../contexts/wallet-context";

interface WalletButtonProps {
    className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
    const { connected, address, isConnecting, connectWallet, disconnectWallet } = useWallet();

    return (
        <div className={`flex items-center ${className || ''}`}>
            {!connected ? (
                <button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    className="cursor-pointer w-fit h-9 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center min-w-[140px]"
                >
                    {isConnecting ? (
                        <>
                            <span className="mr-2 flex items-center justify-center"><span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></span></span>
                            <span className="truncate">Connecting...</span>
                        </>
                    ) : (
                        "Connect Wallet"
                    )}
                </button>
            ) : (
                <button
                    onClick={disconnectWallet}
                    className="cursor-pointer h-9 px-4 py-2 text-sm font-medium rounded-md bg-muted hover:bg-muted/80 transition-colors"
                >
                    {address
                        ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
                        : "Connected"}
                </button>
            )}
        </div>
    );
} 