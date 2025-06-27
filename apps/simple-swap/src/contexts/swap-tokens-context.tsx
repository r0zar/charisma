"use client";

/**
 * SwapTokensProvider - Context provider for managing all swap token state
 * Handles URL parameters, localStorage persistence, and token initialization
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { TokenCacheData } from '@repo/tokens';
import { saveSwapPreferences, loadBasicPreferences, loadTokenPreferences as loadTokenPreferencesFromStorage, clearTokenPreferences } from '../lib/swap-storage';
import { listTokens as fetchAllTokensServerAction } from '../app/actions';
import { formatTokenAmount, convertToMicroUnits } from '../lib/swap-utils';

interface ValidationAlert {
  id: string;
  type: 'swap' | 'order';
  message: string;
  requirements: string[];
  timestamp: number;
}

interface SwapTokensContextType {
  // Current token state
  selectedTokens: TokenCacheData[];
  selectedFromToken: TokenCacheData | null;
  selectedToToken: TokenCacheData | null;
  conditionToken: TokenCacheData | null;
  baseToken: TokenCacheData | null;
  baseSelectedFromToken: TokenCacheData | null;
  baseSelectedToToken: TokenCacheData | null;

  // Mode and UI state
  mode: 'swap' | 'order';
  useSubnetFrom: boolean;
  useSubnetTo: boolean;
  targetPrice: string;
  conditionDir: 'lt' | 'gt';
  conditionType: 'price' | 'ratio';
  displayAmount: string;

  // Loading states
  isInitializing: boolean;
  isLoadingTokens: boolean;
  error: string | null;

  // Setters
  setSelectedTokens: (tokens: TokenCacheData[]) => void;
  setSelectedFromToken: (token: TokenCacheData) => void;
  setSelectedToToken: (token: TokenCacheData) => void;
  setConditionToken: (token: TokenCacheData | null) => void;
  setBaseToken: (token: TokenCacheData | null) => void;
  setBaseSelectedFromToken: (token: TokenCacheData | null) => void;
  setBaseSelectedToToken: (token: TokenCacheData | null) => void;
  setMode: (mode: 'swap' | 'order') => void;
  setUseSubnetFrom: (use: boolean) => void;
  setUseSubnetTo: (use: boolean) => void;
  setTargetPrice: (price: string) => void;
  setConditionDir: (dir: 'lt' | 'gt') => void;
  setConditionType: (type: 'price' | 'ratio') => void;
  setDisplayAmount: (amount: string) => void;

  // URL params and initialization
  urlParams: Record<string, string | undefined>;
  initDone: boolean;
  setInitDone: (done: boolean) => void;

  // localStorage functions
  saveTokenPreferences: () => void;
  loadTokenPreferences: () => void;
  clearTokenPreferences: () => void;

  // Token switching functions (now handle amount calculations too)
  handleSwitchTokens: (quote?: any, microAmount?: string, setDisplayAmount?: (amount: string) => void, setMicroAmount?: (amount: string) => void) => void;
  handleSwitchTokensEnhanced: (quote?: any, microAmount?: string, setDisplayAmount?: (amount: string) => void, setMicroAmount?: (amount: string) => void) => void;

  // Price management functions
  handleBumpPrice: (percent: number) => void;

  // Simplified token helpers
  displayTokens: TokenCacheData[];
  subnetDisplayTokens: TokenCacheData[];
  hasBothVersions: (token: TokenCacheData | null) => boolean;
  setSelectedFromTokenSafe: (token: TokenCacheData) => void;

  // UI Helper Logic
  displayedFromToken: TokenCacheData | null;
  displayedToToken: TokenCacheData | null;

  // Error handling
  setError: (error: string | null) => void;

  // Validation alerts
  validationAlert: ValidationAlert | null;
  setValidationAlert: (alert: ValidationAlert | null) => void;
  clearValidationAlert: () => void;
  triggerValidationAlert: (type: 'swap' | 'order') => void;

  // DCA dialog
  isDcaDialogOpen: boolean;
  setIsDcaDialogOpen: (open: boolean) => void;

  // Burn-swap forcing
  forceBurnSwap: boolean;
  setForceBurnSwap: (force: boolean) => void;
}

const SwapTokensContext = createContext<SwapTokensContextType | undefined>(undefined);

interface SwapTokensProviderProps {
  children: React.ReactNode;
  initialTokens?: TokenCacheData[];
  searchParams?: URLSearchParams;
}

export function SwapTokensProvider({
  children,
  initialTokens = [],
  searchParams
}: SwapTokensProviderProps) {

  // ---------------------- Core State ----------------------
  const [selectedTokens, setSelectedTokens] = useState<TokenCacheData[]>(initialTokens);
  const [selectedFromToken, setSelectedFromToken] = useState<TokenCacheData | null>(null);
  const [selectedToToken, setSelectedToToken] = useState<TokenCacheData | null>(null);
  const [conditionToken, setConditionToken] = useState<TokenCacheData | null>(null);
  const [baseToken, setBaseToken] = useState<TokenCacheData | null>(null);
  const [baseSelectedFromToken, setBaseSelectedFromToken] = useState<TokenCacheData | null>(null);
  const [baseSelectedToToken, setBaseSelectedToToken] = useState<TokenCacheData | null>(null);

  // Mode and UI state
  const [mode, setMode] = useState<'swap' | 'order'>('swap');
  const [useSubnetFrom, setUseSubnetFrom] = useState(false);
  const [useSubnetTo, setUseSubnetTo] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [conditionDir, setConditionDir] = useState<'lt' | 'gt'>('gt');
  const [conditionType, setConditionType] = useState<'price' | 'ratio'>('price');
  const [displayAmount, setDisplayAmount] = useState('');

  // Initialization tracking
  const [initDone, setInitDone] = useState(false);

  // Loading states
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation alert state
  const [validationAlert, setValidationAlert] = useState<ValidationAlert | null>(null);

  // DCA dialog state
  const [isDcaDialogOpen, setIsDcaDialogOpen] = useState(false);

  // Burn-swap forcing state
  const [forceBurnSwap, setForceBurnSwap] = useState(false);

  // Ref to track previous mode for order mode defaults
  const prevModeRef = useRef<string>(mode);

  // ---------------------- URL Parameter Handling ----------------------
  const urlParams = useMemo(() => {
    if (!searchParams) return {};
    return {
      fromSymbol: searchParams.get('fromSymbol') ?? undefined,
      toSymbol: searchParams.get('toSymbol') ?? undefined,
      amount: searchParams.get('amount') ?? undefined,
      mode: searchParams.get('mode') as 'swap' | 'order' | undefined,
      targetPrice: searchParams.get('targetPrice') ?? undefined,
      direction: searchParams.get('direction') as 'lt' | 'gt' | undefined,
      conditionToken: searchParams.get('conditionToken') ?? undefined,
      baseAsset: searchParams.get('baseAsset') ?? undefined,
      fromSubnet: searchParams.get('fromSubnet') ?? undefined,
      toSubnet: searchParams.get('toSubnet') ?? undefined,
    };
  }, [searchParams]);

  // ---------------------- localStorage Functions ----------------------
  const saveTokenPreferences = useCallback(() => {
    saveSwapPreferences({
      fromToken: selectedFromToken ? {
        contractId: selectedFromToken.contractId,
        symbol: selectedFromToken.symbol,
        type: selectedFromToken.type
      } : undefined,
      toToken: selectedToToken ? {
        contractId: selectedToToken.contractId,
        symbol: selectedToToken.symbol,
        type: selectedToToken.type
      } : undefined,
      conditionToken: conditionToken ? {
        contractId: conditionToken.contractId,
        symbol: conditionToken.symbol,
        type: conditionToken.type
      } : undefined,
      baseToken: baseToken ? {
        contractId: baseToken.contractId,
        symbol: baseToken.symbol,
        type: baseToken.type
      } : undefined,
      mode,
      useSubnetFrom,
      useSubnetTo
    });
  }, [selectedFromToken, selectedToToken, conditionToken, baseToken, mode, useSubnetFrom, useSubnetTo]);

  // Load basic preferences (mode and subnet toggles) immediately on mount
  const loadBasicPreferencesOnMount = useCallback(() => {
    // Only apply saved preferences if no URL parameters are present
    const hasUrlParams = !!(urlParams.fromSymbol || urlParams.toSymbol || urlParams.mode ||
      urlParams.fromSubnet || urlParams.toSubnet);

    console.debug('localStorage loading check:', {
      hasUrlParams,
      urlParams
    });

    if (hasUrlParams) {
      console.debug('Skipping localStorage load due to URL params:', urlParams);
      return;
    }

    const basicPrefs = loadBasicPreferences();
    const { mode: savedMode, useSubnetFrom: savedUseSubnetFrom, useSubnetTo: savedUseSubnetTo } = basicPrefs;

    console.debug('Loading localStorage preferences:', {
      savedMode,
      savedUseSubnetFrom,
      savedUseSubnetTo,
      currentMode: mode,
      currentUseSubnetFrom: useSubnetFrom,
      currentUseSubnetTo: useSubnetTo
    });

    // Load mode immediately
    if (savedMode && (savedMode === 'swap' || savedMode === 'order') && savedMode !== mode) {
      console.debug('Setting mode from localStorage:', savedMode);
      setMode(savedMode);
    }

    // Load subnet toggles immediately
    if (typeof savedUseSubnetFrom === 'boolean' && savedUseSubnetFrom !== useSubnetFrom) {
      console.debug('Setting useSubnetFrom from localStorage:', savedUseSubnetFrom);
      setUseSubnetFrom(savedUseSubnetFrom);
    }

    if (typeof savedUseSubnetTo === 'boolean' && savedUseSubnetTo !== useSubnetTo) {
      console.debug('Setting useSubnetTo from localStorage:', savedUseSubnetTo);
      setUseSubnetTo(savedUseSubnetTo);
    }
  }, [urlParams, mode, useSubnetFrom, useSubnetTo]);

  // Load token preferences from localStorage
  const loadTokenPreferences = useCallback(() => {
    if (!selectedTokens.length) return;

    // Only apply saved preferences if no URL parameters are present
    const hasUrlParams = urlParams.fromSymbol || urlParams.toSymbol || urlParams.mode;
    if (hasUrlParams) return;

    const tokenPrefs = loadTokenPreferencesFromStorage(selectedTokens);
    const { fromToken: savedFromToken, toToken: savedToToken, conditionToken: savedConditionToken, baseToken: savedBaseToken } = tokenPrefs;

    // Apply found tokens to state
    if (savedFromToken && !selectedFromToken) {
      setSelectedFromToken(savedFromToken);
      setBaseSelectedFromToken(savedFromToken);
    }

    if (savedToToken && !selectedToToken) {
      setSelectedToToken(savedToToken);
      setBaseSelectedToToken(savedToToken);
    }

    if (savedConditionToken && !conditionToken) {
      setConditionToken(savedConditionToken);
    }

    if (savedBaseToken && !baseToken) {
      setBaseToken(savedBaseToken);
    }
  }, [selectedTokens, selectedFromToken, selectedToToken, conditionToken, baseToken, urlParams]);

  // Initialize component state from URL parameters once tokens are ready
  const initializeFromUrlParams = useCallback(() => {
    if (initDone || !selectedTokens.length) return;

    const { mode: m, targetPrice: tp, direction: dir, fromSymbol, toSymbol, amount } = urlParams;

    if (m === 'order') {
      setMode('order');
    }
    if (tp) setTargetPrice(tp);
    if (dir === 'lt' || dir === 'gt') setConditionDir(dir);

    if (fromSymbol) {
      const t = selectedTokens.find(tok => tok.symbol.toLowerCase() === fromSymbol.toLowerCase());
      if (t) {
        setBaseSelectedFromToken(t);
        setSelectedFromToken(t);
      }
    }

    if (toSymbol) {
      const t = selectedTokens.find(tok => tok.symbol.toLowerCase() === toSymbol.toLowerCase());
      if (t) {
        setBaseSelectedToToken(t);
        setSelectedToToken(t);
      }
    }

    if (amount && !isNaN(Number(amount))) {
      setDisplayAmount(amount);
    }

    // Apply subnet toggle preferences from deep link
    const fromSubnetFlag = urlParams.fromSubnet === '1' || urlParams.fromSubnet === 'true';
    const toSubnetFlag = urlParams.toSubnet === '1' || urlParams.toSubnet === 'true';

    if (fromSubnetFlag) {
      setUseSubnetFrom(true);
    }
    if (toSubnetFlag) {
      setUseSubnetTo(true);
    }

    if (urlParams.conditionToken) {
      const t = selectedTokens.find(tok => tok.symbol.toLowerCase() === urlParams.conditionToken!.toLowerCase());
      if (t) {
        setConditionToken(t);
      }
    }

    if (urlParams.baseAsset) {
      const t = selectedTokens.find(tok => tok.symbol.toLowerCase() === urlParams.baseAsset!.toLowerCase());
      if (t) {
        setBaseToken(t);
      }
    }

    setInitDone(true);
  }, [initDone, selectedTokens, urlParams]);

  // ---------------------- Token Switching Functions ----------------------

  // Token switching with optional amount calculations
  const handleSwitchTokens = useCallback((quote?: any, microAmount?: string, setDisplayAmount?: (amount: string) => void, setMicroAmount?: (amount: string) => void) => {
    if (!selectedFromToken || !selectedToToken) return;

    // Store the current tokens before switching for amount calculations
    const currentFromToken = selectedFromToken;
    const currentToToken = selectedToToken;

    // Switch the tokens
    setSelectedFromToken(currentToToken);
    setSelectedToToken(currentFromToken);

    // Handle amount calculations if callbacks are provided
    if (setDisplayAmount && setMicroAmount) {
      // Handle amount reversal - use current output amount as new input amount
      if (quote && quote.amountOut) {
        // Use the current output amount as the new display amount
        const newDisplayAmount = formatTokenAmount(Number(quote.amountOut), currentToToken.decimals || 0);
        setDisplayAmount(newDisplayAmount);

        // Update microAmount for the new "from" token (which is the current "to" token)
        setMicroAmount(convertToMicroUnits(newDisplayAmount, currentToToken.decimals || 0));
      } else {
        // If no quote, just recalculate microAmount with current display amount for new token
        setMicroAmount(convertToMicroUnits(displayAmount, currentToToken.decimals || 0));
      }
    }
  }, [selectedFromToken, selectedToToken, displayAmount]);

  // Enhanced token switch handler that also swaps subnet toggles and base tokens
  const handleSwitchTokensEnhanced = useCallback((quote?: any, microAmount?: string, setDisplayAmount?: (amount: string) => void, setMicroAmount?: (amount: string) => void) => {
    if (!selectedFromToken || !selectedToToken) return;

    // Basic token switch (with amount calculations if provided)
    handleSwitchTokens(quote, microAmount, setDisplayAmount, setMicroAmount);

    // Also swap the base token selections for UI consistency
    setBaseSelectedFromToken(baseSelectedToToken);
    setBaseSelectedToToken(baseSelectedFromToken);

    // Swap subnet toggles
    const prevFrom = useSubnetFrom;
    setUseSubnetFrom(useSubnetTo);
    setUseSubnetTo(prevFrom);
  }, [selectedFromToken, selectedToToken, handleSwitchTokens, baseSelectedFromToken, baseSelectedToToken, useSubnetFrom, useSubnetTo]);

  // ---------------------- Price Management Functions ----------------------
  const handleBumpPrice = useCallback((percent: number) => {
    const current = parseFloat(targetPrice || '0');
    if (isNaN(current) || current === 0) return;
    const updated = current * (1 + percent);
    setTargetPrice(updated.toPrecision(9));
  }, [targetPrice, setTargetPrice]);

  // ---------------------- Validation Alert Functions ----------------------
  const clearValidationAlert = useCallback(() => {
    setValidationAlert(null);
  }, []);

  const triggerValidationAlert = useCallback((type: 'swap' | 'order') => {
    const alert: ValidationAlert = {
      id: `validation-${Date.now()}`,
      type,
      message: type === 'swap' ? 'Cannot execute swap' : 'Cannot create order',
      requirements: [],
      timestamp: Date.now()
    };
    setValidationAlert(alert);
  }, []);

  // ---------------------- Simplified Token Logic ----------------------
  // Simple token filtering - no complex mapping needed since BlazeProvider handles balance data
  const { displayTokens, subnetDisplayTokens } = useMemo(() => {
    console.log('[SwapTokensContext] Computing displayTokens, selectedTokens.length:', selectedTokens.length);

    if (!selectedTokens || selectedTokens.length === 0) {
      return {
        displayTokens: [],
        subnetDisplayTokens: []
      };
    }

    // Log CORGI in selectedTokens
    const corgiInSelected = selectedTokens.find(t =>
      t.contractId?.includes('charismatic-corgi-liquidity') || t.symbol === 'CORGI'
    );
    console.log('[SwapTokensContext] CORGI in selectedTokens:', corgiInSelected);

    // Mainnet tokens: type !== 'SUBNET'
    const mainnetTokens = selectedTokens.filter(t => t.type !== 'SUBNET');
    // Subnet tokens: type === 'SUBNET'
    const subnetTokens = selectedTokens.filter(t => t.type === 'SUBNET');

    console.log('[SwapTokensContext] Token filtering:', {
      total: selectedTokens.length,
      mainnet: mainnetTokens.length,
      subnet: subnetTokens.length
    });

    // Check if CORGI makes it through the filter
    const corgiInMainnet = mainnetTokens.find(t =>
      t.contractId?.includes('charismatic-corgi-liquidity') || t.symbol === 'CORGI'
    );
    console.log('[SwapTokensContext] CORGI in mainnet tokens:', corgiInMainnet);

    const sortedDisplayTokens = mainnetTokens.sort((a, b) => a.symbol.localeCompare(b.symbol));
    const sortedSubnetTokens = subnetTokens.sort((a, b) => a.symbol.localeCompare(b.symbol));

    console.log('[SwapTokensContext] Final displayTokens count:', sortedDisplayTokens.length);

    return {
      displayTokens: sortedDisplayTokens,
      subnetDisplayTokens: sortedSubnetTokens
    };
  }, [selectedTokens]);

  const hasBothVersions = useCallback((token: TokenCacheData | null): boolean => {
    if (!token) return false;

    if (token.type === 'SUBNET') {
      // Subnet token: check if mainnet version exists
      return !!(token.base && selectedTokens.find(t => t.contractId === token.base && t.type !== 'SUBNET'));
    } else {
      // Mainnet token: check if subnet version exists
      return !!selectedTokens.find(t => t.base === token.contractId && t.type === 'SUBNET');
    }
  }, [selectedTokens]);

  // Safe setter that optionally forces subnet version if in order mode
  const setSelectedFromTokenSafe = useCallback((t: TokenCacheData) => {
    if (t.type !== 'SUBNET' && mode === 'order') {
      // If user tries to select a non-subnet token in order mode,
      // check if the token has a subnet version
      if (!hasBothVersions(t)) {
        // Token doesn't have subnet support, switch to swap mode
        setMode('swap');
        setSelectedFromToken(t);
        return;
      }
      // Token has subnet support, don't set it (keep existing behavior)
      return;
    }
    setSelectedFromToken(t);
  }, [mode, hasBothVersions]);

  // ---------------------- UI Helper Logic ----------------------
  // Determine which tokens are currently displayed in dropdowns (show base/mainnet versions for dropdowns)
  const displayedFromToken = useMemo(() => {
    if (!selectedFromToken) return null;

    // If it's already a mainnet token, return it
    if (selectedFromToken.type !== 'SUBNET') return selectedFromToken;

    // If it's a subnet token, find the mainnet version
    return displayTokens.find(dt => dt.contractId === selectedFromToken.base) || selectedFromToken;
  }, [selectedFromToken, displayTokens]);

  const displayedToToken = useMemo(() => {
    if (!selectedToToken) return null;

    // If it's already a mainnet token, return it
    if (selectedToToken.type !== 'SUBNET') return selectedToToken;

    // If it's a subnet token, find the mainnet version
    return displayTokens.find(dt => dt.contractId === selectedToToken.base) || selectedToToken;
  }, [selectedToToken, displayTokens]);

  // ---------------------- Effects ----------------------
  // Load basic preferences immediately on mount (run only once)
  useEffect(() => {
    loadBasicPreferencesOnMount();
  }, []); // Run only once on mount

  // Initialize from URL parameters when tokens are ready
  useEffect(() => {
    initializeFromUrlParams();
  }, [initializeFromUrlParams]);

  // Save preferences whenever tokens change
  useEffect(() => {
    if (initDone && selectedTokens.length > 0) {
      saveTokenPreferences();
    }
  }, [selectedFromToken, selectedToToken, conditionToken, baseToken, mode, useSubnetFrom, useSubnetTo, initDone, selectedTokens.length, saveTokenPreferences]);

  // Auto-dismiss validation alert when requirements are satisfied
  useEffect(() => {
    if (!validationAlert) return;

    const hasSelectedTokens = selectedFromToken && selectedToToken;
    const hasAmount = displayAmount && displayAmount !== "0" && displayAmount.trim() !== "";
    const hasTargetPrice = validationAlert.type === 'swap' || (targetPrice && targetPrice !== '');

    // If all requirements are now satisfied, dismiss the alert
    if (hasSelectedTokens && hasAmount && hasTargetPrice) {
      clearValidationAlert();
    }
  }, [validationAlert, selectedFromToken, selectedToToken, displayAmount, targetPrice, clearValidationAlert]);

  // Load preferences after tokens are loaded and URL params are processed
  useEffect(() => {
    if (initDone && selectedTokens.length > 0) {
      loadTokenPreferences();
    }
  }, [initDone, selectedTokens.length, loadTokenPreferences]);

  // ---------------------- Token Loading Logic ----------------------
  // Token loading logic (server‑prefetched vs. client fetch)
  useEffect(() => {
    async function fetchTokensClient() {
      setIsLoadingTokens(true);
      setError(null);
      try {
        // Step 1: Fetch all tokens with full metadata
        const allTokensResult = await fetchAllTokensServerAction();

        console.log('[SwapTokensContext] Token fetch result:', {
          success: allTokensResult.success,
          tokensCount: allTokensResult.tokens?.length,
          error: allTokensResult.error
        });

        if (!allTokensResult.success || !allTokensResult.tokens) {
          setError("Failed to load token list.");
          setIsLoadingTokens(false); // Ensure loading state is reset
          setIsInitializing(false);
          return;
        }

        // Use all tokens for now; routeableTokenIds will be filtered by useRouter hook
        setSelectedTokens(allTokensResult.tokens || []);

        console.log('[SwapTokensContext] Set selectedTokens:', allTokensResult.tokens?.length);

      } catch (err) {
        setError("Failed to load tokens. Please try again later.");
      } finally {
        setIsLoadingTokens(false);
        setIsInitializing(false);
      }
    }

    // Only fetch tokens if we don't have initial tokens and we haven't already loaded them
    if (initialTokens.length === 0 && selectedTokens.length === 0) {
      fetchTokensClient();
    } else if (initialTokens.length > 0) {
      // If we have initial tokens, just mark as not initializing
      setIsInitializing(false);
    }
  }, [initialTokens.length, selectedTokens.length]);

  // ---------------------- Mode Change Effect ----------------------
  // Effect to handle mode changes, specifically defaulting for 'order' mode
  useEffect(() => {
    // Update prevModeRef *after* checking the condition
    const prevMode = prevModeRef.current;
    prevModeRef.current = mode;
    // Only default condition token when switching *into* order mode and not deep-linked tokens
    if (mode === 'order' && prevMode !== 'order' && !conditionToken && !urlParams.fromSymbol && !urlParams.toSymbol) {
      // Locate the base (main-net) sBTC token in the available list
      const sbtcBase = displayTokens.find((t) => t.contractId.includes('.sbtc-token'));
      const charismaBase = displayTokens.find((t) => t.contractId.includes('.charisma-token'));

      if (!sbtcBase) {
        return;
      }

      // 1. Select sBTC as the base FROM token - REQUIRED for subnet toggle effect
      setBaseSelectedFromToken(charismaBase!);
      setSelectedFromTokenSafe(charismaBase!);
      setBaseToken(charismaBase!)

      // 2. Enable subnet mode for FROM token
      setUseSubnetFrom(true);

      // 3. Set the condition token to sBTC (prefer subnet version if available)
      const sbtcSubnet = subnetDisplayTokens.find(t => t.base === sbtcBase.contractId);
      const sbtcToSet = sbtcSubnet ?? sbtcBase;
      setConditionToken(sbtcToSet);
    }
    // No else needed - we don't want to interfere if the mode is not 'order' or if a token is already selected
  }, [mode, conditionToken, displayTokens, subnetDisplayTokens, setSelectedFromTokenSafe, urlParams.fromSymbol, urlParams.toSymbol]);

  // ---------------------- Context Value ----------------------
  const contextValue: SwapTokensContextType = {
    // Current token state
    selectedTokens,
    selectedFromToken,
    selectedToToken,
    conditionToken,
    baseToken,
    baseSelectedFromToken,
    baseSelectedToToken,

    // Mode and UI state
    mode,
    useSubnetFrom,
    useSubnetTo,
    targetPrice,
    conditionDir,
    conditionType,
    displayAmount,

    // Setters
    setSelectedTokens,
    setSelectedFromToken,
    setSelectedToToken,
    setConditionToken,
    setBaseToken,
    setBaseSelectedFromToken,
    setBaseSelectedToToken,
    setMode,
    setUseSubnetFrom,
    setUseSubnetTo,
    setTargetPrice,
    setConditionDir,
    setConditionType,
    setDisplayAmount,

    // URL params and initialization
    urlParams,
    initDone,
    setInitDone,

    // Loading states
    isInitializing,
    isLoadingTokens,
    error,

    // localStorage functions
    saveTokenPreferences,
    loadTokenPreferences,
    clearTokenPreferences,

    // Token switching functions
    handleSwitchTokens,
    handleSwitchTokensEnhanced,

    // Price management functions
    handleBumpPrice,

    // Simplified token helpers
    displayTokens,
    subnetDisplayTokens,
    hasBothVersions,
    setSelectedFromTokenSafe,

    // UI Helper Logic
    displayedFromToken,
    displayedToToken,

    // Error handling
    setError,

    // Validation alerts
    validationAlert,
    setValidationAlert,
    clearValidationAlert,
    triggerValidationAlert,

    // DCA dialog
    isDcaDialogOpen,
    setIsDcaDialogOpen,

    // Burn-swap forcing
    forceBurnSwap,
    setForceBurnSwap,
  };

  return (
    <SwapTokensContext.Provider value={contextValue}>
      {children}
    </SwapTokensContext.Provider>
  );
}

export function useSwapTokens() {
  const context = useContext(SwapTokensContext);
  if (context === undefined) {
    throw new Error('useSwapTokens must be used within a SwapTokensProvider');
  }
  return context;
}