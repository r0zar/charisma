"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, ExternalLink, ArrowLeft, Droplets } from "lucide-react";
// import { ઉત્પાદનLines } from "@/components/ui/misc"; // Assuming this is a custom component for underlines/dividers - REMOVED
import Link from "next/link";

const INVEST_APP_BASE_URL = process.env.NEXT_PUBLIC_INVEST_APP_URL || "https://invest.charisma.rocks";

function LiquidityPoolDeploySuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const txid = searchParams.get("txid");
    const poolName = searchParams.get("poolName");
    const contractIdentifier = searchParams.get("contractIdentifier"); // Full contract ID like STXADDRESS.contract-name

    // Basic Explorer URL, can be made dynamic based on network if needed
    const explorerBaseUrl = "https://explorer.hiro.so/txid/";

    return (
        <div className="container py-12 flex justify-center items-center min-h-[calc(100vh-200px)]">
            <Card className="w-full max-w-2xl shadow-xl">
                <CardHeader className="text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4 border-2 border-green-200">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <CardTitle className="text-3xl font-bold">Deployment Submitted!</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground">
                        Your liquidity pool contract has been successfully submitted to the network.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-8 py-10">
                    {poolName && (
                        <div className="text-center">
                            <h2 className="text-xl font-semibold text-primary">{poolName}</h2>
                        </div>
                    )}

                    {contractIdentifier && (
                        <div className="bg-muted/50 p-4 rounded-lg text-center">
                            <p className="text-sm text-muted-foreground mb-1">Contract Identifier</p>
                            <p className="font-mono text-sm break-all">{contractIdentifier}</p>
                        </div>
                    )}

                    {txid && (
                        <div className="text-center space-y-8">
                            <div className="bg-muted/50 p-4 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Transaction ID</p>
                                <p className="font-mono text-sm break-all">{txid}</p>
                            </div>
                            <Button
                                variant="outline"
                                asChild
                                className="w-full max-w-md mx-auto"
                            >
                                <Link href={`${explorerBaseUrl}${txid}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    View Transaction on Explorer
                                </Link>
                            </Button>
                        </div>
                    )}

                    <hr className="my-8 border-border" />

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button
                            variant="outline"
                            onClick={() => router.push("/templates/liquidity-pool")}
                            className="flex-1"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Deploy Another Pool
                        </Button>
                        {contractIdentifier && (
                            <Button
                                variant="default"
                                asChild
                                className="flex-1"
                            >
                                <Link href={`${INVEST_APP_BASE_URL}/vaults/${contractIdentifier}`} target="_blank" rel="noopener noreferrer">
                                    <Droplets className="mr-2 h-4 w-4" />
                                    Manage Pool / Add Liquidity
                                </Link>
                            </Button>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground text-center pt-4">
                        Note: It may take a few minutes for the transaction to confirm and the pool to be fully usable.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

export default function LiquidityPoolDeploySuccessPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <LiquidityPoolDeploySuccessContent />
        </Suspense>
    );
}

// Adding a simple Loader2 component for the Suspense fallback
const Loader2 = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
); 