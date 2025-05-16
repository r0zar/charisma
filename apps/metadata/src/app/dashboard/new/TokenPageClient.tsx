"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context/app-context";
import { Layers } from "lucide-react";

// props let us avoid useSearchParams altogether
export default function TokenPageClient({
    initialTokenId, // This prop is maintained for interface consistency but not used for ID generation
}: {
    initialTokenId: string;
}) {
    const { authenticated, stxAddress } = useApp();
    const router = useRouter();

    useEffect(() => {
        if (authenticated && stxAddress) {
            const generatedTokenId = `md-${Date.now().toString().slice(0, 6)}`;
            const newContractId = `${stxAddress}.${generatedTokenId}`;
            // Proceed to token detail page with the full contract ID
            router.push(`/dashboard/${encodeURIComponent(newContractId.trim())}`);
        }
    }, [authenticated, stxAddress, router]);

    if (!authenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center py-12 bg-gradient-to-b from-background to-muted/20 rounded-xl">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Layers className="w-10 h-10 text-primary/60" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Connect your wallet</h2>
                <p className="text-muted-foreground max-w-md">
                    Please connect your wallet to create new metadata
                </p>
            </div>
        );
    }

    // If authenticated, show a loading message while redirecting
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center py-12">
            <Layers className="w-12 h-12 text-primary animate-pulse mb-6" />
            <h2 className="text-xl font-semibold mb-2">Preparing Your Metadata</h2>
            <p className="text-muted-foreground max-w-md">
                Generating a unique token identifier and redirecting you to the next step...
            </p>
        </div>
    );
} 