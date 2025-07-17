'use client';

import React, { Suspense } from 'react';
import { WalletProvider } from '@/contexts/wallet-context';
import { TokenPriceProvider } from '@/contexts/token-price-context';
import { WalletBalanceProvider } from '@/contexts/wallet-balance-context';
import { TokenMetadataProvider } from '@/contexts/token-metadata-context';

interface ClientProvidersProps {
    children: React.ReactNode;
}

// Global loading component for provider initialization
function GlobalLoadingSpinner() {
    const funnyMessages = [
        "teaching hamsters to run faster...",
        "convincing the blockchain to cooperate...",
        "downloading more RAM...",
        "asking ChatGPT what to do next...",
        "untangling spaghetti code...",
        "bribing the smart contracts...",
        "waiting for coffee to kick in...",
        "debugging in production (again)...",
        "spinning up the flux capacitor...",
        "consulting the oracle (not the database)...",
        "reticulating splines...",
        "initializing the chaos engine...",
        "warming up the quantum tunnel...",
        "feeding data to the machine learning hamsters...",
        "convincing zeros to become ones...",
        "assembling the infinity stones...",
        "calibrating the flux inhibitor...",
        "loading loading screen...",
        "teaching AI to love...",
        "reversing the polarity...",
        "invoking the ancient protocols...",
        "summoning the code demons...",
        "bribing the server goblins...",
        "untangling the tubes of the internet...",
        "asking Siri for directions...",
        "calculating the meaning of life (it's 42)...",
        "convincing Murphy's Law to take a break...",
        "assembling the Avengers of APIs...",
        "teaching rocks to think...",
        "optimizing for maximum chaos...",
        "loading pixels one by one...",
        "consulting the rubber duck...",
        "charging the laser beams...",
        "initializing the thought processor...",
        "asking the magic 8-ball...",
        "teaching elephants to dance...",
        "reversing the reverse polarity...",
        "calibrating the reality distortion field...",
        "loading the matrix...",
        "asking Alexa what loading means...",
        "teaching monkeys Shakespeare...",
        "initializing the holodeck...",
        "consulting the ancient scrolls of Stack Overflow...",
        "convincing the cloud to rain data...",
        "teaching quantum particles to behave...",
        "asking the universe for permission...",
        "loading the loading of the loader...",
        "initializing the blockchain consensus meeting...",
        "teaching smart contracts to be smarter...",
        "waiting for the stars to align..."
    ];

    const randomMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];

    return (
        <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="h-6 w-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                <div className="text-center">
                    <div className="text-white/90 font-light">{randomMessage}</div>
                </div>
            </div>
        </div>
    );
}

function TokenAwareProviders({ children }: { children: React.ReactNode }) {
    return (
        <TokenPriceProvider>
            <TokenMetadataProvider>
                <WalletBalanceProvider>
                    {children}
                </WalletBalanceProvider>
            </TokenMetadataProvider>
        </TokenPriceProvider>
    );
}

export function ClientProviders({ children }: ClientProvidersProps) {
    return (
        <Suspense fallback={<GlobalLoadingSpinner />}>
            <WalletProvider>
                <TokenAwareProviders>
                    {children}
                </TokenAwareProviders>
            </WalletProvider>
        </Suspense>
    );
}