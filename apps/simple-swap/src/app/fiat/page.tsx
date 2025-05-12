"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllIntents } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { manuallyProcessBlazeIntentAction } from "@/app/actions";
import { Header } from "@/components/header";
import TokenPurchaseForm from "@/components/payments/token-purchase-form";
import { IntentGrid } from "@/components/payments/IntentGrid";
import { isDevelopment } from "@/lib/utils";
import {
    FlameIcon,
    ExternalLinkIcon,
    ShieldCheckIcon,
    ClockIcon,
    ArrowRightIcon,
    CreditCardIcon,
    CheckCircleIcon,
    ArrowRightCircleIcon
} from "lucide-react";
import Link from "next/link";

interface BlazeSignedIntent {
    intent: {
        contract: string;
        intent: string;
        opcode: string | null;
        amount: number;
        target: string;
        uuid: string;
    };
    sig: string;
    pubKey: string;
    hash: string;
}

export interface IntentRecord {
    pid: string;
    userId: string;
    tokenAmount: string;
    tokenType: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: number;
    blaze: BlazeSignedIntent;
}

export default function TokenPurchaseDashboard() {
    const [intents, setIntents] = useState<IntentRecord[] | null>(null);
    const [processingPid, setProcessingPid] = useState<string | null>(null);

    useEffect(() => {
        getAllIntents().then(setIntents);
    }, []);

    const handleManualProcess = async (pid: string) => {
        setProcessingPid(pid);
        try {
            const result = await manuallyProcessBlazeIntentAction(pid);
            if (result) {
                setIntents(currentIntents =>
                    currentIntents?.map(intent =>
                        intent.pid === pid ? { ...intent, status: result.status, ...(result.error && { error: result.error }) } : intent
                    ) || null
                );
                console.log(`Processing result for ${pid}:`, result);
            } else {
                console.error(`No result from manual processing for ${pid}`);
            }
        } catch (error) {
            console.error(`Error manually processing intent ${pid}:`, error);
        } finally {
            setProcessingPid(null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/10">
            <Header />

            {/* Hero section */}
            <div className="w-full py-12 border-b border-primary/10"
                style={{ background: "linear-gradient(to bottom right, hsl(222 47% 11%), hsl(222 47% 8%))" }}
            >
                <div className="container">
                    <div className="text-center mb-8 animate-[appear_0.5s_ease-out]">
                        <Badge variant="outline" className="bg-primary/10 text-primary px-4 py-1.5 mb-6 text-sm font-medium">
                            <ShieldCheckIcon className="w-4 h-4 mr-2" />
                            Fast & Secure Token Purchases
                        </Badge>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-balance">
                            Buy <span className="text-primary">SIP10</span> Tokens
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                            Direct delivery to your wallet on the Blaze subnet
                        </p>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="container safe-area my-12">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Purchase form - takes more space */}
                    <div className="lg:col-span-3">
                        <TokenPurchaseForm />
                    </div>

                    {/* Information sidebar */}
                    <div className="lg:col-span-2">
                        <div className="glass-card bg-card h-full">
                            <div className="p-6 lg:p-8">

                                <div className="space-y-6">
                                    <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                                        <h4 className="text-sm font-medium text-primary mb-2">INSTANT DELIVERY</h4>
                                        <p className="text-sm">
                                            Your tokens will be automatically credited to your connected wallet address within seconds of completing your purchase.
                                        </p>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-medium mb-3 text-primary">USING YOUR TOKENS</h4>
                                        <ul className="text-sm space-y-3">
                                            <li className="flex items-start p-3 rounded-lg bg-card/50 border border-border/50">
                                                <ArrowRightCircleIcon className="w-5 h-5 mr-3 flex-shrink-0 text-primary" />
                                                <span>Tokens can be swapped for any other token on the <Link href="https://swap.charisma.rocks/swap" className="text-primary">Charisma DEX</Link></span>
                                            </li>
                                            <li className="flex items-start p-3 rounded-lg bg-card/50 border border-border/50">
                                                <ArrowRightCircleIcon className="w-5 h-5 mr-3 flex-shrink-0 text-primary" />
                                                <span>To view your subnet balances, click the <FlameIcon className="inline-block w-4 h-4 text-primary mx-1" /> icon on the Swap page with the CHA token selected</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="pt-2">
                                        <Button variant="link" asChild className="w-full">
                                            <Link href={`https://explorer.hiro.so/txid/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1?chain=mainnet`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
                                                <span>View Charisma Subnet Explorer</span>
                                                <ExternalLinkIcon className="w-4 h-4 ml-2" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin section - only visible in development */}
            {isDevelopment && (
                <div className="container pb-12 mb-12">
                    <div className="glass-card border-dashed border-primary/30">
                        <div className="p-6">
                            <h3 className="text-xl font-medium mb-6 flex items-center">
                                <Badge variant="outline" className="mr-3 bg-secondary/10 text-secondary">DEV</Badge>
                                Transaction Records
                            </h3>
                            <IntentGrid
                                intents={intents}
                                processingPid={processingPid}
                                onManualProcess={handleManualProcess}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Footer with trust indicators */}
            <footer className="fixed bottom-0 left-0 right-0 border-t border-border/40 bg-card py-8">
                <div className="container">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center">
                                <ShieldCheckIcon className="w-5 h-5 text-primary mr-2" />
                                <span className="text-sm">Secure Transactions</span>
                            </div>
                            <div className="flex items-center">
                                <ClockIcon className="w-5 h-5 text-primary mr-2" />
                                <span className="text-sm">Instant Delivery</span>
                            </div>
                            <div className="flex items-center">
                                <CheckCircleIcon className="w-5 h-5 text-primary mr-2" />
                                <span className="text-sm">Based Platform</span>
                            </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            © 2025 Charisma Subnet. All rights reserved.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}