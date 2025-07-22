/**
 * Debugging utilities for blob storage issues
 */

import { blobStorageService } from '@/lib/storage/blob-storage-service';

export class BlobDebugger {
  /**
   * Log detailed information about the current blob state
   */
  static async logBlobState(): Promise<void> {
    try {
      console.log('=== BLOB DEBUG STATE ===');
      
      // Clear cache to get fresh data
      blobStorageService.clearCache();
      
      const rootBlob = await blobStorageService.getRoot();
      
      console.log('Root blob info:', {
        version: rootBlob.version,
        lastUpdated: rootBlob.lastUpdated,
        totalSize: rootBlob.metadata?.totalSize,
        entryCount: rootBlob.metadata?.entryCount
      });
      
      console.log('Addresses count:', Object.keys(rootBlob.addresses || {}).length);
      console.log('Contracts count:', Object.keys(rootBlob.contracts || {}).length);
      console.log('Prices count:', Object.keys(rootBlob.prices || {}).length);
      
      if (Object.keys(rootBlob.addresses || {}).length > 0) {
        console.log('Address keys:', Object.keys(rootBlob.addresses));
      }
      
      if (Object.keys(rootBlob.contracts || {}).length > 0) {
        console.log('Contract keys:', Object.keys(rootBlob.contracts));
      }
      
      if (Object.keys(rootBlob.prices || {}).length > 0) {
        console.log('Price keys:', Object.keys(rootBlob.prices));
      }
      
      console.log('=== END BLOB DEBUG ===');
      
    } catch (error) {
      console.error('Failed to debug blob state:', error);
    }
  }

  /**
   * Compare expected vs actual blob content
   */
  static async validateBlobContent(expectedPaths: string[]): Promise<boolean> {
    try {
      const rootBlob = await blobStorageService.getRoot();
      let allPathsExist = true;
      
      for (const path of expectedPaths) {
        try {
          await blobStorageService.get(path);
          console.log(`✓ Path exists: ${path}`);
        } catch (error) {
          console.log(`✗ Path missing: ${path}`);
          allPathsExist = false;
        }
      }
      
      return allPathsExist;
    } catch (error) {
      console.error('Failed to validate blob content:', error);
      return false;
    }
  }

  /**
   * Test save and retrieve cycle
   */
  static async testSaveRetrieveCycle(path: string, testData: any): Promise<boolean> {
    try {
      console.log(`Testing save/retrieve cycle for path: ${path}`);
      
      // Save test data
      await blobStorageService.put(path, testData);
      console.log('✓ Save completed');
      
      // Clear cache to force fresh fetch
      blobStorageService.clearCache();
      
      // Retrieve and compare
      const retrieved = await blobStorageService.get(path);
      const matches = JSON.stringify(retrieved) === JSON.stringify(testData);
      
      if (matches) {
        console.log('✓ Data matches after save/retrieve cycle');
        return true;
      } else {
        console.log('✗ Data mismatch after save/retrieve cycle');
        console.log('Expected:', testData);
        console.log('Retrieved:', retrieved);
        return false;
      }
      
    } catch (error) {
      console.error('Save/retrieve test failed:', error);
      return false;
    }
  }

  /**
   * Monitor blob changes over time
   */
  static startBlobMonitoring(intervalMs: number = 10000): () => void {
    let previousState: string | null = null;
    
    const monitor = async () => {
      try {
        blobStorageService.clearCache();
        const rootBlob = await blobStorageService.getRoot();
        const currentState = JSON.stringify({
          version: rootBlob.version,
          lastUpdated: rootBlob.lastUpdated,
          addresses: Object.keys(rootBlob.addresses || {}),
          contracts: Object.keys(rootBlob.contracts || {}),
          prices: Object.keys(rootBlob.prices || {})
        });
        
        if (previousState && previousState !== currentState) {
          console.log('🔄 Blob state changed!');
          console.log('Previous keys:', JSON.parse(previousState));
          console.log('Current keys:', JSON.parse(currentState));
        }
        
        previousState = currentState;
        
      } catch (error) {
        console.error('Blob monitoring error:', error);
      }
    };
    
    const intervalId = setInterval(monitor, intervalMs);
    
    // Run initial check
    monitor();
    
    // Return cleanup function
    return () => clearInterval(intervalId);
  }
}