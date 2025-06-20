'use client';

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface ComparisonTokenContextType {
    compareId: string | null;
    setCompareId: (id: string | null) => void;
    clearComparison: () => void;
    hasComparison: boolean;
    isInitialized: boolean;
}

const ComparisonTokenContext = createContext<ComparisonTokenContextType | undefined>(undefined);

interface ComparisonTokenProviderProps {
    children: ReactNode;
}

export function ComparisonTokenProvider({ children }: ComparisonTokenProviderProps) {
    const [compareId, setCompareIdState] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Initialize from URL params immediately (synchronous)
    useLayoutEffect(() => {
        if (isInitialized || typeof window === 'undefined') return;
        
        console.log('[COMPARISON-CONTEXT] Initializing with searchParams:', searchParams?.toString());
        
        const urlCompare = searchParams?.get('compare');
        if (urlCompare) {
            console.log('[COMPARISON-CONTEXT] Found URL compare param:', urlCompare);
            setCompareIdState(urlCompare);
            setIsInitialized(true);
            return;
        }
        
        // Fallback to localStorage if no URL param
        const stored = localStorage.getItem('compareTokenId');
        if (stored) {
            console.log('[COMPARISON-CONTEXT] Found localStorage compare:', stored);
            setCompareIdState(stored);
        }
        
        setIsInitialized(true);
    }, [searchParams, isInitialized]);

    // Sync URL and localStorage when compareId changes (but not during initialization)
    useEffect(() => {
        if (!isInitialized) return; // Don't sync during initialization
        
        if (compareId) {
            console.log('[COMPARISON-CONTEXT] Syncing compareId to URL/localStorage:', compareId);
            
            // Update localStorage
            if (typeof window !== 'undefined') {
                localStorage.setItem('compareTokenId', compareId);
            }
            
            // Update URL params only if different from current
            const currentCompare = searchParams?.get('compare');
            if (currentCompare !== compareId) {
                const params = new URLSearchParams(searchParams?.toString());
                params.set('compare', compareId);
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            }
        } else {
            console.log('[COMPARISON-CONTEXT] Clearing compareId from URL/localStorage');
            
            // Clear localStorage and URL param
            if (typeof window !== 'undefined') {
                localStorage.removeItem('compareTokenId');
            }
            
            const params = new URLSearchParams(searchParams?.toString());
            if (params.has('compare')) {
                params.delete('compare');
                const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
                router.replace(newUrl, { scroll: false });
            }
        }
    }, [compareId, pathname, router, searchParams, isInitialized]);

    const setCompareId = (id: string | null) => {
        setCompareIdState(id);
        console.log('[COMPARISON-CONTEXT] Set compare token:', id?.substring(0, 10) || 'none');
    };

    const clearComparison = () => {
        setCompareId(null);
    };

    const hasComparison = compareId !== null;

    return (
        <ComparisonTokenContext.Provider 
            value={{
                compareId,
                setCompareId,
                clearComparison,
                hasComparison,
                isInitialized
            }}
        >
            {children}
        </ComparisonTokenContext.Provider>
    );
}

export function useComparisonToken() {
    const context = useContext(ComparisonTokenContext);
    if (context === undefined) {
        throw new Error('useComparisonToken must be used within a ComparisonTokenProvider');
    }
    return context;
}