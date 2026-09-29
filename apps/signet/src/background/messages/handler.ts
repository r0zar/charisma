import type { PlasmoMessaging } from "@plasmohq/messaging"
import { subnetRegistry } from "../index"
import { TransactionType, WELSH, assets } from "../lib/constants"
import type {
  TransactionRequest,
  Transfer,
  Prediction,
  ClaimReward,
  TransferMessage
} from "../lib/types"

// Import wallet functionality
import * as wallet from "../lib/wallet"
import type { SeedPhrase, Account, CreateAccountOptions } from "../lib/wallet/types"
import type { MessageAction } from "~shared/context/types"

import * as tokens from "../lib/tokens"

// Import Dexterity integration module
import * as dexterity from "../lib/dexterity"

interface MessageRequest {
  action: MessageAction;
  data?: any;
}

// Secrets never leave the background: the UI gets accounts without keys and seed phrases without words
const withoutKey = ({ privateKey, ...account }: Account) => account;
const withoutWords = ({ phrase, ...seedPhrase }: SeedPhrase) => seedPhrase;

/**
 * Unified background message handler
 * Routes messages to the appropriate service based on action
 */
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const { action, data } = req.body as MessageRequest;
    // Log the action only: bodies can carry passwords and seed phrases
    console.log(`Handling: ${action}`);

    let response;

    switch (action) {
      // Subnet operations
      case "getStatus":
        response = subnetRegistry.getStatus();
        break;

      case "getBalance":
        const welsh = await subnetRegistry.getSubnet(WELSH).fetchContractBalance(data.address);
        response = { [WELSH]: welsh }
        break;

      case "getBalances":
        response = await subnetRegistry.getBalances();
        break;

      // Asset operations
      case "getAssetBalances":
        const subnetBalances = await subnetRegistry.getBalance(data.address);

        // Convert to asset balances
        const assetBalances: Record<string, number> = {};

        // Map each asset to its corresponding subnet balance
        for (const asset of assets) {
          // Find the subnet balance for this asset's subnet
          const balance = subnetBalances[asset.subnet] || 0;
          assetBalances[asset.id] = balance;
        }

        response = assetBalances;
        break;

      // Regular (on-chain) balances and sends, from the wallet UI
      case "getWalletBalances":
        response = await tokens.getWalletBalances();
        break;

      case "sendToken":
        if (typeof data?.contractId !== "string" || typeof data?.recipient !== "string" || typeof data?.amount !== "string") {
          throw new Error("Invalid send: contractId, recipient and amount are required");
        }
        response = await tokens.sendToken(data);
        break;

      case "setSigner":
        if (!data?.address || typeof data.address !== "string") {
          throw new Error("Invalid signer address");
        }
        subnetRegistry.signer = data.address;
        response = { success: true, signer: subnetRegistry.signer };
        break;

      // Wallet initialization
      case "initializeWallet":
        if (!data?.password || typeof data.password !== "string") {
          throw new Error("Invalid wallet password");
        }
        response = await wallet.initializeWallet(data.password);
        break;

      case "checkWalletInitialized":
        response = await wallet.checkWalletInitialized();
        break;

      case "hasWallet":
        response = await wallet.hasWallet();
        break;

      case "endWalletSession":
        response = await wallet.endSession();
        break;

      // Seed phrase management
      case "createSeedPhrase":
        if (!data?.name || typeof data.name !== "string") {
          throw new Error("Invalid seed phrase name");
        }
        response = withoutWords(await wallet.createNewSeedPhrase(data.name));
        break;

      case "importSeedPhrase":
        if (!data?.name || typeof data.name !== "string" ||
          !data?.phrase || typeof data.phrase !== "string") {
          throw new Error("Invalid seed phrase import data");
        }
        response = withoutWords(await wallet.importSeedPhrase(data.name, data.phrase));
        break;

      case "getAllSeedPhrases":
        response = (await wallet.getAllSeedPhrases()).map(withoutWords);
        break;

      case "deleteSeedPhrase":
        if (!data?.id || typeof data.id !== "string") {
          throw new Error("Invalid seed phrase ID");
        }
        response = await wallet.deleteSeedPhrase(data.id);
        break;

      // Account management
      case "createAccount":
        if (!data?.seedPhraseId || typeof data.seedPhraseId !== "string") {
          throw new Error("Invalid account creation data");
        }

        const options: CreateAccountOptions = {
          seedPhraseId: data.seedPhraseId,
          index: data.index,
          makeActive: data.makeActive
        };

        const created = await wallet.createAccount(options);

        // If account creation successful and marked active, update the subnet registry signer
        if (created?.isActive) {
          subnetRegistry.signer = created.stxAddress;
        }
        response = created && withoutKey(created);
        break;

      case "getAccount":
        if (!data?.id || typeof data.id !== "string") {
          throw new Error("Invalid account ID");
        }
        const account = await wallet.getAccount(data.id);
        response = account && withoutKey(account);
        break;

      case "getAllAccounts":
        response = (await wallet.getAllAccounts()).map(withoutKey);
        break;

      case "getAccountsForSeedPhrase":
        if (!data?.seedPhraseId || typeof data.seedPhraseId !== "string") {
          throw new Error("Invalid seed phrase ID");
        }
        response = (await wallet.getAccountsForSeedPhrase(data.seedPhraseId)).map(withoutKey);
        break;

      case "activateAccount":
        if (!data?.id || typeof data.id !== "string") {
          throw new Error("Invalid account ID");
        }

        const activateResult = await wallet.activateAccount(data.id);

        // If activation successful, update the subnet registry signer
        if (activateResult) {
          const activeAccount = await wallet.getAccount(data.id);
          if (activeAccount) {
            subnetRegistry.signer = activeAccount.stxAddress;
          }
        }

        response = activateResult;
        break;

      case "getCurrentAccount":
        const currentAccount = await wallet.getCurrentAccount();

        // If there's a current account, update the subnet registry signer
        if (currentAccount) {
          subnetRegistry.signer = currentAccount.stxAddress;
        }

        response = currentAccount && withoutKey(currentAccount);
        break;

      case "deleteAccount":
        if (!data?.id || typeof data.id !== "string") {
          throw new Error("Invalid account ID");
        }
        response = await wallet.deleteAccount(data.id);
        break;

      case "resetWallet":
        response = await wallet.resetWallet();
        break;
        
      case "exportWalletData":
        response = await wallet.exportVault();
        break;

      case "deployTokenSubnet":
        // Validate the token subnet parameters
        if (!data?.tokenContract || !data?.versionName || !data?.versionNumber) {
          throw new Error("Required parameters missing for deploying token subnet");
        }

        // Get the current account to get the private key
        const { privateKey } = await wallet.getCurrentAccount();
        if (!privateKey) {
          throw new Error("No active wallet account");
        }

        // Use our refactored dexterity module to deploy the subnet contract
        response = await dexterity.deployTokenSubnet(
          {
            tokenContract: data.tokenContract,
            versionName: data.versionName,
            versionNumber: data.versionNumber,
            batchSize: data.batchSize || 200,
            description: data.description
          },
          subnetRegistry.signer,  // Current signer address
          privateKey              // Private key if available
        );
        break;

      case "generateSubnetCode":
        // Generate contract code without deploying (for preview)
        if (!data?.tokenContract || !data?.versionName || !data?.versionNumber) {
          throw new Error("Required parameters missing for generating subnet code");
        }

        // Use our dexterity module to generate the code with the current signer address
        response = await dexterity.generateSubnetCode({
          tokenContract: data.tokenContract,
          versionName: data.versionName,
          versionNumber: data.versionNumber,
          batchSize: data.batchSize || 200,
          description: data.description
        }, subnetRegistry.signer); // Pass the current signer address
        break

      case "executeDexSwap":
        // Execute a Dexterity swap transaction
        if (!data?.route || !data?.amount) {
          throw new Error("Required parameters missing for executing Dexterity swap");
        }

        // Get the current account to get the private key
        const currentAccountForSwap = await wallet.getCurrentAccount();

        // Execute the swap via our dexterity module
        response = await dexterity.executeDexSwap(
          {
            route: data.route,
            amount: data.amount,
            options: data.options || {}
          },
          subnetRegistry.signer, // Current signer address
          currentAccountForSwap?.privateKey // Private key if available
        );
        break;

      case "processTx":
        // Process different transaction types
        if (!data || !data.type || !data.subnetId) {
          throw new Error("Not all transaction data provided");
        }

        // Process transaction on the appropriate subnet
        await subnetRegistry.processTxRequest(data);
        response = { success: true };
        break;

      case "createTransferTx":
        // Validate input data
        if (!data.to || typeof data.amount !== "number" || typeof data.nonce !== "number") {
          throw new Error("Invalid transfer data");
        }

        // Sign the transfer using the specified subnet
        const transferSignature = await subnetRegistry.generateTransferSignature({
          to: data.to,
          amount: data.amount,
          nonce: data.nonce
        }, data.subnetId);

        // Create transfer transaction
        const transferTx = {
          type: TransactionType.TRANSFER,
          subnetId: data.subnetId,
          signature: transferSignature,
          signer: subnetRegistry.signer,
          to: data.to,
          amount: data.amount,
          nonce: data.nonce
        };

        // Process it on the appropriate subnet
        await subnetRegistry.processTxRequest(transferTx);

        response = { success: true, transaction: transferTx };
        break;

      case "createPredictionTx":
        // Validate input data
        if (!data.to || typeof data.amount !== "number" || typeof data.nonce !== "number") {
          throw new Error("Invalid transfer data");
        }

        // Sign the transfer using the specified subnet
        const signature = await subnetRegistry.generateTransferSignature({
          to: data.to,
          amount: data.amount,
          nonce: data.nonce
        }, data.subnetId);

        // Create transfer transaction
        const predictionTx: Prediction = {
          type: TransactionType.PREDICT,
          subnetId: data.to,
          signature: signature,
          signer: subnetRegistry.signer,
          amount: data.amount,
          nonce: data.nonce,
          marketId: data.marketId,
          outcomeId: data.outcomeId
        };

        // Process it on the appropriate subnet
        await subnetRegistry.processTxRequest(predictionTx);

        response = { success: true, transaction: predictionTx };
        break;

      case "createClaimRewardTx":
        // Validate input data
        if (!data.to || typeof data.receiptId !== "number" || typeof data.nonce !== "number") {
          throw new Error("Invalid transfer data");
        }

        // Sign the transfer using the specified subnet
        const receiptTransferSignature = await subnetRegistry.generateClaimSignature({
          receiptId: data.receiptId,
          nonce: data.nonce
        }, data.subnetId);

        // Create claim reward transaction
        const claimRewardTx: ClaimReward = {
          type: TransactionType.CLAIM_REWARD,
          subnetId: data.subnetId,
          signature: receiptTransferSignature,
          signer: subnetRegistry.signer,
          nonce: data.nonce,
          receiptId: data.receiptId
        };

        // Process it on the appropriate subnet
        await subnetRegistry.processTxRequest(claimRewardTx);

        response = { success: true, transaction: claimRewardTx };
        break;

      case "deposit":
        if (typeof data?.amount !== "number") {
          throw new Error("Invalid deposit amount");
        }

        if (!data?.subnetId) {
          throw new Error("Subnet ID is required for deposit");
        }

        response = await subnetRegistry.deposit(data.amount, data.subnetId);
        break;

      case "withdraw":
        if (typeof data?.amount !== "number") {
          throw new Error("Invalid withdraw amount");
        }

        if (!data?.subnetId) {
          throw new Error("Subnet ID is required for withdraw");
        }

        response = await subnetRegistry.withdraw(data.amount, data.subnetId);
        break;

      case "refreshBalances":
        await subnetRegistry.refreshBalances(data?.address);
        response = { success: true };
        break;

      case "mineSingleTransaction":
        // Validate input data
        if (!data?.signature) {
          throw new Error("Transaction signature is required for single mining");
        }

        // Mine the transaction
        response = await subnetRegistry.mineSingleTransaction(data.signature, data.subnetId);
        break;

      case "mineBatchTransactions":
        // Validate input data
        if (!data?.signatures || !Array.isArray(data.signatures) || data.signatures.length === 0) {
          throw new Error("Array of transaction signatures is required for batch mining");
        }

        // Mine the batch of transactions
        response = await subnetRegistry.mineBatchTransactions(data.signatures);
        break;

      case "discardTransaction":
        // Validate input data
        if (!data?.signature) {
          throw new Error("Transaction signature is required for discarding");
        }

        // Discard the transaction from the mempool
        response = subnetRegistry.discardTransaction(data.signature, data.subnetId);
        break;

        // Helper function to check if a transaction matches the criteria
        function transactionMatchesCriteria(tx: any, criteria: Record<string, any>): boolean {
          for (const [key, value] of Object.entries(criteria)) {
            // Try to find the property in both the transaction object and its data property
            const txValue = tx[key] !== undefined ? tx[key] :
              (tx.data && tx.data[key] !== undefined ? tx.data[key] : undefined);

            // If property doesn't exist or value doesn't match, no match
            if (txValue === undefined || txValue !== value) {
              return false;
            }
          }
          return true;
        }

        // Helper function to mask signatures in a transaction copy
        function createMaskedTransactionCopy(tx: any, subnetId?: string): any {
          const txCopy = { ...tx };

          // Mask signature in data if it exists
          if (txCopy.data && txCopy.data.signature) {
            txCopy.data.signature = "[MASKED]";
          }

          // Mask direct signature if it exists
          if (txCopy.signature) {
            txCopy.signature = "[MASKED]";
          }

          // Add subnet ID if provided
          if (subnetId) {
            txCopy.subnetId = subnetId;
          }

          return txCopy;
        }

      case "searchMempool":
        // Validate input data
        if (!data?.criteria || Object.keys(data.criteria).length === 0) {
          throw new Error("Search criteria are required");
        }

        const { criteria, subnetId } = data;
        const subnetIds = subnetRegistry.getSubnetIds();
        const matchingTxs: any[] = [];

        // If a specific subnet is provided, only search in that subnet
        if (subnetId && subnetIds.includes(subnetId)) {
          const subnet = subnetRegistry.getSubnet(subnetId);
          if (subnet) {
            // Get all transactions in this subnet's mempool
            const mempoolTxs = subnet.mempool.getQueue();

            // Filter transactions based on criteria
            for (const tx of mempoolTxs) {
              if (transactionMatchesCriteria(tx, criteria)) {
                matchingTxs.push(createMaskedTransactionCopy(tx));
              }
            }
          }
        } else {
          // Check all subnets
          for (const id of subnetIds) {
            const subnet = subnetRegistry.getSubnet(id);
            if (subnet) {
              // Get all transactions in this subnet's mempool
              const mempoolTxs = subnet.mempool.getQueue();

              // Filter transactions based on criteria
              for (const tx of mempoolTxs) {
                if (transactionMatchesCriteria(tx, criteria)) {
                  matchingTxs.push(createMaskedTransactionCopy(tx, id));
                }
              }
            }
          }
        }

        // Return matching transactions
        response = {
          success: true,
          transactions: matchingTxs
        };
        break;

      case "requestTransactionCustody":
        // Handle both signature-based and criteria-based custody requests
        let custodyTx = null;
        let custodySubnetId = null;
        const allSubnetIds = subnetRegistry.getSubnetIds();

        // First try signature-based lookup (for backward compatibility)
        if (data.signature) {
          // Check if a specific subnet is provided
          if (data.subnetId && allSubnetIds.includes(data.subnetId)) {
            const subnet = subnetRegistry.getSubnet(data.subnetId);
            if (subnet) {
              custodyTx = subnet.mempool.findTransactionBySignature(data.signature);
              if (custodyTx) {
                custodySubnetId = data.subnetId;
              }
            }
          } else {
            // Check all subnets
            for (const id of allSubnetIds) {
              const subnet = subnetRegistry.getSubnet(id);
              if (subnet) {
                const tx = subnet.mempool.findTransactionBySignature(data.signature);
                if (tx) {
                  custodyTx = tx;
                  custodySubnetId = id;
                  break;
                }
              }
            }
          }
        }
        // Then try criteria-based lookup
        else if (data.criteria && Object.keys(data.criteria).length > 0) {
          const { criteria, subnetId } = data;

          // If a specific subnet is provided, only search in that subnet
          if (subnetId && allSubnetIds.includes(subnetId)) {
            const subnet = subnetRegistry.getSubnet(subnetId);
            if (subnet) {
              // Get all transactions in this subnet's mempool
              const mempoolTxs = subnet.mempool.getQueue();

              // Find first transaction that matches all criteria
              for (const tx of mempoolTxs) {
                if (transactionMatchesCriteria(tx, criteria)) {
                  custodyTx = tx;
                  custodySubnetId = subnetId;
                  break;
                }
              }
            }
          } else {
            // Check all subnets
            for (const id of allSubnetIds) {
              const subnet = subnetRegistry.getSubnet(id);
              if (subnet) {
                // Get all transactions in this subnet's mempool
                const mempoolTxs = subnet.mempool.getQueue();

                // Find first transaction that matches all criteria
                for (const tx of mempoolTxs) {
                  if (transactionMatchesCriteria(tx, criteria)) {
                    custodyTx = tx;
                    custodySubnetId = id;
                    break;
                  }
                }

                // If we found a match, no need to check other subnets
                if (custodyTx) break;
              }
            }
          }
        } else {
          // Neither signature nor criteria provided
          response = {
            success: false,
            error: "Transaction signature or search criteria required for custody"
          };
          break;
        }

        // If transaction not found, return error
        if (!custodyTx || !custodySubnetId) {
          response = {
            success: false,
            error: "Transaction not found"
          };
          break;
        }

        // Get the signature for discarding
        const txSignature = custodyTx.data?.signature || custodyTx.signature;
        if (!txSignature) {
          response = {
            success: false,
            error: "Transaction has no signature"
          };
          break;
        }

        // Transfer custody by discarding the transaction from our mempool
        const discardResult = subnetRegistry.discardTransaction(txSignature, custodySubnetId);

        // Return the transaction data along with discard result
        response = {
          success: discardResult.success,
          transaction: custodyTx,
          discardedFrom: discardResult.removedFrom
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Send successful response
    res.send({
      success: true,
      data: response
    });

  } catch (error) {
    console.error("Error in message handler:", error);

    // Send error response
    res.send({
      success: false,
      error: error.message || "Unknown error"
    });
  }
}

export default handler