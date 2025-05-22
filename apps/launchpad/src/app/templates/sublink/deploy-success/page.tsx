"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, ExternalLink, ArrowLeft, Globe, Settings } from "lucide-react"; // Using Globe as a relevant icon for sublinks
import Link from "next/link";

// This could be an environment variable if the sublink management page is on a different domain/app
const SUBLINK_MANAGEMENT_BASE_URL = process.env.NEXT_PUBLIC_SUBLINK_MGMT_URL || "/sublinks"; // Assuming /sublinks is where users might manage them, adjust if needed

function SublinkDeploySuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const txid = searchParams.get("txid");
    const contractName = searchParams.get("contractName"); // e.g., mytoken-sublink
    const contractIdentifier = searchParams.get("contractIdentifier"); // e.g., STXADDRESS.mytoken-sublink
    const sourceTokenContractId = searchParams.get("sourceTokenContractId");
    const subnetTokenContractId = searchParams.get("subnetTokenContractId");

    const explorerBaseUrl = "https://explorer.hiro.so/txid/";

    return (
        <div className="container py-12 flex justify-center items-center min-h-[calc(100vh-200px)]">
            <Card className="w-full max-w-2xl shadow-xl">
                <CardHeader className="text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4 border-2 border-green-200">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <CardTitle className="text-3xl font-bold">Sublink Deployed!</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground">
                        Your Sublink contract has been successfully submitted to the network.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-8 py-10">
                    {contractName && (
                        <div className="text-center">
                            <h2 className="text-xl font-semibold text-primary">{contractName}</h2>
                        </div>
                    )}

                    {contractIdentifier && (
                        <div className="bg-muted/50 p-4 rounded-lg text-center">
                            <p className="text-sm text-muted-foreground mb-1">Contract Identifier</p>
                            <p className="font-mono text-sm break-all">{contractIdentifier}</p>
                        </div>
                    )}

                    {sourceTokenContractId && (
                        <div className="bg-muted/50 p-4 rounded-lg text-center">
                            <p className="text-sm text-muted-foreground mb-1">Source Token</p>
                            <p className="font-mono text-sm break-all">{sourceTokenContractId}</p>
                        </div>
                    )}

                    {subnetTokenContractId && (
                        <div className="bg-muted/50 p-4 rounded-lg text-center">
                            <p className="text-sm text-muted-foreground mb-1">Subnet Token</p>
                            <p className="font-mono text-sm break-all">{subnetTokenContractId}</p>
                        </div>
                    )}

                    {txid && (
                        <div className="text-center space-y-3">
                            <div className="bg-muted/50 p-4 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Transaction ID</p>
                                <p className="font-mono text-sm break-all">{txid}</p>
                            </div>
                            <Button variant="outline" asChild className="w-full max-w-md mx-auto">
                                <Link href={`${explorerBaseUrl}${txid}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    View Transaction on Explorer
                                </Link>
                            </Button>
                        </div>
                    )}

                    <hr className="my-8 border-border" />

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button variant="outline" onClick={() => router.push("/templates")} className="flex-1">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Templates
                        </Button>
                        {/* Optional: Link to a page where users can manage/view their sublinks, if such a page exists */}
                        {/* For now, this just goes back to the sublink creation wizard */}
                        <Button onClick={() => router.push("/templates/sublink")} className="flex-1">
                            <Globe className="mr-2 h-4 w-4" />
                            Deploy Another Sublink
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center pt-4">
                        Note: It may take a few minutes for the transaction to confirm.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

export default function SublinkDeploySuccessPage() {
    return (
        // Using a generic loader, as the Loader2 component from LP success page might not be here
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><div>Loading...</div></div>}>
            <SublinkDeploySuccessContent />
        </Suspense>
    );
} 