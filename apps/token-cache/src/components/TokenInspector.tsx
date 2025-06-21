'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic'; // Import dynamic
import { inspectTokenData, forceRefreshToken, updateCachedTokenData } from '@/app/actions';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Search, RefreshCw, Database, Server, Save, Edit } from 'lucide-react';
import { toast } from "sonner";

// Dynamically import ReactJson with SSR disabled
const ReactJson = dynamic(() => import('react-json-view'), {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground p-4">Loading JSON viewer...</p>
});

// Helper: detect contract id
const looksLikeContractId = (id: string) => id.includes('.') && id.length > 3;

interface InspectionResult {
    contractId: string;
    rawMetadata?: any | null;
    cachedData?: any | null;
    fetchError?: string | null;
    cacheError?: string | null;
}

interface TokenInspectorProps {
    initialContractId?: string;
}

export default function TokenInspector({ initialContractId }: TokenInspectorProps) {
    const [contractId, setContractId] = useState(initialContractId || '');
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [inspectionResult, setInspectionResult] = useState<InspectionResult | null>(null);
    const [lastInspectedId, setLastInspectedId] = useState<string | null>(null);
    const [editedCachedData, setEditedCachedData] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (inspectionResult?.cachedData) {
            setEditedCachedData(inspectionResult.cachedData);
            setIsEditing(false);
        } else {
            setEditedCachedData(null);
            setIsEditing(false);
        }
    }, [inspectionResult]);

    const handleCacheEdit = useCallback((edit: any) => {
        setEditedCachedData(edit.updated_src);
        if (!isEditing) setIsEditing(true);
        return true;
    }, [isEditing]);

    const handleSaveChanges = async () => {
        if (!lastInspectedId || !editedCachedData || !isEditing) return;

        setIsSaving(true);
        try {
            const result = await updateCachedTokenData(lastInspectedId, editedCachedData);
            if (result.success) {
                toast.success("Cache updated successfully!");
                setIsEditing(false);
                setInspectionResult(prev => prev ? { ...prev, cachedData: editedCachedData } : null);
            } else {
                toast.error("Failed to save changes", { description: result.error });
            }
        } catch (err: any) {
            toast.error("Failed to save changes", { description: err.message || 'Unknown error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleInspect = useCallback(async (idToInspect?: string) => {
        const targetId = idToInspect || contractId;
        if (!looksLikeContractId(targetId)) {
            if (idToInspect) { // Only show toast if it's an explicit call with bad ID
                toast.error('Invalid Contract ID format for initial load');
            }
            return;
        }
        setIsLoading(true);
        setIsEditing(false);
        setInspectionResult(null);
        setLastInspectedId(targetId);
        // Update the input field if we are inspecting a different ID (e.g. from prop)
        if (targetId !== contractId) {
            setContractId(targetId);
        }
        try {
            const result = await inspectTokenData(targetId);
            setInspectionResult(result);
            setEditedCachedData(result.cachedData || null);
        } catch (err: any) {
            toast.error("Inspection failed", { description: err.message || 'Unknown error' });
            setInspectionResult({ contractId: targetId, fetchError: err.message });
            setEditedCachedData(null);
        } finally {
            setIsLoading(false);
        }
    }, [contractId]);

    useEffect(() => {
        if (initialContractId && looksLikeContractId(initialContractId)) {
            // Set contractId state and then call handleInspect
            // We could call handleInspect directly with initialContractId,
            // but setting the state ensures the input field reflects the ID.
            setContractId(initialContractId);
            handleInspect(initialContractId);
        }
    }, [initialContractId, handleInspect]);

    const handleRefresh = async () => {
        if (!lastInspectedId) return;
        setIsRefreshing(true);
        setIsEditing(false);
        try {
            const result = await forceRefreshToken(lastInspectedId);
            if (result.success) {
                toast.success("Cache refreshed successfully!");
                const reInspectResult = await inspectTokenData(lastInspectedId);
                setInspectionResult(reInspectResult);
                setEditedCachedData(reInspectResult.cachedData || null);
            } else {
                toast.error("Cache refresh failed", { description: result.error });
            }
        } catch (err: any) {
            toast.error("Cache refresh failed", { description: err.message || 'Unknown error' });
        } finally {
            setIsRefreshing(false);
        }
    };

    const hasChanges = isEditing && JSON.stringify(editedCachedData) !== JSON.stringify(inspectionResult?.cachedData);

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
                        onClick={() => handleInspect()}
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

                    {/* Action Buttons (Refresh Cache, Save Changes) */}
                    <div className="flex justify-end gap-2">
                        {isEditing && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleSaveChanges}
                                disabled={isSaving || isLoading || isRefreshing || !hasChanges}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isRefreshing || isLoading || isSaving || !lastInspectedId || isEditing}
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

                        {/* Cached Data Card (Now Editable) */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between gap-2 text-green-500">
                                    <div className="flex items-center gap-2">
                                        <Database className="w-5 h-5" />
                                        Cached Data (Vercel KV)
                                    </div>
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
                                        src={editedCachedData || { message: "No cached data found or not loaded." }}
                                        theme="ocean"
                                        iconStyle="square"
                                        displayObjectSize={false}
                                        displayDataTypes={false}
                                        enableClipboard={true}
                                        onEdit={handleCacheEdit}
                                        onAdd={handleCacheEdit}
                                        onDelete={handleCacheEdit}
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