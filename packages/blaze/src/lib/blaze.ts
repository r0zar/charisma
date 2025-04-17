/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Client for interacting with Stacks blockchain state using a unified interface
 */

import { ClarityValue } from '@stacks/transactions';

import { createStacksService } from '../services/stacks-service';

import { MutateIntent, MutateResult, QueryIntent, QueryResult } from './intent';
import { MemoryCache } from './memory-cache';
import { MessageSigner } from './message-signer';
import { Processor } from './processor';
import { Service } from './service';
/**
 * Options for the unified client
 */
export interface BlazeOptions {
  /**
   * Private key for signing write operations
   * Optional - can still perform read operations without it
   */
  privateKey?: string;

  /**
   * API key for Stacks endpoints
   */
  apiKey?: string;

  /**
   * Array of API keys for Stacks endpoints
   */
  apiKeys?: string[];

  /**
   * Network to use (mainnet or testnet)
   */
  network?: 'mainnet' | 'testnet';

  /**
   * Time-to-live for cache entries in milliseconds
   */
  cacheTTL?: number;

  /**
   * Maximum number of entries in the cache
   */
  maxCacheEntries?: number;

  /**
   * Enable debug logging
   */
  debug?: boolean;

  /**
   * Custom logger implementation
   */
  logger?: any;

  /**
   * Custom services to use instead of the default ones
   * If provided, overrides the default service configuration
   */
  services?: Service[];

  /**
   * Disable caching
   */
  disableCache?: boolean;
}

/**
 * Unified client for interacting with blockchain state with custom L2 middleware
 */
export class Blaze {
  processor: Processor;
  signer: MessageSigner;

  /**
   * Create a new unified client
   */
  constructor(options: BlazeOptions = {}) {
    // Set up the signer with private key if provided
    this.signer = new MessageSigner(options.privateKey)

    // Create memory cache unless disabled
    const cache = options.disableCache
      ? undefined
      : new MemoryCache({
        ttl: options.cacheTTL || 5 * 60 * 1000,
        maxEntries: options.maxCacheEntries || 1000,
        debug: options.debug,
        logger: options.logger,
      });

    // Set up services array
    const services: Service[] = options.services || [];

    // Create the processor with services and cache
    this.processor = new Processor({
      services,
      cache,
      debug: options.debug,
      logger: options.logger,
    });
  }

  /**
   * Create a query intent (read-only operation)
   */
  createQueryIntent(
    contract: string,
    fn: string,
    args: any[]
  ): QueryIntent {
    return {
      contract,
      function: fn,
      args,
    };
  }

  /**
   * Create a mutate intent (state-changing operation)
   */
  async createMutateIntent(
    contract: string,
    fn: string,
    args: any[],
    options: MutateIntent['options'] = {}
  ): Promise<MutateIntent> {
    if (!this.signer) {
      throw new Error('Private key is required for mutation operations');
    }

    return {
      contract,
      function: fn,
      args,
      options,
    };
  }

  /**
   * Call a read-only function (wrapper for better usability)
   */
  async call(
    contract: string,
    fn: string,
    args: any[] = []
  ): Promise<any> {
    const intent = this.createQueryIntent(contract, fn, args);
    const result = await this.processor.query(intent);

    if (result.status === 'error') {
      throw new Error(result.error?.message || 'Unknown error');
    }

    return result.data;
  }

  /**
   * Execute a state-changing function (wrapper for better usability)
   */
  async execute(
    contract: string,
    fn: string,
    args: any[] = [],
    options?: MutateIntent['options']
  ): Promise<MutateResult> {
    if (!this.signer) {
      throw new Error('Private key is required for mutation operations');
    }

    const intent = await this.createMutateIntent(contract, fn, args, options);
    return this.processor.mutate(intent);
  }

  /**
   * Execute a query directly
   */
  async query(intent: QueryIntent): Promise<QueryResult> {
    return this.processor.query(intent);
  }

  /**
   * Execute a mutation directly
   */
  async mutate(intent: MutateIntent): Promise<MutateResult> {
    return this.processor.mutate(intent);
  }

  /**
   * Invalidate cache entry
   */
  invalidate(contract: string, fn: string, args: ClarityValue[]): boolean {
    return this.processor.invalidate(contract, fn, args);
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.processor.clearCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return this.processor.getCacheStats();
  }
}

/**
 * Helper function to create a client for interacting with blockchain state with custom L2 middleware
 */
export function createBlazeClient(options: {
  services?: Service[];
  fallbackToBlockchain?: boolean;
  privateKey?: string;
  apiKey?: string;
  network?: 'mainnet' | 'testnet';
  cacheTTL?: number;
  debug?: boolean;
} = {}) {
  // Set up the services array
  const services: Service[] = options.services || [];

  // Add blockchain fallback if requested
  if (options.fallbackToBlockchain !== false) {
    services.push(
      createStacksService({
        privateKey: options.privateKey,
        apiKey: options.apiKey,
        network: options.network || 'mainnet',
        debug: options.debug,
      })
    );
  }

  return new Blaze({
    services,
    privateKey: options.privateKey,
    cacheTTL: options.cacheTTL,
    debug: options.debug,
  });
}
