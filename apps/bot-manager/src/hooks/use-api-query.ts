import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/contexts/api-context';
import type { ApiRequest, ApiResponse, ApiError } from '@/contexts/api-context';

// Query hook for GET requests with caching
export function useApiQuery<T = any>(
  url: string | null,
  options: Partial<ApiRequest> = {},
  deps: any[] = []
) {
  const api = useApi();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<T>(url, {
        cache: true,
        ...options,
      });
      setData(response.data);
      setLastFetch(Date.now());
    } catch (err) {
      setError(err as ApiError);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [api, url, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    if (options.cacheKey) {
      api.clearCache(options.cacheKey);
    }
    return fetchData();
  }, [api, fetchData, options.cacheKey]);

  return {
    data,
    loading,
    error,
    refetch,
    lastFetch,
  };
}

// Mutation hook for POST/PUT/DELETE requests
export function useApiMutation<TData = any, TVariables = any>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: ApiError, variables: TVariables) => void;
    invalidateCache?: string | string[];
  } = {}
) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = useCallback(async (variables: TVariables) => {
    setLoading(true);
    setError(null);

    try {
      const response = await mutationFn(variables);
      
      // Invalidate cache if specified
      if (options.invalidateCache) {
        const cacheKeys = Array.isArray(options.invalidateCache) 
          ? options.invalidateCache 
          : [options.invalidateCache];
        
        cacheKeys.forEach(key => api.clearCache(key));
      }

      options.onSuccess?.(response.data, variables);
      return response;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      options.onError?.(apiError, variables);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [api, mutationFn, options]);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

// Hook for paginated data
export function useApiPagination<T = any>(
  url: string | null,
  options: Partial<ApiRequest> & {
    initialPage?: number;
    initialLimit?: number;
  } = {}
) {
  const api = useApi();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [page, setPage] = useState(options.initialPage || 1);
  const [limit, setLimit] = useState(options.initialLimit || 10);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (pageNum: number, pageLimit: number) => {
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        data: T[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(url, {
        params: {
          page: pageNum,
          limit: pageLimit,
        },
        cache: true,
        ...options,
      });

      if (pageNum === 1) {
        setData(response.data.data);
      } else {
        setData(prev => [...prev, ...response.data.data]);
      }

      setTotal(response.data.pagination.total);
      setHasMore(pageNum < response.data.pagination.totalPages);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [api, url, ...Object.values(options)]);

  useEffect(() => {
    fetchPage(1, limit);
  }, [fetchPage, limit]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPage(nextPage, limit);
    }
  }, [loading, hasMore, page, limit, fetchPage]);

  const refresh = useCallback(() => {
    setPage(1);
    setData([]);
    fetchPage(1, limit);
  }, [fetchPage, limit]);

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    setData([]);
  }, []);

  return {
    data,
    loading,
    error,
    page,
    limit,
    total,
    hasMore,
    loadMore,
    refresh,
    changeLimit,
  };
}

// Hook for real-time data with polling
export function useApiPolling<T = any>(
  url: string | null,
  options: Partial<ApiRequest> & {
    interval?: number;
    enabled?: boolean;
  } = {}
) {
  const { interval = 5000, enabled = true, ...apiOptions } = options;
  const { data, loading, error, refetch } = useApiQuery<T>(url, apiOptions);

  useEffect(() => {
    if (!enabled || !url) return;

    const intervalId = setInterval(() => {
      refetch();
    }, interval);

    return () => clearInterval(intervalId);
  }, [enabled, url, interval, refetch]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}

// Hook for dependent queries
export function useApiDependentQuery<T = any>(
  url: string | null,
  dependencies: any[],
  options: Partial<ApiRequest> = {}
) {
  const shouldFetch = dependencies.every(dep => dep !== null && dep !== undefined);
  
  return useApiQuery<T>(
    shouldFetch ? url : null,
    options,
    dependencies
  );
}