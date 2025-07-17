'use client';

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useRef, 
  useSyncExternalStore,
  ReactNode,
  useMemo,
  startTransition
} from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

// Types for better type safety
type ComparisonTokenId = string | null;

interface ComparisonState {
  compareId: ComparisonTokenId;
  isInitialized: boolean;
  isURLSyncing: boolean;
  lastURLUpdate: number;
}

// Action types for reducer
type ComparisonAction =
  | { type: 'SET_COMPARE_ID'; id: ComparisonTokenId }
  | { type: 'SET_INITIALIZED'; initialized: boolean }
  | { type: 'SET_URL_SYNCING'; syncing: boolean }
  | { type: 'CLEAR_COMPARISON' }
  | { type: 'INITIALIZE_FROM_URL'; id: ComparisonTokenId }
  | { type: 'INITIALIZE_FROM_STORAGE'; id: ComparisonTokenId };

// Context interfaces
interface ComparisonStateContextType {
  state: ComparisonState;
}

interface ComparisonActionsContextType {
  setCompareId: (id: ComparisonTokenId) => void;
  clearComparison: () => void;
}

interface ComparisonSelectorsContextType {
  getCompareId: () => ComparisonTokenId;
  hasComparison: () => boolean;
  isInitialized: () => boolean;
  isURLSyncing: () => boolean;
}

// Create separate contexts
const ComparisonStateContext = createContext<ComparisonStateContextType | null>(null);
const ComparisonActionsContext = createContext<ComparisonActionsContextType | null>(null);
const ComparisonSelectorsContext = createContext<ComparisonSelectorsContextType | null>(null);

// Utility functions
function isValidComparisonId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0;
}

// Initial state
const initialState: ComparisonState = {
  compareId: null,
  isInitialized: false,
  isURLSyncing: false,
  lastURLUpdate: 0,
};

// Reducer for state management
function comparisonReducer(state: ComparisonState, action: ComparisonAction): ComparisonState {
  switch (action.type) {
    case 'SET_COMPARE_ID':
      if (state.compareId === action.id) return state;
      return {
        ...state,
        compareId: action.id,
        lastURLUpdate: Date.now(),
      };

    case 'SET_INITIALIZED':
      if (state.isInitialized === action.initialized) return state;
      return {
        ...state,
        isInitialized: action.initialized,
      };

    case 'SET_URL_SYNCING':
      if (state.isURLSyncing === action.syncing) return state;
      return {
        ...state,
        isURLSyncing: action.syncing,
      };

    case 'CLEAR_COMPARISON':
      if (!state.compareId) return state;
      return {
        ...state,
        compareId: null,
        lastURLUpdate: Date.now(),
      };

    case 'INITIALIZE_FROM_URL':
      return {
        ...state,
        compareId: action.id,
        isInitialized: true,
        lastURLUpdate: Date.now(),
      };

    case 'INITIALIZE_FROM_STORAGE':
      return {
        ...state,
        compareId: action.id,
        isInitialized: true,
      };

    default:
      return state;
  }
}

// External store for localStorage synchronization
class ComparisonStore {
  private state: ComparisonState = initialState;
  private listeners = new Set<() => void>();
  private storageKey = 'compareTokenId';

  constructor() {
    this.setupStorageListener();
  }

  private setupStorageListener() {
    if (typeof window !== 'undefined') {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === this.storageKey) {
          const newValue = e.newValue;
          if (newValue && isValidComparisonId(newValue)) {
            this.dispatch({ type: 'SET_COMPARE_ID', id: newValue });
          } else {
            this.dispatch({ type: 'CLEAR_COMPARISON' });
          }
        }
      };
      window.addEventListener('storage', handleStorageChange);
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  getServerSnapshot = () => initialState;

  private dispatch(action: ComparisonAction) {
    const prevState = this.state;
    this.state = comparisonReducer(this.state, action);
    
    // Only notify if state actually changed
    if (prevState !== this.state) {
      this.listeners.forEach(listener => listener());
    }
  }

  setCompareId(id: ComparisonTokenId) {
    this.dispatch({ type: 'SET_COMPARE_ID', id });
    this.syncToStorage(id);
  }

  clearComparison() {
    this.dispatch({ type: 'CLEAR_COMPARISON' });
    this.syncToStorage(null);
  }

  initializeFromURL(id: ComparisonTokenId) {
    this.dispatch({ type: 'INITIALIZE_FROM_URL', id });
    this.syncToStorage(id);
  }

  initializeFromStorage() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.storageKey);
      const id = isValidComparisonId(stored) ? stored : null;
      this.dispatch({ type: 'INITIALIZE_FROM_STORAGE', id });
    } else {
      this.dispatch({ type: 'SET_INITIALIZED', initialized: true });
    }
  }

  setInitialized(initialized: boolean) {
    this.dispatch({ type: 'SET_INITIALIZED', initialized });
  }

  setURLSyncing(syncing: boolean) {
    this.dispatch({ type: 'SET_URL_SYNCING', syncing });
  }

  private syncToStorage(id: ComparisonTokenId) {
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem(this.storageKey, id);
      } else {
        localStorage.removeItem(this.storageKey);
      }
    }
  }

  cleanup() {
    this.listeners.clear();
  }
}

interface ComparisonTokenProviderProps {
  children: ReactNode;
}

export function ComparisonTokenProvider({ children }: ComparisonTokenProviderProps) {
  // Create stable store instance
  const storeRef = useRef<ComparisonStore | undefined>();
  if (!storeRef.current) {
    storeRef.current = new ComparisonStore();
  }
  const store = storeRef.current;

  // Use sync external store for comparison state
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );

  // Navigation hooks
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Refs for stable references
  const initializationRef = useRef(false);
  const lastURLParamRef = useRef<string | null>(null);

  // Initialize from URL or localStorage on mount
  useEffect(() => {
    if (initializationRef.current || typeof window === 'undefined') return;

    const urlCompare = searchParams?.get('compare');
    
    if (urlCompare && isValidComparisonId(urlCompare)) {
      store.initializeFromURL(urlCompare);
      lastURLParamRef.current = urlCompare;
    } else {
      store.initializeFromStorage();
      lastURLParamRef.current = null;
    }

    initializationRef.current = true;
  }, [searchParams, store]);

  // Sync URL when compareId changes (but not during initialization)
  useEffect(() => {
    if (!state.isInitialized) return;

    const currentURLParam = searchParams?.get('compare') || null;
    
    // Only sync if the URL param differs from our current state
    if (currentURLParam !== state.compareId) {
      startTransition(() => {
        store.setURLSyncing(true);
        
        try {
          const params = new URLSearchParams(searchParams?.toString());
          
          if (state.compareId) {
            params.set('compare', state.compareId);
          } else {
            params.delete('compare');
          }

          const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
          router.replace(newUrl, { scroll: false });
          
          lastURLParamRef.current = state.compareId;
        } finally {
          // Reset syncing state after a brief delay to prevent rapid updates
          setTimeout(() => store.setURLSyncing(false), 100);
        }
      });
    }
  }, [state.compareId, state.isInitialized, pathname, router, searchParams, store]);

  // Handle external URL changes (back/forward navigation)
  useEffect(() => {
    if (!state.isInitialized) return;

    const currentURLParam = searchParams?.get('compare') || null;
    
    // If URL changed externally and we're not currently syncing
    if (currentURLParam !== lastURLParamRef.current && !state.isURLSyncing) {
      if (currentURLParam && isValidComparisonId(currentURLParam)) {
        store.setCompareId(currentURLParam);
      } else {
        store.clearComparison();
      }
      lastURLParamRef.current = currentURLParam;
    }
  }, [searchParams, state.isInitialized, state.isURLSyncing, store]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      store.cleanup();
    };
  }, [store]);

  // Create memoized selectors
  const selectors = useMemo(() => ({
    getCompareId: () => state.compareId,
    hasComparison: () => state.compareId !== null,
    isInitialized: () => state.isInitialized,
    isURLSyncing: () => state.isURLSyncing,
  }), [state]);

  // Create memoized actions
  const actions = useMemo(() => ({
    setCompareId: (id: ComparisonTokenId) => {
      if (isValidComparisonId(id)) {
        store.setCompareId(id);
      } else {
        store.clearComparison();
      }
    },
    clearComparison: () => store.clearComparison(),
  }), [store]);

  // Create context values
  const stateContextValue = useMemo(() => ({ state }), [state]);
  const actionsContextValue = useMemo(() => actions, [actions]);
  const selectorsContextValue = useMemo(() => selectors, [selectors]);

  return (
    <ComparisonStateContext.Provider value={stateContextValue}>
      <ComparisonActionsContext.Provider value={actionsContextValue}>
        <ComparisonSelectorsContext.Provider value={selectorsContextValue}>
          {children}
        </ComparisonSelectorsContext.Provider>
      </ComparisonActionsContext.Provider>
    </ComparisonStateContext.Provider>
  );
}

// Hook factories for consuming split contexts
export function useComparisonState(): ComparisonStateContextType {
  const context = useContext(ComparisonStateContext);
  if (!context) {
    throw new Error('useComparisonState must be used within a ComparisonTokenProvider');
  }
  return context;
}

export function useComparisonActions(): ComparisonActionsContextType {
  const context = useContext(ComparisonActionsContext);
  if (!context) {
    throw new Error('useComparisonActions must be used within a ComparisonTokenProvider');
  }
  return context;
}

export function useComparisonSelectors(): ComparisonSelectorsContextType {
  const context = useContext(ComparisonSelectorsContext);
  if (!context) {
    throw new Error('useComparisonSelectors must be used within a ComparisonTokenProvider');
  }
  return context;
}

// Optimized hooks for specific use cases
export function useCompareId(): ComparisonTokenId {
  const { getCompareId } = useComparisonSelectors();
  return useMemo(() => getCompareId(), [getCompareId]);
}

export function useHasComparison(): boolean {
  const { hasComparison } = useComparisonSelectors();
  return useMemo(() => hasComparison(), [hasComparison]);
}

export function useComparisonInitialized(): boolean {
  const { isInitialized } = useComparisonSelectors();
  return useMemo(() => isInitialized(), [isInitialized]);
}

// Convenience hook that combines common operations
export function useComparison() {
  const actions = useComparisonActions();
  const selectors = useComparisonSelectors();
  const { state } = useComparisonState();

  return useMemo(() => ({
    compareId: state.compareId,
    hasComparison: state.compareId !== null,
    isInitialized: state.isInitialized,
    isURLSyncing: state.isURLSyncing,
    setCompareId: actions.setCompareId,
    clearComparison: actions.clearComparison,
  }), [state, actions]);
}

// Legacy hook for backward compatibility with existing components
export function useComparisonToken() {
  return useComparison();
}