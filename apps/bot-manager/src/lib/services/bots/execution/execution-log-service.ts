/**
 * Execution Log Service using Vercel Blob for scalable log storage
 * Based on the established patterns from the metadata app
 */

import { del,put } from '@vercel/blob';

export interface LogMetadata {
  url: string;
  size: number;
  timestamp: string;
}

export class ExecutionLogService {
  /**
   * Store execution logs in blob storage
   */
  static async store(
    userId: string,
    botId: string, 
    executionId: string,
    logContent: string
  ): Promise<LogMetadata> {
    try {
      // Create a descriptive filename following metadata app patterns
      const filename = `executions/${userId}/${botId}/${executionId}.log`;
      
      // Upload to Vercel Blob with public access
      const blob = await put(filename, logContent, {
        access: 'public',
        contentType: 'text/plain',
      });

      return {
        url: blob.url,
        size: logContent.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to store execution logs:', error);
      throw new Error(`Failed to store execution logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieve execution logs from blob storage
   */
  static async retrieve(blobUrl: string): Promise<string> {
    try {
      const response = await fetch(blobUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error('Failed to retrieve execution logs:', error);
      throw new Error(`Failed to retrieve execution logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete execution logs from blob storage
   */
  static async delete(blobUrl: string): Promise<boolean> {
    try {
      // Extract pathname from the blob URL for deletion
      const url = new URL(blobUrl);
      const pathname = url.pathname;
      
      await del(pathname);
      return true;
    } catch (error) {
      console.error('Failed to delete execution logs:', error);
      // Don't throw on deletion errors - log and continue
      return false;
    }
  }

  /**
   * Check if logs exist and are accessible
   */
  static async exists(blobUrl: string): Promise<boolean> {
    try {
      const response = await fetch(blobUrl, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}