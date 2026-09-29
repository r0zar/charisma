import { MessageType, respond, type Message } from 'signet-sdk/src/messaging'
import { sendToBackground } from '@plasmohq/messaging'
import type { BlockchainSlice } from '../slices/blockchainSlice'
import type { HandlerResponse, MessageAction, Status, Transfer } from '../types'

/**
 * Service to handle message processing, responses, and communication with background script
 */
export class MessageHandlerService {
  private blockchainSlice: BlockchainSlice

  constructor(blockchainSlice: BlockchainSlice) {
    this.blockchainSlice = blockchainSlice
  }

  /**
   * Send a message to the background script with proper error handling
   * @param action The action to perform
   * @param data Optional data to send with the action
   * @returns Promise resolving to the response data
   */
  async sendMessage<T>(action: MessageAction, data?: any): Promise<T> {
    try {
      const response = await sendToBackground<{ action: MessageAction, data?: any }, HandlerResponse<T>>({
        name: 'handler',
        body: { action, data }
      })

      if (!response.success) {
        throw new Error(response.error || "Unknown error occurred")
      }

      return response.data as T
    } catch (error) {
      console.error(`Error in ${action} message:`, error)
      throw error
    }
  }

  /**
   * Check if a message type is supported
   */
  isSupportedMessageType(type: MessageType): boolean {
    return [
      MessageType.CHECK_EXTENSION_INSTALLED,
      MessageType.GET_STATUS,
      MessageType.GET_BALANCE,
      MessageType.GET_BALANCES,
      MessageType.CREATE_TRANSFER_TX,
      MessageType.SIGN_PREDICTION,
      MessageType.CLAIM_REWARDS,
      MessageType.REQUEST_TRANSACTION_CUSTODY,
      MessageType.SEARCH_MEMPOOL,
      MessageType.DEPLOY_TOKEN_SUBNET,
      MessageType.GENERATE_SUBNET_CODE,
      MessageType.EXECUTE_DEX_SWAP
    ].includes(type)
  }

  /**
   * Handle a message based on its type
   */
  async handleMessage(message: Message): Promise<void> {
    switch (message.type) {
      case MessageType.CHECK_EXTENSION_INSTALLED:
        await this.handleCheckExtensionInstalled(message)
        break

      case MessageType.GET_STATUS:
        await this.handleGetStatus(message)
        break

      case MessageType.GET_BALANCE:
        await this.handleGetBalance(message)
        break

      case MessageType.GET_BALANCES:
        await this.handleGetBalances(message)
        break

      case MessageType.CREATE_TRANSFER_TX:
        await this.handleCreateTransferTx(message)
        break

      case MessageType.SIGN_PREDICTION:
        await this.handleSignPrediction(message)
        break

      case MessageType.CLAIM_REWARDS:
        await this.handleClaimRewards(message)
        break

      case MessageType.REQUEST_TRANSACTION_CUSTODY:
        await this.handleRequestTransactionCustody(message)
        break

      case MessageType.SEARCH_MEMPOOL:
        await this.handleSearchMempool(message)
        break

      case MessageType.DEPLOY_TOKEN_SUBNET:
        await this.handleDeployTokenSubnet(message)
        break

      case MessageType.GENERATE_SUBNET_CODE:
        await this.handleGenerateSubnetCode(message)
        break

      case MessageType.EXECUTE_DEX_SWAP:
        await this.handleExecuteDexSwap(message)
        break

      default:
        // Unknown message type
        respond(message, undefined, {
          code: 'UNKNOWN_MESSAGE_TYPE',
          message: `Unknown message type: ${message.type}`
        })
    }

    // For all message types except GET_STATUS, refresh status to keep UI updated
    if (message.type !== MessageType.GET_STATUS) {
      this.refreshStatus()
    }
  }

  /**
   * Refresh blockchain status after message handling
   */
  refreshStatus(): void {
    if (this.blockchainSlice) {
      try {
        // Use setTimeout to avoid blocking UI
        setTimeout(async () => {
          await this.blockchainSlice.refreshStatus()
          console.log('Status refreshed after message processing')
        }, 100)
      } catch (err) {
        console.error('Failed to refresh status after message:', err)
      }
    }
  }

  /**
   * Handle CHECK_EXTENSION_INSTALLED message
   */
  async handleCheckExtensionInstalled(message: Message): Promise<void> {
    // Using a small timeout to avoid blocking UI during concurrent requests
    setTimeout(() => {
      respond(message, {
        installed: true,
        version: chrome.runtime.getManifest().version
      })
    }, 10)
  }

  /**
   * Handle GET_STATUS message
   */
  async handleGetStatus(message: Message): Promise<void> {
    try {
      // Use blockchainSlice.refreshStatus if available
      const statusData = await this.blockchainSlice.refreshStatus()
      respond(message, statusData || {})
    } catch (error) {
      respond(message, undefined, {
        code: 'STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get status'
      })
    }
  }

  /**
   * Handle GET_BALANCE message
   */
  async handleGetBalance(message: Message): Promise<void> {
    try {
      const data = message.data as { address?: string }
      const balance = await this.blockchainSlice.getBalance(data?.address)
      respond(message, balance)
    } catch (error) {
      respond(message, undefined, {
        code: 'BALANCE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get balance'
      })
    }
  }

  /**
   * Handle GET_BALANCES message
   */
  async handleGetBalances(message: Message): Promise<void> {
    try {
      const balances = await this.blockchainSlice.getBalances()
      this.blockchainSlice.refreshStatus()
      this.blockchainSlice.getAssetBalances()
      respond(message, balances)
    } catch (error) {
      respond(message, undefined, {
        code: 'BALANCES_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get all balances'
      })
    }
  }

  /**
   * Handle CREATE_TRANSFER_TX message
   */
  async handleCreateTransferTx(message: Message): Promise<void> {
    try {
      const data = message.data as Transfer
      const result = await this.sendMessage<{ success: boolean, transaction: Transfer }>(
        "createTransferTx",
        data
      )

      if (this.blockchainSlice) {
        this.blockchainSlice.refreshStatus()
        this.blockchainSlice.getAssetBalances(data.signer)
      }

      // Mask the signature to prevent unauthorized custody
      if (result.transaction) {
        result.transaction.signature = "[MASKED]";
      }

      respond(message, result)
    } catch (error) {
      respond(message, undefined, {
        code: 'CREATE_TRANSFER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create transfer transaction'
      })
    }
  }

  /**
   * Handle SIGN_PREDICTION message
   */
  async handleSignPrediction(message: Message): Promise<void> {
    try {
      const data = message.data as any
      const result = await this.sendMessage<{ success: boolean, transaction: Transfer }>("createPredictionTx", data)

      if (this.blockchainSlice) {
        this.blockchainSlice.refreshStatus()
        this.blockchainSlice.getAssetBalances(data.signer)
      }

      // Mask the signature to prevent unauthorized custody
      if (result.transaction) {
        result.transaction.signature = "[MASKED]";
      }

      respond(message, result)
    } catch (error) {
      respond(message, undefined, {
        code: 'SIGN_PREDICTION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to sign prediction'
      })
    }
  }

  /**
   * Handle CLAIM_REWARDS message
   */
  async handleClaimRewards(message: Message): Promise<void> {
    try {
      const data = message.data as any
      console.log(data)
      const result = await this.sendMessage<{ success: boolean, transaction: Transfer }>("createClaimRewardTx", data)

      if (this.blockchainSlice) {
        this.blockchainSlice.refreshStatus()
        this.blockchainSlice.getAssetBalances(data.signer)
      }

      // Mask the signature to prevent unauthorized custody
      if (result.transaction) {
        result.transaction.signature = "[MASKED]";
      }

      respond(message, result)
    } catch (error) {
      respond(message, undefined, {
        code: 'SIGN_CLAIM_REWARDS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to sign rewards claim'
      })
    }
  }

  /**
   * Handle SEARCH_MEMPOOL message
   * This searches for transactions in the mempool that match given criteria
   */
  async handleSearchMempool(message: Message): Promise<void> {
    try {
      // Extract search criteria from the message
      const { criteria, subnetId } = message.data as { criteria: Record<string, any>, subnetId?: string }

      if (!criteria || Object.keys(criteria).length === 0) {
        throw new Error("Search criteria are required")
      }

      // Search the mempool using the background script
      const searchResult = await this.sendMessage<{
        success: boolean,
        transactions: any[],
        error?: string
      }>("searchMempool", { criteria, subnetId })

      respond(message, searchResult)
    } catch (error) {
      respond(message, undefined, {
        code: 'SEARCH_MEMPOOL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to search mempool'
      })
    }
  }

  /**
   * Handle REQUEST_TRANSACTION_CUSTODY message
   * This transfers custody of a transaction to the requesting app
   */
  async handleRequestTransactionCustody(message: Message): Promise<void> {
    try {
      // Extract criteria from the message
      const { criteria, subnetId } = message.data as { criteria: Record<string, any>, subnetId?: string }

      if (!criteria || Object.keys(criteria).length === 0) {
        throw new Error("Transaction criteria are required for custody request")
      }

      // Request custody by discarding the transaction from wallet's mempool
      // The background handler will find the transaction and return its data
      const custodyResult = await this.sendMessage<{
        success: boolean,
        transaction: any,
        discardedFrom: string[]
      }>("requestTransactionCustody", { criteria, subnetId })

      // If the transaction wasn't found, the background will return success: false
      if (!custodyResult.success) {
        throw new Error(`Transaction matching criteria not found`)
      }

      // Refresh blockchain state after custody transfer
      if (this.blockchainSlice) {
        this.blockchainSlice.refreshStatus()
      }

      respond(message, custodyResult)
    } catch (error) {
      respond(message, undefined, {
        code: 'REQUEST_CUSTODY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to transfer transaction custody'
      })
    }
  }

  /**
   * Handle DEPLOY_TOKEN_SUBNET message
   * Deploys a token subnet wrapper contract
   */
  async handleDeployTokenSubnet(message: Message): Promise<void> {
    try {
      // Extract parameters from the message
      const params = message.data as {
        tokenContract: string;
        versionName: string;
        versionNumber: string;
        batchSize: number;
        description?: string;
      };

      // Validate basic parameters
      if (!params.tokenContract || !params.versionName || !params.versionNumber) {
        throw new Error("Required parameters missing: tokenContract, versionName, and versionNumber are required");
      }

      // Forward to background script for processing
      const deploymentResult = await this.sendMessage<{
        success: boolean;
        txId?: string;
        contractId?: string;
        error?: string;
      }>("deployTokenSubnet", params);

      // Refresh blockchain state after deployment
      if (this.blockchainSlice) {
        this.blockchainSlice.refreshStatus();
      }

      respond(message, deploymentResult);
    } catch (error) {
      respond(message, undefined, {
        code: 'DEPLOY_TOKEN_SUBNET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to deploy token subnet'
      });
    }
  }

  /**
   * Handle GENERATE_SUBNET_CODE message
   * Generates subnet wrapper contract code without deploying
   */
  async handleGenerateSubnetCode(message: Message): Promise<void> {
    try {
      // Extract parameters from the message
      const params = message.data as {
        tokenContract: string;
        versionName: string;
        versionNumber: string;
        batchSize: number;
        description?: string;
      };

      // Validate basic parameters
      if (!params.tokenContract || !params.versionName || !params.versionNumber) {
        throw new Error("Required parameters missing: tokenContract, versionName, and versionNumber are required");
      }

      // Forward to background script for processing
      const codeResult = await this.sendMessage<{
        success: boolean;
        code?: string;
        error?: string;
      }>("generateSubnetCode", params);

      respond(message, codeResult);
    } catch (error) {
      respond(message, undefined, {
        code: 'GENERATE_SUBNET_CODE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate subnet code'
      });
    }
  }

  /**
   * Handle EXECUTE_DEX_SWAP message
   * Executes a swap operation via Dexterity SDK
   */
  async handleExecuteDexSwap(message: Message): Promise<void> {
    try {
      // Extract parameters from the message
      const params = message.data as {
        route: {
          hops: Array<{
            vault: any;
            opcode: any;
          }>;
        };
        amount: number;
        options?: {
          disablePostConditions?: boolean;
          sponsored?: boolean;
        };
      };

      // Validate basic parameters
      if (!params.route || !params.route.hops || !Array.isArray(params.route.hops) || params.route.hops.length === 0) {
        throw new Error("Required parameters missing: route with valid hops is required");
      }

      if (typeof params.amount !== 'number' || params.amount <= 0) {
        throw new Error("Invalid amount: must be a positive number");
      }

      // Forward to background script for processing
      const swapResult = await this.sendMessage<{
        success: boolean;
        txId?: string;
        error?: string;
      }>("executeDexSwap", params);

      respond(message, swapResult);
    } catch (error) {
      respond(message, undefined, {
        code: 'EXECUTE_DEX_SWAP_ERROR',
        message: error instanceof Error ? error.message : 'Failed to execute Dexterity swap'
      });
    }
  }
}