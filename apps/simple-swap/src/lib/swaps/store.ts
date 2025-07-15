'use server';

import { SwapRecord, SwapRecordListOptions, SwapRecordListResult, CreateSwapRecordInput, UpdateSwapRecordInput } from './types';
// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';

const HASH_KEY = 'swap-records'; // Redis hash holding swap record JSON blobs

/**
 * Create a new swap record
 */
export async function addSwapRecord(input: CreateSwapRecordInput): Promise<SwapRecord> {
    const swapRecord: SwapRecord = {
        id: uuidv4(),
        type: 'instant',
        ...input,
        status: 'pending',
        timestamp: Date.now(),
    };
    
    await kv.hset(HASH_KEY, { [swapRecord.id]: JSON.stringify(swapRecord) });
    console.log(`[Swap Store] Created swap record: ${swapRecord.id}`);
    return swapRecord;
}

/**
 * Get a specific swap record by ID
 */
export async function getSwapRecord(id: string): Promise<SwapRecord | undefined> {
    const raw = await kv.hget(HASH_KEY, id);
    if (!raw) return undefined;
    return typeof raw === 'string' ? (JSON.parse(raw) as SwapRecord) : (raw as SwapRecord);
}

/**
 * Update a swap record
 */
export async function updateSwapRecord(id: string, update: UpdateSwapRecordInput): Promise<SwapRecord | undefined> {
    const existing = await getSwapRecord(id);
    if (!existing) return undefined;
    
    const updated: SwapRecord = {
        ...existing,
        ...update,
    };
    
    // Set completedAt timestamp if status is completed and not already set
    if (update.status === 'completed' && !updated.completedAt) {
        updated.completedAt = Date.now();
    }
    
    await kv.hset(HASH_KEY, { [id]: JSON.stringify(updated) });
    console.log(`[Swap Store] Updated swap record: ${id} -> ${update.status}`);
    return updated;
}

/**
 * List swap records with filtering and pagination
 */
export async function listSwapRecords(options: SwapRecordListOptions = {}): Promise<SwapRecordListResult> {
    const {
        owner,
        status,
        type,
        limit = 50,
        offset = 0,
        sortBy = 'timestamp',
        sortOrder = 'desc'
    } = options;
    
    // Get all swap records from Redis
    const allRecords = await kv.hgetall(HASH_KEY);
    if (!allRecords) {
        return {
            swaps: [],
            total: 0,
            hasMore: false
        };
    }
    
    // Parse and filter records
    let swaps: SwapRecord[] = [];
    for (const [id, rawRecord] of Object.entries(allRecords)) {
        try {
            const record = typeof rawRecord === 'string' ? 
                JSON.parse(rawRecord) as SwapRecord : 
                rawRecord as SwapRecord;
            
            // Apply filters
            if (owner && record.owner !== owner) continue;
            if (status && record.status !== status) continue;
            if (type && record.type !== type) continue;
            
            swaps.push(record);
        } catch (error) {
            console.error(`[Swap Store] Failed to parse swap record ${id}:`, error);
        }
    }
    
    // Sort records
    swaps.sort((a, b) => {
        const aValue = sortBy === 'completedAt' ? (a.completedAt || a.timestamp) : a.timestamp;
        const bValue = sortBy === 'completedAt' ? (b.completedAt || b.timestamp) : b.timestamp;
        
        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });
    
    // Apply pagination
    const total = swaps.length;
    const paginatedSwaps = swaps.slice(offset, offset + limit);
    const hasMore = offset + limit < total;
    
    return {
        swaps: paginatedSwaps,
        total,
        hasMore
    };
}

/**
 * Delete a swap record (for cleanup/admin purposes)
 */
export async function deleteSwapRecord(id: string): Promise<boolean> {
    const result = await kv.hdel(HASH_KEY, id);
    if (result) {
        console.log(`[Swap Store] Deleted swap record: ${id}`);
    }
    return result > 0;
}

/**
 * Get swap statistics for a user
 */
export async function getSwapStats(owner: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    failed: number;
}> {
    const { swaps } = await listSwapRecords({ owner, limit: 1000 }); // Get all for stats
    
    const stats = {
        total: swaps.length,
        completed: swaps.filter(s => s.status === 'completed').length,
        pending: swaps.filter(s => s.status === 'pending').length,
        failed: swaps.filter(s => s.status === 'failed').length,
    };
    
    return stats;
}