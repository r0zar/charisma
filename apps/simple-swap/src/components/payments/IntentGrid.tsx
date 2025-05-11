"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { IntentRecord } from "@/app/fiat/page"; // Assuming IntentRecord is exported from fiat/page.tsx

interface IntentGridProps {
    intents: IntentRecord[] | null;
    processingPid: string | null;
    onManualProcess: (pid: string) => void;
}

export function IntentGrid({ intents, processingPid, onManualProcess }: IntentGridProps) {
    if (intents === null) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-40 rounded-2xl" />
                ))}
            </div>
        );
    }

    if (intents.length === 0) {
        return (
            <p className="text-muted-foreground text-center text-sm">
                No intents found.
            </p>
        );
    }

    return (
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
                        <div className="mt-4 space-y-2">
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
                                onClick={() => onManualProcess(intent.pid)}
                                disabled={processingPid === intent.pid}
                            >
                                {processingPid === intent.pid ? "Processing..." : "Process Manually"}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
} 