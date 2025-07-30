import { useState, useCallback } from 'react';
import { ApiResponse } from '@/types';
import { ERROR_MESSAGES } from '@/utils/constants';

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  showToast?: boolean;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T = any>(
  apiFunction: (...args: any[]) => Promise<ApiResponse<T>>,
  options: UseApiOptions = {}
): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiFunction(...args);

        if (response.success && response.data) {
          setData(response.data);
          options.onSuccess?.(response.data);
          return response.data;
        } 
          const errorMessage = response.error || response.message || ERROR_MESSAGES.SERVER_ERROR;
          setError(errorMessage);
          options.onError?.(errorMessage);
          return null;
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.NETWORK_ERROR;
        setError(errorMessage);
        options.onError?.(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, options]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

// Hook for handling form submissions
export function useApiForm<T = any>(
  apiFunction: (...args: any[]) => Promise<ApiResponse<T>>,
  options: UseApiOptions = {}
): UseApiReturn<T> & {
  submitForm: (formData: any) => Promise<T | null>;
} {
  const api = useApi(apiFunction, options);

  const submitForm = useCallback(
    async (formData: any): Promise<T | null> => {
      return api.execute(formData);
    },
    [api]
  );

  return {
    ...api,
    submitForm,
  };
}

// Hook for paginated data
export function useApiPagination<T = any>(
  apiFunction: (page: number, limit: number, ...args: any[]) => Promise<ApiResponse<T[]>>,
  initialPage: number = 1,
  initialLimit: number = 10
) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const api = useApi(apiFunction, {
    onSuccess: (response: any) => {
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
        setTotal(response.pagination.total);
      }
    },
  });

  const loadPage = useCallback(
    (newPage: number, newLimit?: number) => {
      setPage(newPage);
      if (newLimit) {setLimit(newLimit);}
      return api.execute(newPage, newLimit || limit);
    },
    [api, limit]
  );

  const nextPage = useCallback(() => {
    if (page < totalPages) {
      return loadPage(page + 1);
    }
    return Promise.resolve(null);
  }, [page, totalPages, loadPage]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      return loadPage(page - 1);
    }
    return Promise.resolve(null);
  }, [page, loadPage]);

  const goToPage = useCallback(
    (targetPage: number) => {
      if (targetPage >= 1 && targetPage <= totalPages) {
        return loadPage(targetPage);
      }
      return Promise.resolve(null);
    },
    [totalPages, loadPage]
  );

  return {
    ...api,
    page,
    limit,
    totalPages,
    total,
    loadPage,
    nextPage,
    prevPage,
    goToPage,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}