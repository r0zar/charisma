"use client";

/**
 * OrderConditionsProvider - Context provider for managing order trigger state
 * Handles trigger types, validation, and trigger-specific logic
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { TokenCacheData } from '@repo/tokens';
import { signTriggeredSwap } from 'blaze-sdk';

export type ConditionDirection = 'lt' | 'gt';

interface OrderConditionsContextType {
  // Price trigger (token price vs USD)
  hasPriceTrigger: boolean;
  priceTriggerToken: TokenCacheData | null;
  priceTargetPrice: string;
  priceDirection: ConditionDirection;

  // Ratio trigger (token A vs token B)
  hasRatioTrigger: boolean;
  ratioTriggerToken: TokenCacheData | null;
  ratioBaseToken: TokenCacheData | null;
  ratioTargetPrice: string;
  ratioDirection: ConditionDirection;

  // Time trigger (time-based execution)
  hasTimeTrigger: boolean;
  timeStartTime: string; // ISO timestamp - when to start executing
  timeEndTime: string; // ISO timestamp - when to stop executing (optional)

  // Manual execution note
  manualDescription: string;

  // Setters
  setHasPriceTrigger: (enabled: boolean) => void;
  setPriceTriggerToken: (token: TokenCacheData | null) => void;
  setPriceTargetPrice: (price: string) => void;
  setPriceDirection: (dir: ConditionDirection) => void;

  setHasRatioTrigger: (enabled: boolean) => void;
  setRatioTriggerToken: (token: TokenCacheData | null) => void;
  setRatioBaseToken: (token: TokenCacheData | null) => void;
  setRatioTargetPrice: (price: string) => void;
  setRatioDirection: (dir: ConditionDirection) => void;

  setHasTimeTrigger: (enabled: boolean) => void;
  setTimeStartTime: (time: string) => void;
  setTimeEndTime: (time: string) => void;

  setManualDescription: (description: string) => void;

  // Utility functions
  handleBumpPrice: (percent: number) => void;
  validateTriggers: () => { isValid: boolean; errors: string[] };
  resetTriggers: () => void;

  // Order creation
  isCreatingOrder: boolean;
  orderSuccessInfo: any;
  orderError: string | null;
  createOrder: (params: {
    fromToken: string;
    toToken: string;
    amountIn: string;
    walletAddress: string;
  }) => Promise<void>;
  clearOrderState: () => void;

  // Computed properties
  getPriceTriggerDisplay: () => string;
  getRatioTriggerDisplay: () => string;
  getTimeTriggerDisplay: () => string;
  getBaseAssetForApi: () => string;
  buildApiPayload: (params: {
    fromToken: string;
    toToken: string;
    amountIn: string;
    walletAddress: string;
  }) => Record<string, unknown>;
  isValidTriggers: boolean;
  isManualOrder: boolean; // True if no triggers are enabled
}

const OrderConditionsContext = createContext<OrderConditionsContextType | undefined>(undefined);

interface OrderConditionsProviderProps {
  children: React.ReactNode;
  availableTokens: TokenCacheData[];
  defaultBaseTokenId?: string;
}

export function OrderConditionsProvider({
  children,
  availableTokens,
  defaultBaseTokenId = 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt'
}: OrderConditionsProviderProps) {

  // ---------------------- Price Trigger State ----------------------
  const [hasPriceTrigger, setHasPriceTrigger] = useState(false);
  const [priceTriggerToken, setPriceTriggerToken] = useState<TokenCacheData | null>(null);
  const [priceTargetPrice, setPriceTargetPrice] = useState('');
  const [priceDirection, setPriceDirection] = useState<ConditionDirection>('gt');

  // ---------------------- Ratio Trigger State ----------------------
  const [hasRatioTrigger, setHasRatioTrigger] = useState(false);
  const [ratioTriggerToken, setRatioTriggerToken] = useState<TokenCacheData | null>(null);
  const [ratioBaseToken, setRatioBaseToken] = useState<TokenCacheData | null>(null);
  const [ratioTargetPrice, setRatioTargetPrice] = useState('');
  const [ratioDirection, setRatioDirection] = useState<ConditionDirection>('gt');

  // ---------------------- Time Trigger State ----------------------
  const [hasTimeTrigger, setHasTimeTrigger] = useState(false);
  const [timeStartTime, setTimeStartTime] = useState(''); // When to start executing
  const [timeEndTime, setTimeEndTime] = useState(''); // When to stop executing (optional)

  // ---------------------- Manual State ----------------------
  const [manualDescription, setManualDescription] = useState('');

  // ---------------------- Order Creation State ----------------------
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderSuccessInfo, setOrderSuccessInfo] = useState<any>(null);
  const [orderError, setOrderError] = useState<string | null>(null);


  // ---------------------- Computed Properties ----------------------
  const isManualOrder = !hasPriceTrigger && !hasRatioTrigger && !hasTimeTrigger;

  // ---------------------- Utility Functions ----------------------
  const handleBumpPrice = useCallback((percent: number) => {
    // Update the price for whichever trigger is currently active
    if (hasPriceTrigger) {
      const current = parseFloat(priceTargetPrice || '0');
      if (isNaN(current) || current === 0) return;
      const updated = current * (1 + percent);
      // Use toString() to avoid scientific notation from toPrecision()
      setPriceTargetPrice(updated.toString());
    } else if (hasRatioTrigger) {
      const current = parseFloat(ratioTargetPrice || '0');
      if (isNaN(current) || current === 0) return;
      const updated = current * (1 + percent);
      // Use toString() to avoid scientific notation from toPrecision()
      setRatioTargetPrice(updated.toString());
    }
  }, [hasPriceTrigger, hasRatioTrigger, priceTargetPrice, ratioTargetPrice]);

  const validateTriggers = useCallback((): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate price trigger if enabled
    if (hasPriceTrigger) {
      // If trigger token is selected, validate target price
      if (priceTriggerToken) {
        if (!priceTargetPrice || priceTargetPrice.trim() === '') {
          errors.push('Please enter a target price for price trigger');
        } else {
          const price = parseFloat(priceTargetPrice);
          if (isNaN(price) || price <= 0) {
            errors.push('Price trigger target price must be a positive number');
          }
        }
      }
      // If no trigger token selected, treat as immediate execution (no validation needed)
    }

    // Validate ratio trigger if enabled
    if (hasRatioTrigger) {
      if (!ratioTriggerToken) {
        errors.push('Please select a trigger token for ratio trigger');
      }
      if (!ratioBaseToken) {
        errors.push('Please select a base token for ratio trigger');
      }
      if (!ratioTargetPrice || ratioTargetPrice.trim() === '') {
        errors.push('Please enter a target price for ratio trigger');
      } else {
        const price = parseFloat(ratioTargetPrice);
        if (isNaN(price) || price <= 0) {
          errors.push('Ratio trigger target price must be a positive number');
        }
      }
      // Ensure trigger token and base token are different
      if (ratioTriggerToken && ratioBaseToken && ratioTriggerToken.contractId === ratioBaseToken.contractId) {
        errors.push('Ratio trigger token and base token must be different');
      }
    }

    // Validate Time trigger if enabled
    if (hasTimeTrigger) {
      // Validate start time if provided
      if (timeStartTime) {
        const startTs = Date.parse(timeStartTime);
        if (Number.isNaN(startTs)) {
          errors.push('Time trigger start time must be a valid date');
        }
      }
      // Validate end time if provided
      if (timeEndTime) {
        const endTs = Date.parse(timeEndTime);
        if (Number.isNaN(endTs)) {
          errors.push('Time trigger end time must be a valid date');
        } else if (timeStartTime && endTs <= Date.parse(timeStartTime)) {
          errors.push('Time trigger end time must be after start time');
        }
      }
    }

    // Ensure only one trigger type is enabled at a time
    const enabledCount = [hasPriceTrigger, hasRatioTrigger, hasTimeTrigger].filter(Boolean).length;
    if (enabledCount > 1) {
      errors.push('Only one trigger type can be enabled at a time');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [hasPriceTrigger, hasRatioTrigger, hasTimeTrigger, priceTriggerToken, priceTargetPrice, ratioTriggerToken, ratioBaseToken, ratioTargetPrice, timeStartTime, timeEndTime]);

  const resetTriggers = useCallback(() => {
    setHasPriceTrigger(false);
    setPriceTriggerToken(null);
    setPriceTargetPrice('');
    setPriceDirection('gt');

    setHasRatioTrigger(false);
    setRatioTriggerToken(null);
    setRatioBaseToken(null);
    setRatioTargetPrice('');
    setRatioDirection('gt');

    setHasTimeTrigger(false);
    setTimeStartTime('');
    setTimeEndTime('');

    setManualDescription('');
  }, []);

  const getPriceTriggerDisplay = useCallback((): string => {
    if (!hasPriceTrigger) return '';

    // If no trigger token selected, show immediate execution with clearer messaging
    if (!priceTriggerToken) {
      return 'Execute immediately (market order)';
    }

    // If token selected but no price, show placeholder with direction
    if (!priceTargetPrice) {
      const dirSymbol = priceDirection === 'gt' ? '>' : '<';
      return `when ${priceTriggerToken.symbol} is ${priceDirection === 'gt' ? 'greater than' : 'less than'} $0`;
    }

    // Format price using significant digits based on token unit basis
    const formatPrice = (price: string): string => {
      const num = parseFloat(price);
      if (isNaN(num)) return price;
      if (num === 0) return '0';

      // Use 4-5 significant digits, but ensure we show meaningful precision
      const magnitude = Math.floor(Math.log10(Math.abs(num)));

      if (num >= 1) {
        // For values >= 1, show 2-4 decimal places max
        return num.toFixed(Math.min(4, Math.max(2, 4 - magnitude)));
      } else {
        // For values < 1, ensure we show at least 4 significant digits
        const significantDigits = 4;
        const decimalPlaces = significantDigits - magnitude - 1;
        return num.toFixed(Math.min(8, Math.max(2, decimalPlaces)));
      }
    };

    const dirSymbol = priceDirection === 'gt' ? '≥' : '≤';
    const formattedPrice = formatPrice(priceTargetPrice);
    return `${priceTriggerToken.symbol} ${dirSymbol} ${formattedPrice} USD`;
  }, [hasPriceTrigger, priceTriggerToken, priceTargetPrice, priceDirection]);

  const getRatioTriggerDisplay = useCallback((): string => {
    if (!hasRatioTrigger) return '';

    // If no trigger token selected, show immediate execution
    if (!ratioTriggerToken) {
      return 'Execute immediately';
    }

    // If token selected but no price, show placeholder with direction and base token
    if (!ratioTargetPrice) {
      const baseUnit = ratioBaseToken?.symbol || 'sUSDT';
      return `when ${ratioTriggerToken.symbol} is ${ratioDirection === 'gt' ? 'greater than' : 'less than'} 0 ${baseUnit}`;
    }

    // Format price using significant digits based on token unit basis
    const formatPrice = (price: string): string => {
      const num = parseFloat(price);
      if (isNaN(num)) return price;
      if (num === 0) return '0';

      // Use 4-5 significant digits, but ensure we show meaningful precision
      const magnitude = Math.floor(Math.log10(Math.abs(num)));

      if (num >= 1) {
        // For values >= 1, show 2-4 decimal places max
        return num.toFixed(Math.min(4, Math.max(2, 4 - magnitude)));
      } else {
        // For values < 1, ensure we show at least 4 significant digits
        const significantDigits = 4;
        const decimalPlaces = significantDigits - magnitude - 1;
        return num.toFixed(Math.min(8, Math.max(2, decimalPlaces)));
      }
    };

    const dirSymbol = ratioDirection === 'gt' ? '≥' : '≤';
    const baseUnit = ratioBaseToken?.symbol || 'sUSDT';
    const formattedPrice = formatPrice(ratioTargetPrice);
    return `${ratioTriggerToken.symbol} ${dirSymbol} ${formattedPrice} ${baseUnit}`;
  }, [hasRatioTrigger, ratioTriggerToken, ratioTargetPrice, ratioDirection, ratioBaseToken]);

  const getTimeTriggerDisplay = useCallback((): string => {
    if (!hasTimeTrigger) return '';

    const startDisplay = timeStartTime ? new Date(timeStartTime).toLocaleString() : 'immediately';
    const endDisplay = timeEndTime ? ` until ${new Date(timeEndTime).toLocaleString()}` : '';

    if (timeStartTime && timeEndTime) {
      return `Execute between ${startDisplay} and ${new Date(timeEndTime).toLocaleString()}`;
    } else if (timeStartTime) {
      return `Execute after ${startDisplay}`;
    } else if (timeEndTime) {
      return `Execute until ${new Date(timeEndTime).toLocaleString()}`;
    } else {
      return 'Execute immediately';
    }
  }, [hasTimeTrigger, timeStartTime, timeEndTime]);

  const getBaseAssetForApi = useCallback((): string => {
    // Return the base asset for API calls - prefer ratio base token, fallback to default
    return ratioBaseToken ? ratioBaseToken.contractId : defaultBaseTokenId;
  }, [ratioBaseToken, defaultBaseTokenId]);

  // ---------------------- API Payload Builder ----------------------
  const buildApiPayload = useCallback((params: {
    fromToken: string;
    toToken: string;
    amountIn: string;
    walletAddress: string;
  }) => {
    const { fromToken, toToken, amountIn, walletAddress } = params;

    // Build payload based on enabled triggers
    let conditionToken, baseAsset, targetPrice, direction;

    if (hasPriceTrigger && hasRatioTrigger) {
      throw new Error('Cannot have both price and ratio triggers enabled simultaneously');
    }

    if (hasPriceTrigger) {
      if (priceTriggerToken && priceTargetPrice) {
        // User has configured specific price trigger
        conditionToken = priceTriggerToken.contractId;
        targetPrice = priceTargetPrice;
        direction = priceDirection;
        // No baseAsset for price triggers (undefined = USD)
      } else {
        // User selected Price Trigger but no specific conditions = immediate execution
        // Send wildcard immediate execution parameters
        conditionToken = '*'; // Wildcard for immediate execution
        targetPrice = '0'; // Zero price (always met with wildcard)
        direction = 'gt'; // Greater than 0 (always met with wildcard)
        // No baseAsset for price triggers (undefined = USD)
      }
    } else if (hasRatioTrigger) {
      if (!ratioTriggerToken || !ratioBaseToken || !ratioTargetPrice) {
        throw new Error('Ratio trigger requires trigger token, base token, and target price');
      }
      conditionToken = ratioTriggerToken.contractId;
      baseAsset = ratioBaseToken.contractId;
      targetPrice = ratioTargetPrice;
      direction = ratioDirection;
    }
    // For manual orders, all trigger fields remain undefined

    const payload: Record<string, unknown> = {
      owner: walletAddress,
      inputToken: fromToken,
      outputToken: toToken,
      amountIn,
      conditionToken,
      baseAsset,
      targetPrice,
      direction,
      recipient: walletAddress,
      uuid: globalThis.crypto?.randomUUID() ?? Date.now().toString(),
    };

    // Add manual description if it's a manual order
    if (isManualOrder && manualDescription) {
      payload.description = manualDescription;
    }

    return payload;
  }, [hasPriceTrigger, hasRatioTrigger, priceTriggerToken, priceTargetPrice, priceDirection, ratioTriggerToken, ratioBaseToken, ratioTargetPrice, ratioDirection, isManualOrder, manualDescription]);

  // ---------------------- Order Creation ----------------------
  const createOrder = useCallback(async (params: {
    fromToken: string;
    toToken: string;
    amountIn: string;
    walletAddress: string;
  }) => {
    console.log('📝 OrderConditionsContext createOrder called with:', params);

    // Debug subnet token validation
    const fromTokenInList = availableTokens.find(t => t.contractId === params.fromToken);
    console.log('🔍 Subnet token validation debug:', {
      fromTokenContractId: params.fromToken,
      tokenFoundInList: !!fromTokenInList,
      tokenType: fromTokenInList?.type,
      tokenSymbol: fromTokenInList?.symbol,
      availableTokensCount: availableTokens.length,
      subnetTokensInList: availableTokens.filter(t => t.type === 'SUBNET').map(t => ({
        contractId: t.contractId,
        symbol: t.symbol,
        type: t.type
      }))
    });

    // if from token is not a subnet token, throw an error (subnet tokens are .type = 'SUBNET')
    if (fromTokenInList?.type !== 'SUBNET') {
      console.error('❌ Subnet token validation failed:', {
        reason: fromTokenInList ? 'Token found but not SUBNET type' : 'Token not found in availableTokens',
        tokenFound: fromTokenInList,
        expectedType: 'SUBNET',
        actualType: fromTokenInList?.type
      });
      throw new Error('Must use a subnet token as the from token for triggered swaps');
    }

    setIsCreatingOrder(true);
    setOrderError(null);
    setOrderSuccessInfo(null);

    try {
      // Validate triggers first
      const validation = validateTriggers();
      if (!validation.isValid) {
        throw new Error(validation.errors[0]);
      }

      // Build API payload
      const payload = buildApiPayload(params);
      console.log('📦 Built payload:', payload);

      // Sign the transaction
      console.log('✍️ Requesting signature for triggered swap...');
      const signatureData = {
        subnet: params.fromToken,
        uuid: payload.uuid as string,
        amount: BigInt(params.amountIn),
      };

      const signature = await signTriggeredSwap(signatureData);
      console.log('✅ Signature received:', signature);

      // Add signature to payload
      payload.signature = signature;

      // Send to API
      console.log('📤 Sending order to API:', payload);
      const res = await fetch('/api/v1/orders/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('📥 API response status:', res.status);

      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'unknown' }));
        console.error('❌ API error:', j);
        throw new Error(j.error || 'Order create failed');
      }

      const result = await res.json();
      console.log('✅ Order created successfully:', result);
      setOrderSuccessInfo(result);
    } catch (err) {
      console.error('❌ Error in createOrder:', err);
      const errorMessage = err instanceof Error ? err.message : 'Order creation failed';
      setOrderError(errorMessage);
      throw err;
    } finally {
      setIsCreatingOrder(false);
    }
  }, [validateTriggers, buildApiPayload]);

  // ---------------------- Order State Management ----------------------
  const clearOrderState = useCallback(() => {
    setOrderSuccessInfo(null);
    setOrderError(null);
  }, []);

  // ---------------------- Computed Properties ----------------------
  const isValidTriggers = validateTriggers().isValid;

  // ---------------------- Effects ----------------------
  // Note: Removed auto-sync effect that was causing condition type to revert
  // The conditionType should be explicitly controlled by user interaction

  // ---------------------- Context Value ----------------------
  const contextValue: OrderConditionsContextType = {
    // Price trigger
    hasPriceTrigger,
    priceTriggerToken,
    priceTargetPrice,
    priceDirection,

    // Ratio trigger
    hasRatioTrigger,
    ratioTriggerToken,
    ratioBaseToken,
    ratioTargetPrice,
    ratioDirection,

    // Time trigger
    hasTimeTrigger,
    timeStartTime,
    timeEndTime,

    // Manual execution note
    manualDescription,

    // Setters
    setHasPriceTrigger,
    setPriceTriggerToken,
    setPriceTargetPrice,
    setPriceDirection,

    setHasRatioTrigger,
    setRatioTriggerToken,
    setRatioBaseToken,
    setRatioTargetPrice,
    setRatioDirection,

    setHasTimeTrigger,
    setTimeStartTime,
    setTimeEndTime,

    setManualDescription,

    // Utility functions
    handleBumpPrice,
    validateTriggers,
    resetTriggers,

    // Order creation
    isCreatingOrder,
    orderSuccessInfo,
    orderError,
    createOrder,
    clearOrderState,

    // Computed properties
    getPriceTriggerDisplay,
    getRatioTriggerDisplay,
    getTimeTriggerDisplay,
    getBaseAssetForApi,
    buildApiPayload,
    isValidTriggers,
    isManualOrder,
  };

  return (
    <OrderConditionsContext.Provider value={contextValue}>
      {children}
    </OrderConditionsContext.Provider>
  );
}

export function useOrderConditions() {
  const context = useContext(OrderConditionsContext);
  if (context === undefined) {
    throw new Error('useOrderConditions must be used within an OrderConditionsProvider');
  }
  return context;
}