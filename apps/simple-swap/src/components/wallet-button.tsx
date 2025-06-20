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
                    className="relative cursor-pointer h-9 px-5 py-2 text-sm font-medium rounded-xl bg-white/[0.08] border border-white/[0.15] text-white/90 hover:bg-white/[0.12] hover:border-white/[0.25] hover:text-white disabled:opacity-50 transition-all duration-200 flex items-center justify-center min-w-[140px] backdrop-blur-sm overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] to-transparent pointer-events-none" />
                    {isConnecting ? (
                        <>
                            <span className="mr-2 flex items-center justify-center">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white/80"></span>
                            </span>
                            <span className="truncate relative z-10">Connecting...</span>
                        </>
                    ) : (
                        <span className="relative z-10">Connect Wallet</span>
                    )}
                </button>
            ) : (
                <button
                    onClick={disconnectWallet}
                    className="relative cursor-pointer h-9 px-4 py-2 text-sm font-medium rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/80 hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white transition-all duration-200 backdrop-blur-sm overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/[0.01] to-transparent pointer-events-none" />
                    <span className="relative z-10 font-mono">
                        {address
                            ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
                            : "Connected"}
                    </span>
                </button>
            )}
        </div>
    );
} 