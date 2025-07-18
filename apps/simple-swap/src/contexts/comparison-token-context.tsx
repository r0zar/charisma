'use client';

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useRef, 
  useState,
  ReactNode
} from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

type ComparisonTokenId = string | null;

interface ComparisonContextType {
  compareId: ComparisonTokenId;
  setCompareId: (id: ComparisonTokenId) => void;
  clearComparison: () => void;
  hasComparison: boolean;
  isInitialized: boolean;
}

const ComparisonContext = createContext<ComparisonContextType | null>(null);

const STORAGE_KEY = 'compareTokenId';

function isValidComparisonId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0;
}

interface ComparisonTokenProviderProps {
  children: ReactNode;
}

export function ComparisonTokenProvider({ children }: ComparisonTokenProviderProps) {
  const [compareId, setCompareIdState] = useState<ComparisonTokenId>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const isUpdatingURL = useRef(false);
  const isUpdatingFromURL = useRef(false);

  // Initialize from URL or localStorage on mount
  useEffect(() => {
    if (isInitialized) return;

    const urlCompare = searchParams?.get('compare');
    
    if (urlCompare && isValidComparisonId(urlCompare)) {
      setCompareIdState(urlCompare);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, urlCompare);
      }
    } else if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isValidComparisonId(stored)) {
        setCompareIdState(stored);
      }
    }
    
    setIsInitialized(true);
  }, [searchParams, isInitialized]);

  // Sync to URL when compareId changes (but not during initialization)
  useEffect(() => {
    if (!isInitialized || isUpdatingFromURL.current) return;

    const currentURLParam = searchParams?.get('compare') || null;
    
    if (currentURLParam !== compareId) {
      isUpdatingURL.current = true;
      
      const params = new URLSearchParams(searchParams?.toString() || '');
      
      if (compareId) {
        params.set('compare', compareId);
      } else {
        params.delete('compare');
      }

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl, { scroll: false });
      
      setTimeout(() => {
        isUpdatingURL.current = false;
      }, 100);
    }
  }, [compareId, isInitialized, pathname, router, searchParams]);

  // Handle external URL changes
  useEffect(() => {
    if (!isInitialized || isUpdatingURL.current) return;

    const currentURLParam = searchParams?.get('compare') || null;
    
    if (currentURLParam !== compareId) {
      isUpdatingFromURL.current = true;
      
      if (currentURLParam && isValidComparisonId(currentURLParam)) {
        setCompareIdState(currentURLParam);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, currentURLParam);
        }
      } else {
        setCompareIdState(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      
      setTimeout(() => {
        isUpdatingFromURL.current = false;
      }, 100);
    }
  }, [searchParams, compareId, isInitialized]);

  const setCompareId = (id: ComparisonTokenId) => {
    if (isValidComparisonId(id)) {
      setCompareIdState(id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, id);
      }
    } else {
      clearComparison();
    }
  };

  const clearComparison = () => {
    setCompareIdState(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const value: ComparisonContextType = {
    compareId,
    setCompareId,
    clearComparison,
    hasComparison: compareId !== null,
    isInitialized
  };

  return (
    <ComparisonContext.Provider value={value}>
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparisonToken(): ComparisonContextType {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error('useComparisonToken must be used within a ComparisonTokenProvider');
  }
  return context;
}

// Convenience hooks
export function useCompareId(): ComparisonTokenId {
  const { compareId } = useComparisonToken();
  return compareId;
}

export function useHasComparison(): boolean {
  const { hasComparison } = useComparisonToken();
  return hasComparison;
}

export function useComparisonActions() {
  const { setCompareId, clearComparison } = useComparisonToken();
  return { setCompareId, clearComparison };
}

// Aliases for backward compatibility
export const useComparison = useComparisonToken;
export const useComparisonState = useComparisonToken;
export const useComparisonSelectors = useComparisonToken;
export const useComparisonInitialized = () => {
  const { isInitialized } = useComparisonToken();
  return isInitialized;
};