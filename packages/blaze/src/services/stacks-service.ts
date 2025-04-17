/**
 * Stacks blockchain service implementation
 * Provides direct access to the Stacks blockchain
 */

import { StacksClient, StacksClientOptions } from '@repo/stacks';
import {
  MutateIntent,
  MutateResult,
  QueryIntent,
  QueryResult,
} from '../lib/intent';
import { Service } from '../lib/service';

/**
 * Default options for the Stacks service
 */
const DEFAULT_OPTIONS: StacksClientOptions = {
  debug: false,
  logger: console,
  network: 'mainnet',
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Create a configured Stacks blockchain service
 * 
 * @param customOptions - Configuration options for the service
 * @returns A service object with the specified configuration
 */
export function createStacksService(customOptions: StacksClientOptions = {}): Service {
  // Merge default options with custom options
  const options = {
    ...DEFAULT_OPTIONS,
    ...customOptions
  };

  // Create client once for this service instance
  const client = StacksClient.getInstance(options);
  const logger = options.logger || console;

  return {
    name: 'stacks',

    async query(intent: QueryIntent): Promise<QueryResult> {
      try {
        if (options.debug) {
          logger.debug(`[STACKS QUERY] ${intent.contract}.${intent.function}`);
        }

        const result = await client.callReadOnly(
          intent.contract,
          intent.function,
          intent.args,
          options.maxRetries
        );

        return { status: 'success', data: result };
      } catch (error) {
        if (options.debug) {
          logger.error(
            `[STACKS ERROR] ${intent.contract}.${intent.function}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }

        return {
          status: 'error',
          error: {
            message: `Failed to query ${intent.contract}.${intent.function} on Stacks: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: error,
          },
        };
      }
    },

    async mutate(intent: MutateIntent): Promise<MutateResult> {
      try {
        if (options.debug) {
          logger.debug(`[STACKS MUTATE] ${intent.contract}.${intent.function}`);
        }

        // Call the contract function
        const txId = await client.callContractFunction(
          intent.contract,
          intent.function,
          intent.args,
          intent.options
        );

        return { status: 'pending', txId };
      } catch (error) {
        if (options.debug) {
          logger.error(
            `[STACKS ERROR] ${intent.contract}.${intent.function}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }

        return {
          status: 'error',
          error: {
            message: `Failed to mutate ${intent.contract}.${intent.function} on Stacks: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: error,
          },
        };
      }
    }
  };
}

/**
 * Default Stacks service instance with default configuration
 */
export const StacksService = createStacksService();