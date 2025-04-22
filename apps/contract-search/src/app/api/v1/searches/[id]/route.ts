import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { SearchResult, ContractData } from '@/app/actions';

// We need to use the same cache key function as in actions.ts
const getSearchCacheKey = (searchId: string): string => `contract-search:${searchId}`;

/**
 * Deduplicate contracts, keeping only the one with highest block height for each contract ID
 * @param contracts Array of contracts to deduplicate
 * @param sortAscending Whether to sort by block height ascending (oldest first)
 * @returns Deduplicated array of contracts
 */
function deduplicateContracts(contracts: ContractData[], sortAscending: boolean = true): ContractData[] {
    // Use a map to only keep the highest block height for each contract_id
    const contractsMap = new Map<string, ContractData>();

    // Process each contract
    contracts.forEach(contract => {
        const existingContract = contractsMap.get(contract.contract_id);

        // If we don't have this contract yet, or if this one has a higher block height
        if (!existingContract || contract.block_height > existingContract.block_height) {
            contractsMap.set(contract.contract_id, contract);
        }
    });

    // Convert back to array
    const dedupedContracts = Array.from(contractsMap.values());

    // Sort by block height (ascending or descending based on parameter)
    return sortAscending
        ? dedupedContracts.sort((a, b) => a.block_height - b.block_height)
        : dedupedContracts.sort((a, b) => b.block_height - a.block_height);
}

/**
 * GET /api/v1/searches/[id]
 * Returns a specific saved search by ID
 */
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;
        const url = new URL(request.url);
        const deduplicate = url.searchParams.get('deduplicate') !== 'false'; // Default to true
        const sortAscending = url.searchParams.get('sort') !== 'desc'; // Default to ascending (oldest first)

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Search ID is required' },
                { status: 400 }
            );
        }

        // Get the search from KV store
        const search = await kv.get<SearchResult>(getSearchCacheKey(id));

        if (!search) {
            return NextResponse.json(
                { success: false, error: 'Search not found' },
                { status: 404 }
            );
        }

        // Create a copy of the search to avoid modifying the cached version
        const searchResult = { ...search };

        // Deduplicate contracts if requested (default is true)
        if (deduplicate && searchResult.contracts?.length > 0) {
            const originalCount = searchResult.contracts.length;
            searchResult.contracts = deduplicateContracts(searchResult.contracts, sortAscending);
            const newCount = searchResult.contracts.length;

            // Add metadata about deduplication
            return NextResponse.json({
                success: true,
                result: searchResult,
                meta: {
                    deduplicated: deduplicate,
                    originalCount,
                    dedupedCount: newCount,
                    duplicatesRemoved: originalCount - newCount,
                    sorting: sortAscending ? 'ascending' : 'descending'
                }
            });
        }

        // Return the search as JSON
        return NextResponse.json({
            success: true,
            result: searchResult,
            meta: {
                deduplicated: false,
                sorting: sortAscending ? 'ascending' : 'descending'
            }
        });
    } catch (error: any) {
        console.error(`Error fetching search:`, error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to retrieve search',
            },
            { status: 500 }
        );
    }
} 