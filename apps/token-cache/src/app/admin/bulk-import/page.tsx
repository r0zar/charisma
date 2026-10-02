'use client';

import { useState, FormEvent } from 'react';

const STACKS_CONTRACT_ID_REGEX = /^SP[0-9A-Z]+\.[a-zA-Z0-9_-]+$/i;

interface ProcessResult {
    contractId: string;
    status: 'success' | 'error' | 'skipped';
    message?: string;
}

export default function BulkImportPage() {
    const [contractList, setContractList] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [results, setResults] = useState<ProcessResult[]>([]);
    const [summary, setSummary] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        setResults([]);
        setSummary(null);

        const contractIds = contractList
            .split(',')
            .map(id => id.trim())
            .filter(id => id !== '');

        if (contractIds.length === 0) {
            setSummary('No contract IDs provided.');
            setIsLoading(false);
            return;
        }

        const processingPromises: Promise<ProcessResult>[] = contractIds.map(async (contractId) => {
            if (!STACKS_CONTRACT_ID_REGEX.test(contractId)) {
                return {
                    contractId,
                    status: 'skipped',
                    message: 'Invalid contract ID format.',
                } as ProcessResult;
            }

            try {
                // Assume an API endpoint exists to trigger caching for a single contract ID
                // e.g., POST to /api/v1/sip10/[contractId] might re-fetch/re-cache.
                // For this example, we'll just simulate the call.
                const response = await fetch(`/api/v1/sip10/${encodeURIComponent(contractId)}`, {
                    method: 'GET', // Or GET if your API just needs a ping to re-cache
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    // body: JSON.stringify({ action: 'recache' }) // If your API needs a body
                });

                if (response.ok) {
                    // const data = await response.json(); // If your API returns useful data
                    return {
                        contractId,
                        status: 'success',
                        message: `Successfully triggered cache for ${contractId}`,
                    } as ProcessResult;
                } else {
                    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                    return {
                        contractId,
                        status: 'error',
                        message: `API Error (${response.status}): ${errorData.message || response.statusText}`,
                    } as ProcessResult;
                }
            } catch (error: any) {
                return {
                    contractId,
                    status: 'error',
                    message: `Network or client-side error: ${error.message}`,
                } as ProcessResult;
            }
        });

        const settledResults = await Promise.all(processingPromises);
        setResults(settledResults);

        const successCount = settledResults.filter(r => r.status === 'success').length;
        const errorCount = settledResults.filter(r => r.status === 'error').length;
        const skippedCount = settledResults.filter(r => r.status === 'skipped').length;
        setSummary(
            `Processing complete. Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skippedCount}.`
        );
        setIsLoading(false);
    };

    return (
        <div className="container mx-auto p-4 max-w-2xl">
            <h1 className="text-3xl font-bold mb-6 text-center">Bulk Contract Import</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="contractList" className="block text-sm font-medium text-ink-body mb-1">
                        Comma-separated Contract IDs:
                    </label>
                    <textarea
                        id="contractList"
                        name="contractList"
                        rows={6}
                        className="block w-full p-2 border border-line rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm"
                        value={contractList}
                        onChange={(e) => setContractList(e.target.value)}
                        placeholder="SP...ADDR.contract1, SP...ADDR.contract2, ..."
                        disabled={isLoading}
                    />
                    <p className="mt-1 text-xs text-ink-muted">
                        Paste a list of Stacks contract identifiers (e.g., SP...ADDR.my-contract).
                    </p>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-on-accent bg-accent hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
                    >
                        {isLoading ? 'Processing...' : 'Import Contracts'}
                    </button>
                </div>
            </form>

            {summary && (
                <div className="mt-8 p-4 bg-surface-hover rounded-md">
                    <h2 className="text-lg font-semibold mb-2">Summary</h2>
                    <p>{summary}</p>
                </div>
            )}

            {results.length > 0 && (
                <div className="mt-6">
                    <h2 className="text-lg font-semibold mb-2">Detailed Results:</h2>
                    <ul className="space-y-2 max-h-96 overflow-y-auto border border-line rounded-md p-3">
                        {results.map((result, index) => (
                            <li key={index}
                                className={`p-2 rounded-md text-sm 
                    ${result.status === 'success' ? 'bg-success-soft text-success' : ''}
                    ${result.status === 'error' ? 'bg-danger-soft text-danger' : ''}
                    ${result.status === 'skipped' ? 'bg-warning-soft text-warning' : ''}
                  `}
                            >
                                <strong>{result.contractId}:</strong> {result.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
} 