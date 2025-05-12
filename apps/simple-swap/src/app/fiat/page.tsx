"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllIntents } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { manuallyProcessBlazeIntentAction } from "@/app/actions";
import { Header } from "@/components/header";
import TokenPurchaseForm from "@/components/payments/token-purchase-form";
import { IntentGrid } from "@/components/payments/IntentGrid";

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
            <div className="max-w-2xl mx-auto py-10">
                <TokenPurchaseForm />
            </div>
            <div className="max-w-[2100px] mx-auto py-10">

                <IntentGrid intents={intents} processingPid={processingPid} onManualProcess={handleManualProcess} />
            </div>
        </>
    );
}
