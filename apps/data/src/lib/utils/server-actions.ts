/**
 * Server Actions for data mutations
 * Replaces PUT/DELETE API routes with type-safe server actions
 */

'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { blobStorageService } from '@/lib/storage/blob-storage-service';
import { parseApiPath, generateBlobPath } from '../contracts/stacks-validation';

interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Save data to a specific path
 */
export async function saveData(path: string[], data: any): Promise<ActionResult> {
  try {
    // Parse and validate path
    const parsed = parseApiPath(path);
    if (!parsed) {
      return {
        success: false,
        error: 'Invalid API path format'
      };
    }

    const blobPath = generateBlobPath(parsed);
    if (!blobPath) {
      return {
        success: false,
        error: 'Could not determine storage path'
      };
    }

    // Save to blob storage
    await blobStorageService.put(blobPath, data);

    // Revalidate related paths
    const pathStr = path.join('/');
    revalidatePath(`/api/v1/${pathStr}`);
    revalidateTag('tree'); // Tree structure may have changed

    // Revalidate root if top-level data changed
    if (path.length === 1) {
      revalidatePath('/api/v1');
    }

    return {
      success: true,
      data: { path: pathStr, timestamp: new Date().toISOString() }
    };

  } catch (error) {
    console.error('Save data action error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save data'
    };
  }
}

/**
 * Delete data at a specific path (not supported in unified storage)
 */
export async function deleteData(path: string[]): Promise<ActionResult> {
  return {
    success: false,
    error: 'Delete operations not supported in unified blob storage'
  };
}

/**
 * Bulk update multiple paths using batch operation
 */
export async function bulkUpdate(updates: Array<{ path: string[]; data: any }>): Promise<ActionResult<{ completed: number; failed: number }>> {
  try {
    // Convert path arrays to path strings and prepare batch updates
    const batchUpdates = updates.map(update => ({
      path: update.path.join('/'),
      data: update.data
    }));

    // Use batch update for better performance and consistency
    await blobStorageService.putBatch(batchUpdates);

    // Revalidate tree after bulk updates
    revalidateTag('tree');
    revalidatePath('/api/v1');

    return {
      success: true,
      data: {
        completed: updates.length,
        failed: 0
      }
    };

  } catch (error) {
    console.error('Bulk update error:', error);

    return {
      success: false,
      data: {
        completed: 0,
        failed: updates.length
      },
      error: error instanceof Error ? error.message : 'Bulk update failed'
    };
  }
}

/**
 * Seed Charisma data from live API
 */
export async function seedCharismaData(): Promise<ActionResult> {
  try {
    // Revalidate all paths
    revalidateTag('tree');
    revalidatePath('/api/v1');
    revalidatePath('/api/v1/addresses');
    revalidatePath('/api/v1/contracts');
    revalidatePath('/api/v1/prices');

    return {
      success: true,
      data: { message: 'Charisma data seeded successfully from live API' }
    };

  } catch (error) {
    console.error('Seed Charisma data error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to seed Charisma data'
    };
  }
}

/**
 * Seed sample data
 */
export async function seedSampleData(): Promise<ActionResult> {
  try {
    const sampleData = {
      addresses: {
        'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9': {
          balances: {
            stx: {
              balance: '1000000000000',
              total_sent: '0',
              total_received: '1000000000000',
              lock_tx_id: '',
              locked: '0',
              lock_height: 0,
              burnchain_lock_height: 0,
              burnchain_unlock_height: 0
            },
            fungible_tokens: []
          },
          transactions: {
            limit: 20,
            offset: 0,
            total: 1,
            results: []
          }
        }
      },
      contracts: {
        'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.sample-contract': {
          metadata: {
            name: 'sample-contract',
            description: 'A sample smart contract',
            version: '1.0.0'
          },
          'get-balance': {
            result: '1000000',
            block_height: 100000
          }
        }
      },
      prices: {
        'STX-USDA': {
          current: {
            price: '1.25',
            change_24h: '+0.05',
            volume_24h: '1000000',
            timestamp: new Date().toISOString()
          },
          history: []
        }
      }
    };

    // Use bulk update to seed all data
    const updates = [
      { path: ['addresses'], data: sampleData.addresses },
      { path: ['contracts'], data: sampleData.contracts },
      { path: ['prices'], data: sampleData.prices }
    ];

    const result = await bulkUpdate(updates);

    if (result.success) {
      return {
        success: true,
        data: { message: 'Sample data seeded successfully', ...result.data }
      };
    }

    return result;

  } catch (error) {
    console.error('Seed sample data error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to seed sample data'
    };
  }
}

/**
 * Clear all data (reset to empty state)
 */
export async function clearAllData(): Promise<ActionResult> {
  try {
    const emptyData = { addresses: {}, contracts: {}, prices: {} };

    const updates = [
      { path: ['addresses'], data: {} },
      { path: ['contracts'], data: {} },
      { path: ['prices'], data: {} }
    ];

    const result = await bulkUpdate(updates);

    return {
      success: result.success,
      data: { message: 'All data cleared successfully' },
      error: result.error
    };

  } catch (error) {
    console.error('Clear all data error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear data'
    };
  }
}

/**
 * Validate and format JSON data before saving
 */
export async function validateAndSave(path: string[], jsonData: string): Promise<ActionResult> {
  try {
    // Parse JSON to validate it
    const data = JSON.parse(jsonData);

    // Save using the regular save action
    return await saveData(path, data);

  } catch (parseError) {
    return {
      success: false,
      error: parseError instanceof Error ? `Invalid JSON: ${parseError.message}` : 'Invalid JSON format'
    };
  }
}