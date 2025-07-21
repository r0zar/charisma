import type { Vault, VaultResult } from '../../traits/Vault';
import type { SIP010 } from '../../traits/SIP010';
import { Credit } from '../Credit';
import { LiquidityPool } from '../LiquidityPool';
import { Sublink } from '../Sublink';
import { isValidAmount } from '../../utils/validation';
import { defaultMultihopConfig, OPCODES } from './types';
import type {
  MultihopConfig,
  Route,
  RouteHop,
  GraphNode,
  CachedQuote,
} from './types';

/**
 * Router class for pathfinding and route optimization
 * Handles graph construction, pathfinding, and quote caching
 */
export class Router {
  // Graph structures for pathfinding
  private readonly vaultMap = new Map<string, Vault>();
  private readonly tokenMap = new Map<string, SIP010>();
  private readonly nodes = new Map<string, GraphNode>();
  private readonly quoteCache = new Map<string, CachedQuote>();

  // Configuration
  public readonly config: MultihopConfig;

  constructor(config: Partial<MultihopConfig> = {}) {
    this.config = { ...defaultMultihopConfig, ...config };
  }

  // === Graph Construction ===

  /**
   * Initialize graph with provided vaults and tokens (provider pattern)
   */
  initialize(vaults: Vault[], tokens: SIP010[]): void {
    // Add tokens to the graph
    for (const token of tokens) {
      this.tokenMap.set(token.contractId, token);
      this.getOrCreateNode(token);
    }

    // Add vaults and connect them to the graph
    for (const vault of vaults) {
      this.vaultMap.set(vault.contractId, vault);
      this.addVaultToGraph(vault);
    }

    if (this.config.debug) {
      console.log(`[router] initialized with ${vaults.length} vaults and ${tokens.length} tokens`);
    }
  }

  /**
   * Add vault to graph using vault's tokenA and tokenB properties
   */
  private addVaultToGraph(vault: Vault): void {
    if (vault instanceof LiquidityPool) {
      // For liquidity pools, use tokenA and tokenB properties
      const tokenAId = vault.tokenA?.contractId;
      const tokenBId = vault.tokenB?.contractId;

      if (tokenAId && tokenBId) {
        const tokenA = this.tokenMap.get(tokenAId);
        const tokenB = this.tokenMap.get(tokenBId);

        if (tokenA && tokenB) {
          this.connectTokensWithVault(tokenA, tokenB, vault);
        }
      }
    } else if (vault instanceof Sublink) {
      // For sublinks, use mainnet and subnet token properties
      const mainnetTokenId = vault.tokenA?.contractId;
      const subnetTokenId = vault.tokenB?.contractId;

      if (mainnetTokenId && subnetTokenId) {
        const mainnetToken = this.tokenMap.get(mainnetTokenId);
        const subnetToken = this.tokenMap.get(subnetTokenId);

        if (mainnetToken && subnetToken) {
          this.connectTokensWithVault(mainnetToken, subnetToken, vault);
        }
      }
    }
  }

  /**
   * Connect two tokens with a vault, creating bidirectional edges
   */
  private connectTokensWithVault(tokenA: SIP010, tokenB: SIP010, vault: Vault): void {
    const nodeA = this.getOrCreateNode(tokenA);
    const nodeB = this.getOrCreateNode(tokenB);

    // Create bidirectional edges
    const edgeKeyAB = `${tokenB.contractId}-${vault.contractId}`;
    nodeA.edges.set(edgeKeyAB, { vault, target: tokenB });

    const edgeKeyBA = `${tokenA.contractId}-${vault.contractId}`;
    nodeB.edges.set(edgeKeyBA, { vault, target: tokenA });

    if (this.config.debug) {
      console.log(`[router] Connected ${tokenA.contractId} ↔ ${tokenB.contractId} via ${vault.contractId}`);
    }
  }

  /**
   * Get or create graph node for token
   */
  private getOrCreateNode(token: SIP010): GraphNode {
    let node = this.nodes.get(token.contractId);
    if (!node) {
      node = { token, edges: new Map() };
      this.nodes.set(token.contractId, node);
    }
    return node;
  }

  // === Pathfinding Logic ===

  /**
   * Find best route between two tokens with pathfinding
   */
  async findBestRoute(from: string, to: string, amount: string): Promise<Route | null> {
    if (!isValidAmount(amount)) {
      throw new Error('Invalid amount');
    }

    // Clear stale cache entries
    this.clearStaleCache();

    // Find all possible paths
    const paths = this.findAllPaths(from, to);
    if (!paths.length) {
      if (this.config.debug) {
        console.log(`[router] No paths found from ${from} to ${to}`);
      }
      return null;
    }

    if (this.config.debug) {
      console.log(`[router] Found ${paths.length} paths from ${from} to ${to}`);
    }

    // Evaluate paths in order of preference
    const pathsToEvaluate = paths.slice(0, this.config.maxPathsToEvaluate);

    const routes = await Promise.all(
      pathsToEvaluate.map(p => this.evaluatePath(p, amount))
    );

    const validRoutes = routes.filter(r => r !== null) as Route[];

    if (this.config.debug) {
      console.log(`[router] ${validRoutes.length} valid routes found`);
    }

    return validRoutes.length > 0
      ? validRoutes.sort((a, b) => Number(b.amountOut) - Number(a.amountOut))[0]
      : null;
  }

  /**
   * Depth-first search for all simple paths up to maxHops
   */
  private findAllPaths(
    from: string,
    to: string,
    path: SIP010[] = [],
    visited = new Set<string>()
  ): SIP010[][] {
    const result: SIP010[][] = [];
    const node = this.nodes.get(from);
    if (!node) return result;

    const nextPath = [...path, node.token];

    // Terminal condition - found target and have at least one hop
    if (from === to && nextPath.length >= 2) {
      result.push(nextPath);
      return result;
    }

    // Don't exceed max hops
    if (nextPath.length > this.config.maxHops) {
      return result;
    }

    // Explore neighbors
    for (const edge of Array.from(node.edges.values())) {
      const targetId = edge.target.contractId;
      if (!visited.has(edge.vault.contractId)) {
        const newVisited = new Set(visited).add(edge.vault.contractId);
        result.push(...this.findAllPaths(targetId, to, nextPath, newVisited));
      }
    }

    return result;
  }

  /**
   * Evaluate concrete path by selecting best vaults at each hop
   */
  private async evaluatePath(path: SIP010[], amount: string): Promise<Route | null> {
    try {
      let currentAmount = amount;
      const hops: RouteHop[] = [];

      for (let i = 0; i < path.length - 1; i++) {
        const tokenIn = path[i];
        const tokenOut = path[i + 1];
        const node = this.nodes.get(tokenIn.contractId);
        if (!node) throw new Error(`Node not found for ${tokenIn.contractId}`);

        // Find all vaults connecting tokenIn -> tokenOut
        const candidateEdges = Array.from(node.edges.values())
          .filter(e => e.target.contractId === tokenOut.contractId);

        if (!candidateEdges.length) {
          throw new Error(`No edges found from ${tokenIn.contractId} to ${tokenOut.contractId}`);
        }

        // Find best vault for this hop
        let bestResult: { vault: Vault; result: VaultResult; opcode: string } | null = null;

        for (const edge of candidateEdges) {
          const opcode = this.determineOpcode(tokenIn, tokenOut, edge.vault);
          const result = await this.getCachedQuote(edge.vault, currentAmount, opcode);

          if (result && (!bestResult || Number(result.dy) > Number(bestResult.result.dy))) {
            bestResult = { vault: edge.vault, result, opcode };
          }
        }

        if (!bestResult) {
          throw new Error(`No valid quotes found for hop ${i}`);
        }

        hops.push({
          vault: bestResult.vault,
          tokenIn,
          tokenOut,
          opcode: bestResult.opcode,
          quote: bestResult.result
        });

        currentAmount = bestResult.result.dy;
      }

      return {
        path,
        hops,
        amountIn: amount,
        amountOut: currentAmount
      };
    } catch (error) {
      if (this.config.debug) {
        console.warn(`Failed to evaluate path:`, error);
      }
      return null;
    }
  }

  /**
   * Determine opcode based on token types and vault
   */
  private determineOpcode(tokenIn: SIP010, tokenOut: SIP010, vault: Vault): string {
    // For Credit tokens (subnet), use deposit/withdraw opcodes
    if (!(tokenIn instanceof Credit) && tokenOut instanceof Credit) {
      return OPCODES.OP_DEPOSIT;
    } else if (tokenIn instanceof Credit && !(tokenOut instanceof Credit)) {
      return OPCODES.OP_WITHDRAW;
    } else {
      // For standard swaps, default to A->B
      // Could be enhanced to check actual token order in vault
      return OPCODES.SWAP_A_TO_B;
    }
  }

  /**
   * Get cached quote or fetch new one
   */
  private async getCachedQuote(vault: Vault, amount: string, opcode: string): Promise<VaultResult | null> {
    const key = `${vault.contractId}-${amount}-${opcode}`;
    const cached = this.quoteCache.get(key);

    // Check if cache is still valid
    if (cached && Date.now() - cached.timestamp < this.config.quoteCacheTTL) {
      if (this.config.debug) {
        console.log(`[cache] Hit for ${key}`);
      }
      return cached.result;
    }

    // Fetch new quote
    try {
      const result = await vault.quote(amount, opcode);
      this.quoteCache.set(key, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      if (this.config.debug) {
        console.warn(`Failed to get quote for ${key}:`, error);
      }
      return null;
    }
  }

  /**
   * Clear stale entries from quote cache
   */
  private clearStaleCache(): void {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of Array.from(this.quoteCache.entries())) {
      if (now - entry.timestamp > this.config.quoteCacheTTL) {
        this.quoteCache.delete(key);
        cleared++;
      }
    }

    if (this.config.debug && cleared > 0) {
      console.log(`[cache] Cleared ${cleared} stale entries`);
    }
  }

  // === Utility Methods ===

  /**
   * Add vault to the router after initialization
   */
  addVault(vault: Vault): void {
    this.vaultMap.set(vault.contractId, vault);
    this.addVaultToGraph(vault);
  }

  /**
   * Add token to the router after initialization
   */
  addToken(token: SIP010): void {
    this.tokenMap.set(token.contractId, token);
    this.getOrCreateNode(token);
  }

  /**
   * Add multiple vaults at once
   */
  addVaults(vaults: Vault[]): void {
    for (const vault of vaults) {
      this.addVault(vault);
    }
  }

  /**
   * Add multiple tokens at once
   */
  addTokens(tokens: SIP010[]): void {
    for (const token of tokens) {
      this.addToken(token);
    }
  }

  /**
   * Get routing statistics
   */
  getStats(): { tokens: number; vaults: number; edges: number; cacheSize: number } {
    let edgeCount = 0;
    this.nodes.forEach(node => {
      edgeCount += node.edges.size;
    });

    return {
      tokens: this.nodes.size,
      vaults: this.vaultMap.size,
      edges: edgeCount,
      cacheSize: this.quoteCache.size
    };
  }

  /**
   * Get list of all vault contract IDs
   */
  getVaultContractIds(): string[] {
    return Array.from(this.vaultMap.keys());
  }

  /**
   * Get list of all token contract IDs
   */
  getTokenContractIds(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Clear all caches and graph data
   */
  clearAll(): void {
    this.vaultMap.clear();
    this.tokenMap.clear();
    this.nodes.clear();
    this.quoteCache.clear();
  }

  /**
   * Re-initialize with new providers
   */
  reinitialize(vaults: Vault[], tokens: SIP010[]): void {
    this.clearAll();
    this.initialize(vaults, tokens);
  }
}