/**
 * Client-side streaming utilities for large dataset handling
 */

export interface StreamingOptions {
  chunkSize?: number;
  onProgress?: (loaded: number, total: number) => void;
  onChunk?: (chunk: any, offset: number, hasMore: boolean) => void;
}

export interface StreamingResult<T> {
  data: T;
  metadata: {
    totalChunks: number;
    currentChunk: number;
    hasMore: boolean;
    totalSize?: number;
  };
}

/**
 * Streaming data loader for large blockchain datasets
 */
export class StreamingDataLoader {
  private abortController?: AbortController;

  /**
   * Loads data with progressive streaming support
   */
  async loadStream<T = any>(
    path: string,
    options: StreamingOptions = {}
  ): Promise<StreamingResult<T>> {
    const {
      chunkSize = 1000,
      onProgress,
      onChunk
    } = options;

    // Cancel any existing request
    this.abort();
    this.abortController = new AbortController();

    const allData: any[] = [];
    let offset = 0;
    let hasMore = true;
    let chunkCount = 0;
    let totalSize: number | undefined;

    try {
      while (hasMore && !this.abortController.signal.aborted) {
        const url = new URL(`/api/v1/${path}`, window.location.origin);
        url.searchParams.set('stream', 'true');
        url.searchParams.set('offset', offset.toString());
        url.searchParams.set('limit', chunkSize.toString());

        const response = await fetch(url.toString(), {
          signal: this.abortController.signal
        });

        if (!response.ok) {
          throw new Error(`Streaming failed: ${response.statusText}`);
        }

        // Parse streaming headers
        hasMore = response.headers.get('X-Has-More') === 'true';
        const newOffset = parseInt(response.headers.get('X-Offset') || '0', 10);

        const chunk = await response.json();

        // Handle different chunk formats
        let chunkData: any;
        if ('data' in chunk) {
          chunkData = chunk.data;
          hasMore = chunk.hasMore;
          offset = chunk.offset;
        } else {
          chunkData = chunk;
          offset = newOffset;
        }

        // Accumulate data
        if (Array.isArray(chunkData)) {
          allData.push(...chunkData);
        } else if (typeof chunkData === 'object' && chunkData !== null) {
          allData.push(chunkData);
        }

        chunkCount++;

        // Estimate total size for progress tracking
        if (!totalSize && Array.isArray(chunkData) && chunkData.length < chunkSize) {
          totalSize = offset;
        }

        // Call progress callbacks
        onProgress?.(offset, totalSize || offset);
        onChunk?.(chunkData, offset, hasMore);

        // Prevent infinite loops
        if (chunkCount > 10000) {
          console.warn('Streaming terminated: too many chunks');
          break;
        }
      }

      return {
        data: allData as T,
        metadata: {
          totalChunks: chunkCount,
          currentChunk: chunkCount,
          hasMore: false,
          totalSize
        }
      };

    } catch (error) {
      if (this.abortController.signal.aborted) {
        throw new Error('Stream cancelled');
      }
      throw error;
    }
  }

  /**
   * Loads data with pagination for UI display
   */
  async loadPaginated<T = any>(
    path: string,
    page: number = 1,
    pageSize: number = 100
  ): Promise<{
    data: T[];
    pagination: {
      page: number;
      pageSize: number;
      hasNext: boolean;
      total?: number;
    };
  }> {
    const offset = (page - 1) * pageSize;

    const url = new URL(`/api/v1/${path}`, window.location.origin);
    url.searchParams.set('stream', 'true');
    url.searchParams.set('offset', offset.toString());
    url.searchParams.set('limit', pageSize.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Pagination failed: ${response.statusText}`);
    }

    const hasMore = response.headers.get('X-Has-More') === 'true';
    const chunk = await response.json();

    let data: T[];
    if ('data' in chunk) {
      data = Array.isArray(chunk.data) ? chunk.data : [chunk.data];
    } else {
      data = Array.isArray(chunk) ? chunk : [chunk];
    }

    return {
      data,
      pagination: {
        page,
        pageSize,
        hasNext: hasMore,
        total: hasMore ? undefined : offset + data.length
      }
    };
  }

  /**
   * Cancels any ongoing streaming request
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }
  }
}

/**
 * Hook for streaming data in React components
 */
export function useStreamingData<T = any>(path: string | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loaderRef = React.useRef<StreamingDataLoader>(null);

  React.useEffect(() => {
    if (!loaderRef.current) {
      loaderRef.current = new StreamingDataLoader();
    }

    return () => {
      loaderRef.current?.abort();
    };
  }, []);

  const loadData = React.useCallback(async (streamingPath: string) => {
    if (!loaderRef.current) return;

    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      const result = await loaderRef.current.loadStream<T>(streamingPath, {
        onProgress: (loaded, total) => {
          setProgress({ loaded, total });
        }
      });

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Streaming failed');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, []);

  React.useEffect(() => {
    if (path) {
      loadData(path);
    } else {
      setData(null);
      setError(null);
      setProgress(null);
    }
  }, [path, loadData]);

  const refresh = React.useCallback(() => {
    if (path) {
      loadData(path);
    }
  }, [path, loadData]);

  const cancel = React.useCallback(() => {
    loaderRef.current?.abort();
    setLoading(false);
    setProgress(null);
  }, []);

  return {
    data,
    loading,
    progress,
    error,
    refresh,
    cancel
  };
}

// Add React import at the top
import * as React from 'react';