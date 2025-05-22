"use client";

import React, { useState } from 'react';
import { useApp } from '@/lib/context/app-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

// Import the centralized vault type definition
import { ClientDisplayVault } from './vault-detail-client';
// TokenCacheData might not be directly needed here if ClientDisplayVault already uses it for its tokens

// Remove local Token and Vault interfaces
// interface Token { ... }
// interface Vault { ... }

interface MetadataEditFormProps {
    vault: ClientDisplayVault; // Use ClientDisplayVault
    onMetadataUpdate: (updatedMetadata: Partial<ClientDisplayVault>) => void; // Use ClientDisplayVault
}

export function MetadataEditForm({ vault, onMetadataUpdate }: MetadataEditFormProps) {
    const { walletState, fetchWithAdminAuth } = useApp();
    // Initialize with the passed vault, which should conform to ClientDisplayVault
    const [jsonString, setJsonString] = useState(() => JSON.stringify(vault, null, 2));
    const [isValidJson, setIsValidJson] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleJsonChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newJsonString = event.target.value;
        setJsonString(newJsonString);
        try {
            JSON.parse(newJsonString);
            setIsValidJson(true);
        } catch (error) {
            setIsValidJson(false);
        }
    };

    const handleSave = async () => {
        if (!isValidJson) {
            toast.error("Invalid JSON format. Please correct before saving.");
            return;
        }
        if (!walletState.connected) {
            toast.error("Please connect your wallet first.");
            return;
        }

        let newMetadataObject: Partial<ClientDisplayVault>; // Use ClientDisplayVault here
        try {
            newMetadataObject = JSON.parse(jsonString) as Partial<ClientDisplayVault>; // Assert type if confident
        } catch (error) {
            toast.error("Failed to parse JSON. Please correct the format.");
            return;
        }

        setIsProcessing(true);
        try {
            const response = await fetchWithAdminAuth(
                `/api/v1/admin/vaults/${vault.contractId}/metadata`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(newMetadataObject),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `API Error: ${response.status}`);
            }

            if (result.success) {
                toast.success("Metadata updated successfully!");
                // The API should return the full updated vault that matches ClientDisplayVault
                const updatedVaultData = result.updatedMetadata as Partial<ClientDisplayVault>;
                onMetadataUpdate(updatedVaultData || newMetadataObject);
                if (result.updatedMetadata) {
                    setJsonString(JSON.stringify(result.updatedMetadata, null, 2));
                }
            } else {
                throw new Error(result.error || "API returned non-success status.");
            }

        } catch (error) {
            console.error("Error saving metadata:", error);
            toast.error("Failed to save metadata.", { description: error instanceof Error ? error.message : String(error) });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Edit Vault Metadata (JSON)</h3>
            <Alert variant={isValidJson ? "default" : "destructive"} className={isValidJson ? "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300" : ""}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{isValidJson ? "Valid JSON" : "Invalid JSON Format"}</AlertTitle>
                <AlertDescription>
                    {isValidJson
                        ? "Edit the raw JSON metadata below. Ensure core fields like contractId, tokenA, tokenB are not incorrectly modified."
                        : "Please correct the JSON syntax errors before saving."}
                </AlertDescription>
            </Alert>
            <Textarea
                spellCheck={false}
                value={jsonString}
                onChange={handleJsonChange}
                placeholder="Enter vault metadata as JSON..."
                rows={20}
                className={`font-mono text-sm ${!isValidJson ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            <Button onClick={handleSave} disabled={!isValidJson || isProcessing || !walletState.connected}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isProcessing ? 'Saving...' : 'Save Metadata (Admin)'}
            </Button>
        </div>
    );
} 