'use server';

import { searchContractsByTrait, MetadataServiceConfig } from "../lib/search-client";
import { kv } from "@vercel/kv";
import { revalidatePath } from 'next/cache';

// Define ContractData interface directly here
export interface ContractData {
    contract_id: string;
    tx_id: string;
    block_height: number;
    clarity_version?: string;
}

// Interface for saved searches
export interface SearchResult {
    id: string;
    query: string;
    queryName?: string;
    timestamp: number;
    contracts: ContractData[];
}

const config: MetadataServiceConfig = {
    apiKey: process.env.HIRO_API_KEY,
    debug: process.env.NODE_ENV === 'development'
};

// Key for storing the list of all search IDs
const SEARCH_LIST_KEY = "contract-search:searches";

// Generate a cache key for a specific search
const getSearchCacheKey = (searchId: string): string => `contract-search:${searchId}`;

/**
 * Get all saved searches
 */
export async function getSavedSearches(): Promise<SearchResult[]> {
    try {
        // Get the list of search IDs
        const searchIds = await kv.get<string[]>(SEARCH_LIST_KEY) || [];

        if (searchIds.length === 0) return [];

        // Get all searches by their IDs
        const searches: SearchResult[] = [];
        for (const id of searchIds) {
            const search = await kv.get<SearchResult>(getSearchCacheKey(id));
            if (search) searches.push(search);
        }

        // Sort by timestamp, newest first
        return searches.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
        console.error("Error fetching saved searches:", error);
        return [];
    }
}

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
 * Server Action to search contracts by trait and cache the results
 * @param traitJsonString JSON string containing the trait definition
 * @param queryName Optional name for this query
 * @returns Object with success flag and search result
 */
export async function searchContracts(traitJsonString: string, queryName?: string) {
    if (!traitJsonString) {
        return { success: false, error: 'Trait definition is required.' };
    }

    try {
        // Parse the trait JSON
        const traitObject = JSON.parse(traitJsonString);
        console.log(`Searching for contracts with trait...`);

        // Generate a unique ID for this search
        const searchId = `search-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Use cryptonomicon to search for contracts with the specified trait
        const contracts = await searchContractsByTrait(traitObject, config);

        // Map to our contract data format
        const contractData: ContractData[] = contracts?.map(contract => ({
            contract_id: contract.contract_id,
            tx_id: contract.tx_id,
            block_height: contract.block_height,
            clarity_version: contract.clarity_version
        })) || [];

        console.log(`Found ${contractData.length} contracts matching the trait.`);

        // Deduplicate contracts (keeping only highest block height per contract_id)
        const originalCount = contractData.length;
        const dedupedContractData = deduplicateContracts(contractData, true); // sort ascending (oldest first)
        const newCount = dedupedContractData.length;

        if (originalCount > newCount) {
            console.log(`Removed ${originalCount - newCount} duplicate contracts.`);
        }

        // Create the search result object
        const searchResult: SearchResult = {
            id: searchId,
            query: traitJsonString,
            queryName: queryName || undefined,
            timestamp: Date.now(),
            contracts: dedupedContractData
        };

        // Save the search result
        await kv.set(getSearchCacheKey(searchId), searchResult);

        // Update the list of search IDs
        const currentSearchIds = await kv.get<string[]>(SEARCH_LIST_KEY) || [];
        await kv.set(SEARCH_LIST_KEY, [searchId, ...currentSearchIds].slice(0, 50)); // Keep only last 50 searches

        // Revalidate the home page to reflect new search
        revalidatePath('/');

        return {
            success: true,
            result: searchResult
        };

    } catch (error: any) {
        console.error(`Failed to search contracts:`, error);
        return {
            success: false,
            error: error.message || 'Failed to search contracts.'
        };
    }
}

/**
 * Delete a saved search
 * @param searchId ID of the search to delete
 */
export async function deleteSearch(searchId: string) {
    try {
        // Remove from search list
        const currentSearchIds = await kv.get<string[]>(SEARCH_LIST_KEY) || [];
        await kv.set(SEARCH_LIST_KEY, currentSearchIds.filter(id => id !== searchId));

        // Delete the search data
        await kv.del(getSearchCacheKey(searchId));

        // Revalidate the home page
        revalidatePath('/');

        return { success: true };
    } catch (error: any) {
        console.error(`Failed to delete search:`, error);
        return {
            success: false,
            error: error.message || 'Failed to delete search.'
        };
    }
} 