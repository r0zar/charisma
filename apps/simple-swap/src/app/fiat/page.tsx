"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllIntents } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { manuallyProcessBlazeIntentAction } from "@/app/actions";
import StripePaymentForm from "@/components/payments/stripe";
import { Header } from "@/components/header";

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

export default function AdminDashboard() {
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
        <>
            <Header />
            <div className="container py-10">
                <h1 className="text-3xl font-bold mb-6 text-balance">Fiat On-Ramp</h1>
                <ScrollArea className="h-[80vh] rounded-2xl border bg-muted p-6 shadow-inner">
                    <Card className="glass-card mb-6">
                        <CardContent className="p-6 space-y-4 pt-6">
                            <h2 className="text-lg font-semibold">Buy 1 CHA for $1 (Stripe Test)</h2>
                            <StripePaymentForm />
                        </CardContent>
                    </Card>
                    {intents ? (
                        intents.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                {intents.map((intent) => (
                                    <Card key={intent.pid} className="glass-card">
                                        <CardContent className="p-5 pt-5 space-y-5 text-sm">
                                            {/* Stripe Section */}
                                            <div className="space-y-2">
                                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Stripe Payment
                                                </h3>
                                                <div>
                                                    <span className="text-muted-foreground text-xs">User:</span>
                                                    <div className="font-mono break-all text-sm">{intent.userId}</div>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <div>
                                                        <span className="text-muted-foreground text-xs">Token:</span>
                                                        <div className="font-semibold">
                                                            {intent.tokenAmount} {intent.tokenType}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground text-xs">Fiat:</span>
                                                        <div>
                                                            ${(intent.amount / 100).toFixed(2)} {intent.currency?.toUpperCase()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(intent.createdAt).toLocaleString()}
                                                </div>
                                            </div>

                                            {/* Divider */}
                                            <div className="h-px bg-border my-1" />

                                            {/* Blaze Intent Section */}
                                            <div className="space-y-2">
                                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Blaze Intent
                                                </h3>
                                                <div className="text-xs">
                                                    <span className="text-muted-foreground">Contract:</span>{" "}
                                                    <span className="font-mono break-all">{intent.blaze.intent.contract}</span>
                                                </div>
                                                <div className="text-xs">
                                                    <span className="text-muted-foreground">Action:</span>{" "}
                                                    {intent.blaze.intent.intent} → {intent.blaze.intent.amount}{' '}
                                                    <span className="font-mono">{intent.blaze.intent.target}</span>
                                                </div>
                                                <div className="text-xs break-all">
                                                    <span className="text-muted-foreground">UUID:</span>{" "}
                                                    <span className="font-mono">{intent.blaze.intent.uuid}</span>
                                                </div>
                                                <div className="text-xs break-all">
                                                    <span className="text-muted-foreground">Hash:</span>{" "}
                                                    <code>{intent.blaze.hash}</code>
                                                </div>
                                                <div className="text-xs break-all">
                                                    <span className="text-muted-foreground">PubKey:</span>{" "}
                                                    <code className="opacity-80">{intent.blaze.pubKey}</code>
                                                </div>
                                                <div className="text-xs break-all">
                                                    <span className="text-muted-foreground">Sig:</span>{" "}
                                                    <code className="opacity-70">{intent.blaze.sig.slice(0, 20)}…</code>
                                                </div>
                                            </div>

                                            {/* Footer */}
                                            <div className="flex justify-between items-center pt-2">
                                                <Badge
                                                    variant={
                                                        intent.status === "queued"
                                                            ? "default"
                                                            : intent.status === "processed"
                                                                ? "secondary"
                                                                : intent.status === "processing_manual"
                                                                    ? "default"
                                                                    : "outline"
                                                    }
                                                >
                                                    {intent.status}
                                                </Badge>
                                                <div className="text-xs text-muted-foreground">
                                                    PID: <span className="font-mono">{intent.pid}</span>
                                                </div>
                                            </div>
                                            {/* Manual Process Button */}
                                            {(intent.status === "queued" || intent.status === "failed" || intent.status === "error") && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full mt-3"
                                                    onClick={() => handleManualProcess(intent.pid)}
                                                    disabled={processingPid === intent.pid}
                                                >
                                                    {processingPid === intent.pid ? "Processing..." : "Process Manually"}
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>

                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center text-sm">
                                No queued intents found.
                            </p>
                        )
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                            {[...Array(6)].map((_, i) => (
                                <Skeleton key={i} className="h-40 rounded-2xl" />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </>
    );
}
