/*--------------------------------------------------------------
 * Burn-Swapper Client ― LP Token Arbitrage Routing (Standalone)
 *
 *  ‣ Burn LP tokens to underlying assets
 *  ‣ Route each asset optimally through multihop
 *  ‣ Support for 0-4 hops per asset (25 total functions)
 *  ‣ Automatic function selection based on routes
 *  ‣ Complete coverage for all routing scenarios
 *
 *  Standalone implementation to avoid circular dependencies.
 *-------------------------------------------------------------*/

import {
  uintCV,
  principalCV,
  tupleCV,
  someCV,
  bufferCV,
  ClarityValue,
  PostConditionModeName,
  PostCondition,
  Pc,
} from '@stacks/transactions';
import { Vault, Token, Hop } from '.';

/*************  Local Types & Interfaces  *************/

// Use Vault interface from main router instead of separate BurnSwapVault

export interface BurnSwapToken {
  contractId: string;
  symbol: string;
  identifier: string;
}

// Use Hop interface from main router instead of separate BurnSwapHop

export interface BurnSwapRouteResult {
  tokenA: {
    amount: number;
    hops: {
      path: any[];
      hops: Hop[];
      amountIn: number;
      amountOut: number;
    };
    outputToken: string;
    finalAmount: number;
  } | null;
  tokenB: {
    amount: number;
    hops: {
      path: any[];
      hops: Hop[];
      amountIn: number;
      amountOut: number;
    };
    outputToken: string;
    finalAmount: number;
  } | null;
  totalOutput: number;
  pattern: string; // e.g., "1-2" for 1-hop tokenA, 2-hop tokenB
}

export interface BurnSwapConfig {
  contractId: string; // burn-swapper contract address
  debug?: boolean;
  getQuote?: (fromToken: string, toToken: string, amount: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getLPRemovalQuote?: (lpVault: Vault, lpAmount: number) => Promise<BurnSwapQuote | null>;
}

export interface BurnSwapQuote {
  dx: number; // tokenA amount from LP burn
  dy: number; // tokenB amount from LP burn
  dk: number; // LP amount burned
}

// Router interface for dependency injection
export interface RouterLike {
  findBestRoute(from: string, to: string, amount: number): Promise<RouteResult | Error>;
}

export interface RouteResult {
  hops: Hop[];
  amountOut: number;
}

/*************  Helper Functions  *************/

// Helper to create opcode CV
const createOpcodeCV = (op: number): ClarityValue => {
  const b = new Uint8Array(16).fill(0);
  b[0] = op;
  return someCV(bufferCV(b));
};

/**
 * Determine pattern string from hop counts
 */
const getPattern = (tokenAHops: number, tokenBHops: number): string => {
  return `${tokenAHops}-${tokenBHops}`;
};

/**
 * Get burn-swapper function name from pattern
 */
const getFunctionName = (pattern: string): string => {
  return `execute-burn-swap-${pattern}`;
};

/**
 * Create hop tuple CV for different hop counts
 */
const createHopTuples = (hops: Hop[], hopCount: number): ClarityValue => {
  if (hopCount === 1) {
    return tupleCV({
      pool: principalCV(hops[0].vault.contractId),
      opcode: createOpcodeCV(hops[0].opcode)
    });
  } else if (hopCount === 2) {
    return tupleCV({
      'hop-1': tupleCV({
        pool: principalCV(hops[0].vault.contractId),
        opcode: createOpcodeCV(hops[0].opcode)
      }),
      'hop-2': tupleCV({
        pool: principalCV(hops[1].vault.contractId),
        opcode: createOpcodeCV(hops[1].opcode)
      })
    });
  } else if (hopCount === 3) {
    return tupleCV({
      'hop-1': tupleCV({
        pool: principalCV(hops[0].vault.contractId),
        opcode: createOpcodeCV(hops[0].opcode)
      }),
      'hop-2': tupleCV({
        pool: principalCV(hops[1].vault.contractId),
        opcode: createOpcodeCV(hops[1].opcode)
      }),
      'hop-3': tupleCV({
        pool: principalCV(hops[2].vault.contractId),
        opcode: createOpcodeCV(hops[2].opcode)
      })
    });
  } else if (hopCount === 4) {
    return tupleCV({
      'hop-1': tupleCV({
        pool: principalCV(hops[0].vault.contractId),
        opcode: createOpcodeCV(hops[0].opcode)
      }),
      'hop-2': tupleCV({
        pool: principalCV(hops[1].vault.contractId),
        opcode: createOpcodeCV(hops[1].opcode)
      }),
      'hop-3': tupleCV({
        pool: principalCV(hops[2].vault.contractId),
        opcode: createOpcodeCV(hops[2].opcode)
      }),
      'hop-4': tupleCV({
        pool: principalCV(hops[3].vault.contractId),
        opcode: createOpcodeCV(hops[3].opcode)
      })
    });
  }

  throw new Error(`Unsupported hop count: ${hopCount}`);
};

/*************  Main BurnSwapper Class  *************/

export class BurnSwapper {
  private config: BurnSwapConfig;
  private router: RouterLike;

  constructor(config: BurnSwapConfig, router: RouterLike) {
    this.config = config;
    this.router = router;
  }

  /**
   * Get LP removal quote (dx/dy amounts from burning LP tokens)
   */
  async getLPRemovalQuote(
    lpVault: Vault,
    lpAmount: number
  ): Promise<BurnSwapQuote | null> {
    if (this.config.getLPRemovalQuote) {
      return await this.config.getLPRemovalQuote(lpVault, lpAmount);
    }

    if (this.config.debug) {
      console.warn('getLPRemovalQuote not implemented - host application should provide this via config');
    }
    return null;
  }

  /**
   * Process route result from either API response or router response
   */
  private processRouteResult(routeResult: any, amount: number, targetToken: string, startToken: Token) {
    // Handle API response format
    if (routeResult && typeof routeResult === 'object' && 'success' in routeResult) {
      if (routeResult.success && routeResult.data) {
        return {
          amount,
          hops: routeResult.data,
          outputToken: targetToken,
          finalAmount: routeResult.data.amountOut,
        };
      }
      return null;
    }

    // Handle direct router response format
    if (routeResult && !(routeResult instanceof Error)) {
      return {
        amount,
        hops: routeResult.hops,
        outputToken: targetToken,
        finalAmount: routeResult.amountOut,
      };
    }

    return null;
  }

  /**
   * Find optimal burn-swap routes for LP token
   */
  async findBurnSwapRoutes(
    lpVault: Vault,
    lpAmount: number,
    targetToken: string
  ): Promise<BurnSwapRouteResult | null> {
    try {
      // Step 1: Get LP removal quote
      const lpQuote = await this.getLPRemovalQuote(lpVault, lpAmount);
      if (!lpQuote) {
        if (this.config.debug) {
          console.error('Failed to get LP removal quote');
        }
        return null;
      }

      console.log(lpVault.tokenA)
      // Step 2: Find routes for both underlying tokens
      const [routeA, routeB] = await Promise.all([
        lpQuote.dx > 0
          ? this.config.getQuote
            ? this.config.getQuote(lpVault.tokenA.contractId, targetToken, lpQuote.dx.toString())
            : this.router.findBestRoute(lpVault.tokenA.contractId, targetToken, lpQuote.dx)
          : null,
        lpQuote.dy > 0
          ? this.config.getQuote
            ? this.config.getQuote(lpVault.tokenB.contractId, targetToken, lpQuote.dy.toString())
            : this.router.findBestRoute(lpVault.tokenB.contractId, targetToken, lpQuote.dy)
          : null,
      ]);

      // Step 3: Process routes
      const tokenARoute = routeA && this.processRouteResult(routeA, lpQuote.dx, targetToken, lpVault.tokenA);
      const tokenBRoute = routeB && this.processRouteResult(routeB, lpQuote.dy, targetToken, lpVault.tokenB);

      // Calculate totals and pattern
      const totalOutput = (tokenARoute?.finalAmount || 0) + (tokenBRoute?.finalAmount || 0);
      const pattern = getPattern(
        tokenARoute?.hops?.hops?.length || 0,
        tokenBRoute?.hops?.hops?.length || 0
      );

      return {
        tokenA: tokenARoute,
        tokenB: tokenBRoute,
        totalOutput,
        pattern,
      };

    } catch (error) {
      if (this.config.debug) {
        console.error('Burn-swap route finding failed:', error);
      }
      return null;
    }
  }

  /**
   * Build burn-swap transaction for execution
   */
  async buildBurnSwapTransaction(
    burnSwapRoute: BurnSwapRouteResult,
    lpVault: Vault,
    lpAmount: number,
    sender: string,
    slippageTolerance = 0.05
  ): Promise<any> {
    const { tokenA, tokenB, pattern } = burnSwapRoute;

    if (!tokenA && !tokenB) {
      throw new Error('No valid routes found');
    }

    // Get final token contracts
    const tokenAFinal = tokenA?.outputToken || lpVault.tokenA.contractId;
    const tokenBFinal = tokenB?.outputToken || lpVault.tokenB.contractId;

    // Build function arguments based on pattern
    const functionName = getFunctionName(pattern);
    let functionArgs: ClarityValue[] = [
      principalCV(lpVault.contractId), // lp-pool
      principalCV(lpVault.contractId), // lp-token (same as pool for most cases)
      uintCV(lpAmount), // lp-amount
    ];

    // Add token contracts and hops based on pattern
    const [tokenAHops, tokenBHops] = pattern.split('-').map(Number);

    // Handle different argument patterns based on hop counts
    if (tokenAHops === 0 && tokenBHops === 0) {
      // 0-0: Direct transfers only
      functionArgs.push(
        principalCV(lpVault.tokenA.contractId), // token-a
        principalCV(lpVault.tokenB.contractId)  // token-b
      );
    } else if (tokenAHops === 0) {
      // 0-X: Token A direct, Token B has hops
      functionArgs.push(
        principalCV(lpVault.tokenA.contractId), // token-a
        principalCV(tokenBFinal), // token-b-final
        createHopTuples(tokenB!.hops.hops, tokenBHops) // token-b-hops
      );
    } else if (tokenBHops === 0) {
      // X-0: Token A has hops, Token B direct
      functionArgs.push(
        principalCV(tokenAFinal), // token-a-final
        principalCV(lpVault.tokenB.contractId), // token-b
        createHopTuples(tokenA!.hops.hops, tokenAHops) // token-a-hops
      );
    } else {
      // X-Y: Both tokens have hops
      functionArgs.push(
        principalCV(tokenAFinal), // token-a-final
        principalCV(tokenBFinal), // token-b-final
        createHopTuples(tokenA!.hops.hops, tokenAHops), // token-a-hops
        createHopTuples(tokenB!.hops.hops, tokenBHops)  // token-b-hops
      );
    }

    // Build post conditions
    // const postConditions = await this.buildBurnSwapPostConditions(
    const postConditions = await this.buildBurnSwapPostConditionsSimple(
      burnSwapRoute,
      lpVault,
      lpAmount,
      sender,
      // slippageTolerance
    );

    return {
      contract: this.config.contractId as `${string}.${string}`,
      functionName,
      functionArgs,
      postConditions,
      postConditionMode: 'deny' as PostConditionModeName,
      network: 'mainnet',
      clarityVersion: 3,
    };
  }

  /**
   * Build simplified post conditions for burn-swap transaction 
   * Uses real amounts for input/output, GTE 0 for all intermediate hops
   */
  private async buildBurnSwapPostConditionsSimple(
    burnSwapRoute: BurnSwapRouteResult,
    lpVault: Vault,
    lpAmount: number,
    sender: string
  ): Promise<PostCondition[]> {
    const { tokenA, tokenB } = burnSwapRoute;
    const pcMap = new Map<string, any>();
    const add = (pc: any) => {
      let assetKey: string;
      if (pc.asset) {
        if (typeof pc.asset === 'string') {
          assetKey = pc.asset;
        } else if (pc.asset.asset) {
          assetKey = pc.asset.asset;
        } else {
          assetKey = JSON.stringify(pc.asset);
        }
      } else {
        assetKey = 'STX';
      }

      let conditionTypeKey: string;
      if (pc.conditionCode !== undefined) {
        conditionTypeKey = pc.conditionCode.toString();
      } else if (pc.conditionType) {
        conditionTypeKey = pc.conditionType;
      } else {
        conditionTypeKey = 'unknown';
      }

      const k = `${pc.address}|${assetKey}|${conditionTypeKey}`;

      if (pcMap.has(k)) {
        // Merge amounts for same principal/token/condition type
        const existing = pcMap.get(k);

        // Determine merging strategy based on condition code
        // PostConditionType.Equal = 1, GreaterEqual = 2, LessEqual = 3
        if (pc.conditionCode === 2 || pc.conditionType === 'gte') {
          // GreaterEqual: take the maximum (most restrictive for minimum amounts)
          existing.amount = BigInt(Math.max(Number(existing.amount), Number(pc.amount)));
        } else if (pc.conditionCode === 3 || pc.conditionType === 'lte') {
          // LessEqual: take the maximum (least restrictive for maximum amounts)
          existing.amount = BigInt(Math.max(Number(existing.amount), Number(pc.amount)));
        } else if (pc.conditionCode === 1 || pc.conditionType === 'eq') {
          // Equal: add amounts together
          existing.amount = BigInt(existing.amount) + BigInt(pc.amount);
        }
      } else {
        pcMap.set(k, { ...pc });
      }
    };

    const createTokenCondition = (token: any, amount: number, principal: string, condition: 'eq' | 'gte') => {
      let pc: any;
      if (token.contractId === '.stx' || token.contract_principal === '.stx') {
        pc = condition === 'eq'
          ? Pc.principal(principal).willSendEq(BigInt(amount)).ustx()
          : Pc.principal(principal).willSendGte(BigInt(amount)).ustx();
      } else {
        const contractId = token.contractId || token.contract_principal;
        const identifier = token.identifier;
        pc = condition === 'eq'
          ? Pc.principal(principal).willSendEq(BigInt(amount)).ft(contractId as any, identifier)
          : Pc.principal(principal).willSendGte(BigInt(amount)).ft(contractId as any, identifier);
      }
      pc.conditionType = condition;
      return pc;
    };

    // 1. User sends LP tokens (exact amount)
    add(createTokenCondition(lpVault, lpAmount, sender, 'eq'));

    // 2. Burn-swapper contract burns LP tokens (sends to vault for burning)
    add(createTokenCondition(lpVault, lpAmount, this.config.contractId, 'gte'));

    // 3. Liquidity return from vault - vault sends underlying tokens to burn-swapper contract (GTE 0)
    if (tokenA) {
      add(createTokenCondition(lpVault.tokenA, 0, lpVault.contractId, 'gte'));
    }

    if (tokenB) {
      add(createTokenCondition(lpVault.tokenB, 0, lpVault.contractId, 'gte'));
    }

    // 4. Post conditions for each hop in tokenA route (all GTE 0)
    if (tokenA && tokenA.hops.hops && tokenA.hops.hops.length > 0) {
      tokenA.hops.hops.forEach(hop => {
        // Input token for this hop (contract sends to pool)
        add(createTokenCondition(hop.tokenIn, 0, this.config.contractId, 'gte'));
        // Output token from this hop (pool sends to contract)
        add(createTokenCondition(hop.tokenOut, 0, hop.vault.contractId, 'gte'));
      });
    }

    // 5. Post conditions for each hop in tokenB route (all GTE 0)
    if (tokenB && tokenB.hops.hops && tokenB.hops.hops.length > 0) {
      tokenB.hops.hops.forEach(hop => {
        // Input token for this hop (contract sends to pool)
        add(createTokenCondition(hop.tokenIn, 0, this.config.contractId, 'gte'));
        // Output token from this hop (pool sends to contract)
        add(createTokenCondition(hop.tokenOut, 0, hop.vault.contractId, 'gte'));
      });
    }

    // 6. Final output condition - user receives combined final token output (real amounts with slippage)
    if (tokenA || tokenB) {
      // Get the final output token (should be the same for both routes in burn-swap)
      let finalOutputToken;
      if (tokenA) {
        if (tokenA.hops.hops && tokenA.hops.hops.length > 0) {
          finalOutputToken = tokenA.hops.hops[tokenA.hops.hops.length - 1].tokenOut;
        } else {
          finalOutputToken = lpVault.tokenA;
        }
      } else if (tokenB) {
        if (tokenB.hops.hops && tokenB.hops.hops.length > 0) {
          finalOutputToken = tokenB.hops.hops[tokenB.hops.hops.length - 1].tokenOut;
        } else {
          finalOutputToken = lpVault.tokenB;
        }
      }

      // Combine both tokenA and tokenB final amounts
      const combinedFinalAmount = (tokenA?.finalAmount || 0) + (tokenB?.finalAmount || 0);
      const minCombinedOutput = Math.floor(combinedFinalAmount * 0.95); // 5% slippage protection

      if (finalOutputToken && minCombinedOutput > 0) {
        add(createTokenCondition(finalOutputToken, minCombinedOutput, this.config.contractId, 'gte'));
      }
    }

    if (this.config.debug) {
      console.log('🔒 Simple Post Conditions Summary (Real Input/Output, GTE 0 for hops):');
      for (const [key, pc] of Array.from(pcMap.entries())) {
        const [principal, asset, conditionType] = key.split('|');
        const shortPrincipal = principal.length > 20 ? `${principal.slice(0, 10)}...${principal.slice(-16)}` : principal;
        let shortAsset;
        if (asset.includes('::')) {
          const [contractId, identifier] = asset.split('::');
          const contractName = contractId.split('.').pop();
          shortAsset = `${contractName}::${identifier}`;
        } else if (asset === 'STX') {
          shortAsset = 'STX';
        } else {
          shortAsset = asset.split('.').pop() || asset;
        }
        console.log(`  ${shortPrincipal} → ${conditionType.toUpperCase()} ${pc.amount} ${shortAsset}`);
      }
    }

    return Array.from(pcMap.values());
  }

  /**
   * Build post conditions for burn-swap transaction
   */
  private async buildBurnSwapPostConditions(
    burnSwapRoute: BurnSwapRouteResult,
    lpVault: Vault,
    lpAmount: number,
    sender: string,
    slippageTolerance: number
  ): Promise<PostCondition[]> {
    const { tokenA, tokenB } = burnSwapRoute;
    /** deduplicated map of fungible post conditions */
    const pcMap = new Map<string, any>();
    const add = (pc: any) => {
      // Create a more robust key that handles both STX and fungible tokens
      let assetKey: string;
      if (pc.asset) {
        // Fungible token - use contract address + token identifier
        if (typeof pc.asset === 'string') {
          assetKey = pc.asset;
        } else if (pc.asset.asset) {
          assetKey = pc.asset.asset;
        } else {
          assetKey = JSON.stringify(pc.asset);
        }
      } else {
        // STX
        assetKey = 'STX';
      }

      // Use the actual condition code from the post condition object
      let conditionTypeKey: string;
      if (pc.conditionCode !== undefined) {
        // Use actual condition code from Stacks post condition
        conditionTypeKey = pc.conditionCode.toString();
      } else if (pc.conditionType) {
        // Use our custom condition type
        conditionTypeKey = pc.conditionType;
      } else {
        // Fallback - try to determine from the object
        conditionTypeKey = 'unknown';
      }

      const k = `${pc.address}|${assetKey}|${conditionTypeKey}`;

      if (pcMap.has(k)) {
        // Merge amounts for same principal/token/condition type
        const existing = pcMap.get(k);
        const oldAmount = existing.amount;

        // Determine merging strategy based on condition code
        // PostConditionType.Equal = 1, GreaterEqual = 2, LessEqual = 3
        if (pc.conditionCode === 2 || pc.conditionType === 'gte') {
          // GreaterEqual: take the maximum (most restrictive for minimum amounts)
          existing.amount = BigInt(Math.max(Number(existing.amount), Number(pc.amount)));
        } else if (pc.conditionCode === 3 || pc.conditionType === 'lte') {
          // LessEqual: take the maximum (least restrictive for maximum amounts)
          existing.amount = BigInt(Math.max(Number(existing.amount), Number(pc.amount)));
        } else if (pc.conditionCode === 1 || pc.conditionType === 'eq') {
          // Equal: add amounts together
          existing.amount = BigInt(existing.amount) + BigInt(pc.amount);
        }
      } else {
        pcMap.set(k, { ...pc });
      }
    };

    // Helper function to create token-specific post conditions
    const createTokenCondition = (
      token: any,
      amount: bigint,
      principal: string,
      condition: 'eq' | 'gte' | 'lte'
    ) => {
      let pc: any;
      let tokenInfo: string;

      if (token.contractId === '.stx' || token.contract_principal === '.stx') {
        pc = condition === 'eq'
          ? Pc.principal(principal).willSendEq(amount).ustx()
          : condition === 'gte'
            ? Pc.principal(principal).willSendGte(amount).ustx()
            : Pc.principal(principal).willSendLte(amount).ustx();
        tokenInfo = 'STX (native token)';
      } else {
        const contractId = token.contractId || token.contract_principal;
        const identifier = token.identifier
        if (identifier.includes('.')) {
          throw new Error(`Identifier: ${identifier} is not a valid identifier`);
        }

        pc = condition === 'eq'
          ? Pc.principal(principal).willSendEq(amount).ft(contractId as any, identifier)
          : condition === 'gte'
            ? Pc.principal(principal).willSendGte(amount).ft(contractId as any, identifier)
            : Pc.principal(principal).willSendLte(amount).ft(contractId as any, identifier);
        tokenInfo = `${contractId}::${identifier}`;
      }

      // Explicitly set the conditionType for merging
      pc.conditionType = condition;
      return pc;
    };

    // 1. User sends LP tokens to burn-swapper contract
    const userToContractCondition = createTokenCondition(
      lpVault,
      BigInt(lpAmount),
      sender,
      'eq'
    );
    add(userToContractCondition);

    // 2. Burn-swapper contract burns LP tokens (sends to vault for burning)
    const burnCondition = createTokenCondition(
      lpVault,
      BigInt(lpAmount),
      this.config.contractId,
      'eq'
    );
    add(burnCondition);

    // 3. Liquidity return from vault - vault sends underlying tokens to burn-swapper contract
    if (tokenA) {
      const tokenAReturnCondition = createTokenCondition(
        lpVault.tokenA,
        BigInt(Math.floor(tokenA.amount * (1 - slippageTolerance))),
        lpVault.contractId,
        'gte'
      );
      add(tokenAReturnCondition);
    }

    if (tokenB) {
      const tokenBReturnCondition = createTokenCondition(
        lpVault.tokenB,
        BigInt(Math.floor(tokenB.amount * (1 - slippageTolerance))),
        lpVault.contractId,
        'gte'
      );
      add(tokenBReturnCondition);
    }

    // 4. Post conditions for each hop in tokenA route

    if (tokenA && tokenA.hops.hops && tokenA.hops.hops.length > 0) {
      // For each hop, add intermediate token transfer conditions
      let currentAmount = tokenA.amount;

      for (let i = 0; i < tokenA.hops.hops.length; i++) {
        const hop = tokenA.hops.hops[i];

        if (!hop.tokenIn || !hop.tokenOut) {
          throw new Error(`Missing token information for hop ${i} in tokenA route`);
        }

        // Input token for this hop (contract sends to pool)
        const maxInput = Math.floor(currentAmount * (1 + slippageTolerance));
        const inputCondition = createTokenCondition(
          hop.tokenIn,
          BigInt(maxInput),
          this.config.contractId,
          'lte'
        );
        add(inputCondition);

        // Calculate expected output for this hop
        let hopOutput: number;
        if (i === tokenA.hops.hops.length - 1) {
          // Final hop - use the actual final amount
          hopOutput = tokenA.finalAmount;
        } else {
          // Intermediate hop - estimate based on current amount
          hopOutput = currentAmount * 0.997; // Assume ~0.3% fee per hop
        }

        // Output token from this hop (pool sends to contract or next hop)
        const minOutput = Math.floor(hopOutput * (1 - slippageTolerance));
        const outputCondition = createTokenCondition(
          hop.tokenOut,
          BigInt(minOutput),
          hop.vault.contractId,
          'gte'
        );
        add(outputCondition);

        currentAmount = hopOutput;
      }
    } else if (tokenA) {
      // Direct transfer (0 hops) - LP removal gives tokenA directly to user
      // Use the vault's tokenA object for consistency
      const minOutput = Math.floor(tokenA.finalAmount * (1 - slippageTolerance));
      const outputCondition = createTokenCondition(
        lpVault.tokenA,
        BigInt(minOutput),
        this.config.contractId,
        'gte'
      );
      add(outputCondition);
    }

    // 5. Post conditions for each hop in tokenB route
    if (tokenB && tokenB.hops.hops && tokenB.hops.hops.length > 0) {
      // For each hop, add intermediate token transfer conditions
      let currentAmount = tokenB.amount;

      for (let i = 0; i < tokenB.hops.hops.length; i++) {
        const hop = tokenB.hops.hops[i];

        if (!hop.tokenIn || !hop.tokenOut) {
          throw new Error(`Missing token information for hop ${i} in tokenB route`);
        }

        // Input token for this hop (contract sends to pool)
        const maxInput = Math.floor(currentAmount * (1 + slippageTolerance));
        const inputCondition = createTokenCondition(
          hop.tokenIn,
          BigInt(maxInput),
          this.config.contractId,
          'lte'
        );
        add(inputCondition);

        // Calculate expected output for this hop
        let hopOutput: number;
        if (i === tokenB.hops.hops.length - 1) {
          // Final hop - use the actual final amount
          hopOutput = tokenB.finalAmount;
        } else {
          // Intermediate hop - estimate based on current amount
          hopOutput = currentAmount * 0.997; // Assume ~0.3% fee per hop
        }

        // Output token from this hop (pool sends to contract or next hop)
        const minOutput = Math.floor(hopOutput * (1 - slippageTolerance));
        const outputCondition = createTokenCondition(
          hop.tokenOut,
          BigInt(minOutput),
          hop.vault.contractId,
          'gte'
        );
        add(outputCondition);

        currentAmount = hopOutput;
      }
    } else if (tokenB) {
      // Direct transfer (0 hops) - LP removal gives tokenB directly to user
      // Use the vault's tokenB object for consistency
      const minOutput = Math.floor(tokenB.finalAmount * (1 - slippageTolerance));
      const outputCondition = createTokenCondition(
        lpVault.tokenB,
        BigInt(minOutput),
        this.config.contractId,
        'gte'
      );
      add(outputCondition);
    }

    // 6. Final output conditions - from burn-swapper contract to user
    if (tokenA) {
      // Get the final output token from the last hop or use the vault token for direct transfers
      let finalOutputToken;
      if (tokenA.hops.hops && tokenA.hops.hops.length > 0) {
        // Use the output token from the final hop
        finalOutputToken = tokenA.hops.hops[tokenA.hops.hops.length - 1].tokenOut;
      } else {
        // Direct transfer - use vault's tokenA
        finalOutputToken = lpVault.tokenA;
      }

      const minFinalOutput = Math.floor(tokenA.finalAmount * (1 - slippageTolerance));


      const finalOutputCondition = createTokenCondition(
        finalOutputToken,
        BigInt(minFinalOutput),
        this.config.contractId,
        'gte'
      );
      add(finalOutputCondition);
    }

    if (tokenB) {
      // Get the final output token from the last hop or use the vault token for direct transfers
      let finalOutputToken;
      if (tokenB.hops.hops && tokenB.hops.hops.length > 0) {
        // Use the output token from the final hop
        finalOutputToken = tokenB.hops.hops[tokenB.hops.hops.length - 1].tokenOut;
      } else {
        // Direct transfer - use vault's tokenB
        finalOutputToken = lpVault.tokenB;
      }

      const minFinalOutput = Math.floor(tokenB.finalAmount * (1 - slippageTolerance));


      const finalOutputCondition = createTokenCondition(
        finalOutputToken,
        BigInt(minFinalOutput),
        this.config.contractId,
        'gte'
      );
      add(finalOutputCondition);
    }

    // Debug log showing all merged post conditions by asset key
    if (this.config.debug) {
      console.log('🔒 Final Post Conditions Summary:');
      for (const [key, pc] of pcMap.entries()) {
        const [principal, asset, conditionType] = key.split('|');
        const shortPrincipal = principal.length > 20 ? `${principal.slice(0, 10)}...${principal.slice(-16)}` : principal;
        let shortAsset;
        if (asset.includes('::')) {
          const [contractId, identifier] = asset.split('::');
          const contractName = contractId.split('.').pop();
          shortAsset = `${contractName}::${identifier}`;
        } else if (asset === 'STX') {
          shortAsset = 'STX';
        } else {
          shortAsset = asset.split('.').pop() || asset;
        }
        console.log(`  ${shortPrincipal} → ${conditionType.toUpperCase()} ${pc.amount} ${shortAsset}`);
      }
    }

    return Array.from(pcMap.values());
  }
}

/*************  Factory Function  *************/

/**
 * Create a BurnSwapper instance with default configuration
 * Now supports 0-4 hops per token (25 total patterns)
 */
export const createBurnSwapper = (
  contractId: string,
  router: RouterLike,
  config: Partial<BurnSwapConfig> = {}
): BurnSwapper => {
  return new BurnSwapper(
    {
      contractId,
      debug: false,
      ...config,
    },
    router
  );
};