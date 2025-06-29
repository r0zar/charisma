import React from 'react';
import { ListPlus, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';

// Define a simple loading fallback component
function ListingLoadingFallback() {
    return (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading listing tool...
        </div>
    );
}

export default function ListingPage() {
    return (
        <main className="container py-8">
            <div className="flex items-center gap-3 mb-2">
                <ListPlus className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Manage Vault Listings</h1>
            </div>
            <p className="text-muted-foreground mb-6 max-w-3xl">
                Use this tool to preview and add new vaults to the Charisma Invest directory.
                This includes liquidity pools (LP tokens), subnet bridges, and other vault types.
            </p>

            <Alert className="mb-6 border-blue-500/30 bg-blue-500/5">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <AlertTitle className="text-blue-500">Vault Type Information</AlertTitle>
                <AlertDescription className="text-blue-500/90 text-sm">
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li><strong>POOL</strong> - Standard liquidity pools with two tokens (e.g., STX/USDA)</li>
                        <li><strong>SUBLINK</strong> - Subnet bridge vaults that connect mainnet assets to subnet networks</li>
                        <li><strong>ENERGY</strong> - Reward vaults that give users energy for holding tokens</li>
                    </ul>
                </AlertDescription>
            </Alert>


        </main>
    );
}