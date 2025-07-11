'use client';

import React, { createContext, ReactNode,useCallback, useContext, useEffect, useState } from 'react';

import { SearchResults } from '@/lib/services/search';

interface SearchContextType {
  // State
  isOpen: boolean;
  query: string;
  results: SearchResults | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  performSearch: (query: string) => Promise<void>;
  clearResults: () => void;
  
  // Navigation
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  navigateUp: () => void;
  navigateDown: () => void;
  selectResult: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};

interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const openSearch = useCallback(() => {
    setIsOpen(true);
    setSelectedIndex(0);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults(null);
    setError(null);
    setSelectedIndex(0);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      setSearchTimeout(null);
    }
  }, [searchTimeout]);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
    setSelectedIndex(0);
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}&maxResults=20`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const searchResults = await response.json();
      setResults(searchResults);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback((searchQuery: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    setSearchTimeout(timeout);
  }, [searchTimeout, performSearch]);

  const handleSetQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
    debouncedSearch(newQuery);
  }, [debouncedSearch]);

  // Get total results for navigation
  const getTotalResults = useCallback(() => {
    if (!results) return 0;
    return results.bots.length + results.notifications.length + results.users.length + results.transactions.length;
  }, [results]);

  const navigateUp = useCallback(() => {
    const totalResults = getTotalResults();
    if (totalResults > 0) {
      setSelectedIndex(prev => prev > 0 ? prev - 1 : totalResults - 1);
    }
  }, [getTotalResults]);

  const navigateDown = useCallback(() => {
    const totalResults = getTotalResults();
    if (totalResults > 0) {
      setSelectedIndex(prev => prev < totalResults - 1 ? prev + 1 : 0);
    }
  }, [getTotalResults]);

  const selectResult = useCallback(() => {
    if (!results) return;
    
    const totalResults = getTotalResults();
    if (totalResults === 0 || selectedIndex >= totalResults) return;

    // Find the selected result
    let currentIndex = 0;
    let selectedResult = null;
    
    for (const bot of results.bots) {
      if (currentIndex === selectedIndex) {
        selectedResult = { type: 'bot', data: bot };
        break;
      }
      currentIndex++;
    }
    
    if (!selectedResult) {
      for (const notification of results.notifications) {
        if (currentIndex === selectedIndex) {
          selectedResult = { type: 'notification', data: notification };
          break;
        }
        currentIndex++;
      }
    }
    
    if (!selectedResult) {
      for (const user of results.users) {
        if (currentIndex === selectedIndex) {
          selectedResult = { type: 'user', data: user };
          break;
        }
        currentIndex++;
      }
    }
    
    if (!selectedResult) {
      for (const transaction of results.transactions) {
        if (currentIndex === selectedIndex) {
          selectedResult = { type: 'transaction', data: transaction };
          break;
        }
        currentIndex++;
      }
    }

    if (selectedResult) {
      handleResultClick(selectedResult);
    }
  }, [results, selectedIndex, getTotalResults]);

  const handleResultClick = useCallback((result: { type: string; data: any }) => {
    closeSearch();
    
    // Navigate based on result type
    switch (result.type) {
      case 'bot':
        window.location.href = `/bots/${result.data.id}`;
        break;
      case 'notification':
        // Handle notification click - could navigate to notifications page
        if (result.data.data.actionUrl) {
          window.location.href = result.data.data.actionUrl;
        }
        break;
      case 'user':
        // Handle user click - could navigate to user profile
        console.log('User clicked:', result.data);
        break;
      case 'transaction':
        // Handle transaction click - could open transaction details
        if (result.data.data.txId) {
          window.open(`https://explorer.stacks.co/txid/${result.data.data.txId}`, '_blank');
        }
        break;
    }
  }, [closeSearch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        openSearch();
        return;
      }

      // Only handle other keys when search is open
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          closeSearch();
          break;
        case 'ArrowUp':
          event.preventDefault();
          navigateUp();
          break;
        case 'ArrowDown':
          event.preventDefault();
          navigateDown();
          break;
        case 'Enter':
          event.preventDefault();
          selectResult();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openSearch, closeSearch, navigateUp, navigateDown, selectResult]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const value: SearchContextType = {
    isOpen,
    query,
    results,
    loading,
    error,
    openSearch,
    closeSearch,
    setQuery: handleSetQuery,
    performSearch,
    clearResults,
    selectedIndex,
    setSelectedIndex,
    navigateUp,
    navigateDown,
    selectResult
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}