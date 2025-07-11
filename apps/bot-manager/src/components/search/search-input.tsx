'use client';

import { Loader2, Search, X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import { useSearch } from '@/contexts/search-context';

export function SearchInput() {
  const { query, setQuery, loading, closeSearch, clearResults } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when the search overlay opens
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleClear = () => {
    setQuery('');
    clearResults();
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center px-6 py-4 border-b border-border/30">
        <div className="flex items-center flex-1 gap-3">
          <div className="flex-shrink-0">
            {loading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for anything..."
            className="flex-1 bg-transparent text-lg placeholder:text-muted-foreground focus:outline-none text-foreground"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          
          {query ? (
            <button
              onClick={handleClear}
              className="flex-shrink-0 p-1 hover:bg-accent rounded-md transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          ) : (
            <button
              onClick={closeSearch}
              className="flex-shrink-0 p-1 hover:bg-accent rounded-md transition-colors"
              title="Close search"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
      
      {!query && (
        <div className="px-6 py-8 text-center">
          <div className="text-2xl font-bold text-foreground mb-2">
            Search for anything
          </div>
          <div className="text-sm text-muted-foreground">
            Find bots, notifications, users, transactions, and more
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <kbd className="px-2 py-1 bg-muted rounded text-muted-foreground">
              {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
            </kbd>
            <kbd className="px-2 py-1 bg-muted rounded text-muted-foreground">K</kbd>
            <span>to open search</span>
          </div>
        </div>
      )}
    </div>
  );
}