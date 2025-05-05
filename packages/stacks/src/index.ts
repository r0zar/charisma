/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * StacksClient implementation for blockchain interactions
 * Compatible with both Node.js and browser environments (including service workers)
 */
import { Client, createClient } from '@stacks/blockchain-api-client';
import { paths } from '@stacks/blockchain-api-client/lib/generated/schema';
import { AddressEntry } from '@stacks/connect/dist/types/methods';
import {
  broadcastTransaction,
  ClarityValue,
  cvToHex,
  cvToValue,
  getAddressFromPrivateKey,
  hexToCV,
  makeContractCall,
  PostConditionMode,
  SignedContractCallOptions,
  SignedMultiSigContractCallOptions,
  signStructuredData,
} from '@stacks/transactions';

const DEFAULT_API_ENDPOINT = 'https://api.hiro.so/';

/**
 * Options for StacksClient
 */
export interface StacksClientOptions {
  /**
   * API key used for authentication with the Stacks endpoint
   */
  apiKey?: string;

  /**
   * Private key for server mode
   */
  privateKey?: string;

  /**
   * Base delay in milliseconds for retry attempts
   * Will be multiplied by attempt number for exponential backoff
   */
  retryDelay?: number;

  /**
   * Environment setting (mainnet or testnet)
   */
  network?: 'mainnet' | 'testnet';

  /**
   * Maximum number of retry attempts for network requests
   */
  maxRetries?: number;

  /**
   * Enable verbose logging
   */
  debug?: boolean;

  /**
   * Custom logger (defaults to console)
   */
  logger?: Console;

  /**
   * Base URL for the Stacks API endpoint
   */
  baseUrl?: string;
}

/**
 * Default options for StacksClient
 */
const DEFAULT_OPTIONS: StacksClientOptions = {
  apiKey: '',
  privateKey: '',
  network: 'mainnet',
  retryDelay: 1000,
  maxRetries: 3,
  debug: false,
  logger: console,
  baseUrl: DEFAULT_API_ENDPOINT,
};

/**
 * Singleton client for Stacks blockchain interactions
 */
export class StacksClient {
  protected static instance: StacksClient;
  protected static options: StacksClientOptions;
  protected client: Client<paths, `${string}/${string}`>;
  protected logger: Console;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor(options: StacksClientOptions = {}) {
    // Initialize options
    StacksClient.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = StacksClient.options.logger || console;

    // Create the single client instance
    this.client = createClient({
      baseUrl: StacksClient.options.baseUrl || DEFAULT_API_ENDPOINT,
      headers: { 'x-api-key': StacksClient.options.apiKey || '' }
    });
  }

  /**
   * Get the singleton instance of StacksClient
   */
  static getInstance(options: StacksClientOptions = {}): StacksClient {
    if (!StacksClient.instance) {
      StacksClient.instance = new StacksClient(options);
    } else if (Object.keys(options).length > 0) {
      // Update options if provided
      StacksClient.instance.updateOptions(options);
    }
    return StacksClient.instance;
  }

  /**
   * Update client options (re-creates client if baseUrl or apiKey changes)
   */
  updateOptions(options: StacksClientOptions): void {
    const oldOptions = { ...StacksClient.options };
    StacksClient.options = { ...StacksClient.options, ...options };
    this.logger = StacksClient.options.logger || console;

    // Re-create client if baseUrl or apiKey changes
    if (options.baseUrl !== oldOptions.baseUrl || options.apiKey !== oldOptions.apiKey) {
      this.client = createClient({ baseUrl: StacksClient.options.baseUrl || DEFAULT_API_ENDPOINT, headers: { 'x-api-key': StacksClient.options.apiKey || '' } });
    }
  }

  /**
   * Get current options
   */
  getOptions(): StacksClientOptions {
    return { ...StacksClient.options };
  }

  async getSigner() {
    if (!StacksClient.options.privateKey) {
      const addresses: AddressEntry[] = JSON.parse(localStorage.getItem('addresses') || '[]')
      if (addresses.length) return addresses[2].address

      const { connect } = await import('@stacks/connect')
      const result = await connect()

      localStorage.setItem('addresses', JSON.stringify(result.addresses))
      return result.addresses[2].address
    } else {
      return getAddressFromPrivateKey(
        StacksClient.options.privateKey || '',
        StacksClient.options.network || 'mainnet'
      );
    }
  }

  /**
   * Call a read-only function on a Stacks contract
   *
   * @param contractId - Contract identifier in format "address.contract-name"
   * @param method - Function name to call
   * @param args - Arguments to pass to the function
   * @param retries - Number of retry attempts (default: from options)
   * @returns Promise resolving to the function result
   */
  async callReadOnly(
    contractId: string,
    method: string,
    args: ClarityValue[] = [],
    retries?: number
  ): Promise<unknown> {
    const maxRetries = retries || StacksClient.options.maxRetries || 3;
    const [address, name] = contractId.split('.');
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Use the single client instance directly
        const response = await this.client.POST(
          `/v2/contracts/call-read/${address}/${name}/${method}` as any,
          {
            body: {
              sender: address,
              arguments: args.map((arg) => cvToHex(arg)),
            },
          }
        );

        if (StacksClient.options.debug) {
          // Log rate limit headers if they exist and remaining is low
          const headers = response?.response?.headers;
          if (headers) {
            const rateRemainingStr = headers.get('ratelimit-remaining');
            const rateRemaining = rateRemainingStr ? parseInt(rateRemainingStr, 10) : null;

            // Only log if remaining is low (e.g., less than 50) or parsing failed
            if (rateRemaining !== null && !isNaN(rateRemaining) && rateRemaining < 50) {
              const rateLimit = headers.get('ratelimit-limit');
              const rateReset = headers.get('ratelimit-reset');
              const rateRemainingSec = headers.get('x-ratelimit-remaining-second');
              const rateRemainingMonth = headers.get('x-ratelimit-remaining-month');
              this.logger.warn(
                `[STACKS READ] Rate Limit Approaching! Limit=${rateLimit || 'N/A'}, Remaining=${rateRemaining} (Sec: ${rateRemainingSec || 'N/A'}, Month: ${rateRemainingMonth || 'N/A'}), Reset=${rateReset || 'N/A'}s`
              );
            } else if (rateRemaining === null || isNaN(rateRemaining)) {
              // Log if we couldn't parse the remaining value, as that might indicate an issue
              this.logger.warn(`[STACKS READ] Could not parse rate limit remaining header: ${rateRemainingStr}`);
            }
          }
        }

        if (!response?.data?.result) {
          throw new Error(`\nNo result from contract call ${method}`);
        }

        return cvToValue(hexToCV(response.data.result)).value;
      } catch (error) {
        attempt++;

        if (attempt >= maxRetries) {
          if (StacksClient.options.debug) {
            this.logger.error(error);
          }
          throw new Error(
            `\nFailed to call ${contractId} read-only method ${method} after ${maxRetries} attempts: ${error}`
          );
        }

        // Exponential backoff
        const retryDelay = StacksClient.options.retryDelay || 1000;
        if (StacksClient.options.debug) {
          this.logger.warn(`[STACKS READ] Attempt ${attempt} failed for ${contractId}.${method}. Retrying in ${attempt * retryDelay}ms...`);
        }
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * retryDelay)
        );
      }
    }
    // Should be unreachable due to throw in catch block
    throw new Error(`Failed to call ${contractId}.${method} unexpectedly.`);
  }

  /**
   * Call a public function (state-changing) on a smart contract
   *
   * @param contractId - Fully qualified contract identifier (address.contract-name)
   * @param functionName - Name of the function to call
   * @param args - Array of Clarity values to pass to the function
   * @param senderAddress - Address of the sender
   * @param postConditions - Optional post conditions
   * @param options - Additional options (fee, nonce, etc.)
   * @returns Transaction ID if successful
   */
  async callContractFunction(
    contractId: string,
    functionName: string,
    args: ClarityValue[] = [],
    options: any = {}
  ) {
    if (StacksClient.options.debug) {
      this.logger.debug(`[STACKS CALL] ${contractId}.${functionName}`);
    }

    // Parse contract ID
    const [contractAddress, contractName] = contractId.split('.');

    // Check if there is a private key supplied
    if (!StacksClient.options.privateKey) {
      // If not supplied, try to use the Stacks Connect library for client-side signing
      const { request } = await import('@stacks/connect');
      const response = await request('stx_callContract', {
        contract: contractId as any,
        functionName,
        functionArgs: args,
        network: options.network || StacksClient.options.network,
        postConditions: options.postConditions,
        postConditionMode: options.postConditionMode || 'deny',
        sponsored: options.sponsored,
      });
      return response?.txid || ''
    } else {
      // If in secure environment, use the private key to sign the transaction
      const transactionOptions:
        | SignedContractCallOptions
        | SignedMultiSigContractCallOptions = {
        contractAddress,
        contractName,
        functionName,
        functionArgs: args,
        senderKey: options.privateKey || StacksClient.options.privateKey,
        validateWithAbi: true,
        network: options.network || StacksClient.options.network,
        postConditions: options.postConditions,
        postConditionMode: options.postConditionMode || PostConditionMode.Deny,
        sponsored: options.sponsored,
        fee: options.fee || 200
      };

      if (options.nonce) {
        transactionOptions.nonce = options.nonce;
      }

      if (options.fee) {
        transactionOptions.fee = options.fee;
      }

      // Create the transaction
      const transaction = await makeContractCall(transactionOptions);

      // Broadcast the transaction
      // Relies on the network context set during transaction creation
      const broadcastResponse = await broadcastTransaction({ transaction });

      // Check for errors
      if ('error' in broadcastResponse) {
        throw new Error(
          `Failed to broadcast transaction: ${broadcastResponse.error} - ${broadcastResponse.reason}`
        );
      }

      // Return transaction ID
      return broadcastResponse.txid;
    }
  }

  signStructuredData = signStructuredData
}

export default StacksClient;
