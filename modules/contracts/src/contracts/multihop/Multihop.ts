import {
  principalCV,
  uintCV,
  tupleCV,
  someCV,
  noneCV,
  bufferCV,
  Pc,
  FungiblePostCondition,
  PostConditionModeName
} from '@stacks/transactions';
import type { Vault } from '../../traits/Vault';
import type { SIP010 } from '../../traits/SIP010';
import { Router } from './Router';
import { defaultMultihopConfig, OPCODES } from './types';
import type {
  MultihopConfig,
  Route,
  VaultOperation,
  RouteHop
} from './types';

/**
 * Multihop contract class - 1:1 mapping to multihop router Clarity contract
 * Makes actual contract calls to the multihop router, not individual vault executions
 */
export class Multihop {
  // Internal router for pathfinding
  private readonly router: Router;

  // Configuration
  public readonly config: MultihopConfig;

  constructor(
    public readonly contractId: string,
    config: Partial<MultihopConfig> = {},
    vaults: Vault[] = [],
    tokens: SIP010[] = []
  ) {
    if (!contractId.includes('.')) {
      throw new Error('Invalid contract ID format');
    }
    this.config = { ...defaultMultihopConfig, ...config };

    // Initialize router with provider pattern
    this.router = new Router(this.config);
    if (vaults.length > 0 || tokens.length > 0) {
      this.router.initialize(vaults, tokens);
    }
  }

  // === Router Delegation ===

  /**
   * Find best route between two tokens
   */
  async findBestRoute(from: string, to: string, amount: string): Promise<Route | null> {
    return this.router.findBestRoute(from, to, amount);
  }

  /**
   * Add vault to the router
   */
  addVault(vault: Vault): void {
    this.router.addVault(vault);
  }

  /**
   * Add token to the router
   */
  addToken(token: SIP010): void {
    this.router.addToken(token);
  }

  /**
   * Add multiple vaults at once
   */
  addVaults(vaults: Vault[]): void {
    this.router.addVaults(vaults);
  }

  /**
   * Add multiple tokens at once
   */
  addTokens(tokens: SIP010[]): void {
    this.router.addTokens(tokens);
  }

  /**
   * Get routing statistics
   */
  getStats(): { tokens: number; vaults: number; edges: number; cacheSize: number } {
    return this.router.getStats();
  }

  /**
   * Get list of all vault contract IDs
   */
  getVaultContractIds(): string[] {
    return this.router.getVaultContractIds();
  }

  /**
   * Get list of all token contract IDs
   */
  getTokenContractIds(): string[] {
    return this.router.getTokenContractIds();
  }

  /**
   * Clear all caches and graph data
   */
  clearAll(): void {
    this.router.clearAll();
  }

  /**
   * Re-initialize with new providers
   */
  reinitialize(vaults: Vault[], tokens: SIP010[]): void {
    this.router.reinitialize(vaults, tokens);
  }

  // === Helper Methods ===

  /**
   * Validate that a route is executable
   */
  validateRoute(operations: VaultOperation[]): boolean {
    if (operations.length === 0 || operations.length > 9) {
      return false;
    }

    // Check that all operations have valid vaults
    return operations.every(op => op.vault && op.vault.contractId);
  }

  /**
   * Convert numeric opcode to optional 16-byte buffer CV
   */
  private opcodeCV(op: string): any {
    const b = new Uint8Array(16).fill(0);
    b[0] = parseInt(op, 16);
    return someCV(bufferCV(b));
  }

  /**
   * Build per-hop post-conditions (STX or SIP-010 fungible)
   */
  private async buildSwapPostConditions(
    hop: RouteHop,
    sender: string,
    slippage?: number,
  ) {
    const mk = (
      t: SIP010,
      amt: bigint,
      princ: string,
      cond: 'eq' | 'gte' | 'lte',
    ) => {
      if (t.contractId === '.stx')
        return cond === 'eq'
          ? Pc.principal(princ).willSendEq(amt).ustx()
          : cond === 'gte'
            ? Pc.principal(princ).willSendGte(amt).ustx()
            : Pc.principal(princ).willSendLte(amt).ustx();

      return cond === 'eq'
        ? Pc.principal(princ).willSendEq(amt).ft(t.contractId as any, t.contractId)
        : cond === 'gte'
          ? Pc.principal(princ).willSendGte(amt).ft(t.contractId as any, t.contractId)
          : Pc.principal(princ).willSendLte(amt).ft(t.contractId as any, t.contractId);
    };

    const { tokenIn, tokenOut, vault, opcode } = hop;
    const amtIn = BigInt(hop.quote?.dx ?? '0');
    const amtOut = BigInt(hop.quote?.dy ?? '0');

    if (opcode === OPCODES.OP_DEPOSIT) return [mk(tokenIn, amtIn, sender, 'eq')];

    if (opcode === OPCODES.OP_WITHDRAW) {
      // For withdrawal, tokens come from the vault contract
      return [mk(tokenOut, amtOut, vault.contractId, 'eq')];
    }

    const effectiveSlippage = slippage !== undefined ? slippage / 100 : this.config.defaultSlippage;
    const maxIn = BigInt(Math.floor(Number(amtIn) * (1 + effectiveSlippage)));
    const minOut = BigInt(Math.floor(Number(amtOut) * (1 - effectiveSlippage)));

    return [
      mk(tokenIn, maxIn, sender, 'lte'),
      mk(tokenOut, minOut, vault.contractId, 'gte'),
    ];
  }

  /**
   * Build complete swap transaction with post-conditions
   */
  async buildSwapTransaction(
    route: Route,
    sender: string,
    slippage?: number
  ) {
    const hopCount = route.hops.length;
    if (hopCount < 1 || hopCount > 9) {
      throw new Error(`Invalid hop count: ${hopCount}`);
    }

    // Build deduplicated map of fungible post conditions
    const pcMap = new Map<string, FungiblePostCondition>();
    const add = (pc: FungiblePostCondition) => {
      const k = `${pc.address}-${pc.asset ?? 'STX'}`;
      if (pcMap.has(k)) {
        const existing = pcMap.get(k)!;
        existing.amount = BigInt(existing.amount) + BigInt(pc.amount);
      } else {
        pcMap.set(k, { ...pc });
      }
    };

    // Accumulate post-conditions per hop
    for (const hop of route.hops) {
      const pcs = await this.buildSwapPostConditions(hop, sender, slippage);
      (pcs as FungiblePostCondition[]).forEach(add);
    }

    // Build hop tuples for contract call
    const hopTuples = route.hops.map(hop =>
      tupleCV({
        pool: principalCV(hop.vault.contractId),
        opcode: this.opcodeCV(hop.opcode)
      })
    );

    const functionName = `swap-${hopCount}`;
    const functionArgs = [uintCV(route.amountIn), ...hopTuples];

    return {
      contract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop',
      functionName,
      functionArgs,
      postConditions: Array.from(pcMap.values()),
      postConditionMode: 'deny' as PostConditionModeName,
      network: 'mainnet',
      clarityVersion: 3,
    };
  }

  // === Factory Methods ===

  /**
   * Create Multihop instance from contract ID
   */
  static fromContractId(contractId: string, config?: Partial<MultihopConfig>): Multihop {
    return new Multihop(contractId, config);
  }

  /**
   * Get type identifier
   */
  getType(): 'multihop' {
    return 'multihop';
  }

  toString(): string {
    return `Multihop(${this.contractId})`;
  }
}