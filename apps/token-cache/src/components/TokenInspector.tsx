'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic'; // Import dynamic
import { inspectTokenData, forceRefreshToken } from '@/app/actions';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Search, RefreshCw, Database, Server } from 'lucide-react';
import { toast } from "sonner";

// Dynamically import ReactJson with SSR disabled
const ReactJson = dynamic(() => import('react-json-view'), {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground p-4">Loading JSON viewer...</p>
});

// Helper: detect contract id
const looksLikeContractId = (id: string) => id.includes('.') && id.length > 10;

interface InspectionResult {
    contractId: string;
    rawMetadata?: any | null;
    cachedData?: any | null;
    fetchError?: string | null;
    cacheError?: string | null;
}

export default function TokenInspector() {
    const [contractId, setContractId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [inspectionResult, setInspectionResult] = useState<InspectionResult | null>(null);
    const [lastInspectedId, setLastInspectedId] = useState<string | null>(null);

    const handleInspect = async () => {
        if (!looksLikeContractId(contractId)) {
            toast.error('Invalid Contract ID format');
            return;
        }
        setIsLoading(true);
        setInspectionResult(null); // Clear previous results
        setLastInspectedId(contractId);
        try {
            const result = await inspectTokenData(contractId);
            setInspectionResult(result);
        } catch (err: any) {
            toast.error("Inspection failed", { description: err.message || 'Unknown error' });
            setInspectionResult({ contractId, fetchError: err.message }); // Show error within results
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        if (!lastInspectedId) return;
        setIsRefreshing(true);
        try {
            const result = await forceRefreshToken(lastInspectedId);
            if (result.success) {
                toast.success("Cache refreshed successfully!");
                // Re-inspect to show the updated cached data
                const reInspectResult = await inspectTokenData(lastInspectedId);
                setInspectionResult(reInspectResult);
            } else {
                toast.error("Cache refresh failed", { description: result.error });
            }
        } catch (err: any) {
            toast.error("Cache refresh failed", { description: err.message || 'Unknown error' });
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="w-full space-y-6">
            {/* Input and Inspect Button */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5 text-primary" />
                        Inspect Token Cache
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-3">
                    <Input
                        type="text"
                        placeholder="Enter Token Contract ID (e.g., SP...contract.token)"
                        value={contractId}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContractId(e.target.value)}
                        disabled={isLoading || isRefreshing}
                        className="flex-grow"
                    />
                    <Button
                        onClick={handleInspect}
                        disabled={!looksLikeContractId(contractId) || isLoading || isRefreshing}
                        className="flex-shrink-0"
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        {isLoading ? 'Inspecting...' : 'Inspect'}
                    </Button>
                </CardContent>
            </Card>

            {/* Results Section */}
            {inspectionResult && (
                <div className="space-y-4 animate-fadeIn">
                    <h2 className="text-xl font-semibold border-b pb-2">Inspection Results for: <code className='text-primary bg-muted px-1 rounded-sm'>{inspectionResult.contractId}</code></h2>

                    {/* Action Button (Refresh Cache) */}
                    <div className="text-right">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isRefreshing || isLoading || !lastInspectedId}
                        >
                            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {isRefreshing ? 'Refreshing Cache...' : 'Force Refresh Cache'}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Raw Fetched Data Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-blue-500">
                                    <Server className="w-5 h-5" />
                                    Raw Data (Direct Fetch)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {inspectionResult.fetchError ? (
                                    <Alert variant="destructive">
                                        <AlertTitle>Fetch Error</AlertTitle>
                                        <AlertDescription>{inspectionResult.fetchError}</AlertDescription>
                                    </Alert>
                                ) : (
                                    <ReactJson
                                        src={inspectionResult.rawMetadata || { message: "No raw data found or fetch failed." }}
                                        theme="ocean" // Or your preferred theme
                                        iconStyle="square"
                                        displayObjectSize={false}
                                        displayDataTypes={false}
                                        enableClipboard={false}
                                        style={{ padding: '1rem', borderRadius: '0.5rem', background: 'hsl(var(--muted))' }}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {/* Cached Data Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-green-500">
                                    <Database className="w-5 h-5" />
                                    Cached Data (Vercel KV)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {inspectionResult.cacheError ? (
                                    <Alert variant="destructive">
                                        <AlertTitle>Cache Error</AlertTitle>
                                        <AlertDescription>{inspectionResult.cacheError}</AlertDescription>
                                    </Alert>
                                ) : (
                                    <ReactJson
                                        src={inspectionResult.cachedData || { message: "No cached data found." }}
                                        theme="ocean"
                                        iconStyle="square"
                                        displayObjectSize={false}
                                        displayDataTypes={false}
                                        enableClipboard={false}
                                        style={{ padding: '1rem', borderRadius: '0.5rem', background: 'hsl(var(--muted))' }}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
} 