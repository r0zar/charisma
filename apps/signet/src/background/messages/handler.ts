import type { PlasmoMessaging } from "@plasmohq/messaging"
import * as wallet from "../lib/wallet"
import * as tokens from "../lib/tokens"
import type { SeedPhrase, Account, CreateAccountOptions } from "../lib/wallet/types"
import type { MessageAction } from "~shared/context/types"

interface MessageRequest {
  action: MessageAction;
  data?: any;
}

// Secrets never leave the background: the UI gets accounts without keys and seed phrases without words
const withoutKey = ({ privateKey, ...account }: Account) => account;
const withoutWords = ({ phrase, ...seedPhrase }: SeedPhrase) => seedPhrase;

const requireString = (value: unknown, what: string) => {
  if (!value || typeof value !== "string") throw new Error(`Invalid ${what}`);
  return value;
};

/**
 * Wallet UI (side panel) requests: lock and unlock, seed phrases, accounts, balances and sends.
 * Website requests go through the standard provider instead (lib/provider.ts).
 */
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const { action, data } = req.body as MessageRequest;
    // Log the action only: bodies can carry passwords and seed phrases
    console.log(`Handling: ${action}`);

    let response;

    switch (action) {
      // Lock
      case "initializeWallet":
        response = await wallet.initializeWallet(requireString(data?.password, "wallet password"));
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

      case "resetWallet":
        response = await wallet.resetWallet();
        break;

      case "exportWalletData":
        response = await wallet.exportVault();
        break;

      // Seed phrases
      case "createSeedPhrase":
        response = withoutWords(await wallet.createNewSeedPhrase(requireString(data?.name, "seed phrase name")));
        break;

      case "importSeedPhrase":
        response = withoutWords(await wallet.importSeedPhrase(
          requireString(data?.name, "seed phrase name"),
          requireString(data?.phrase, "seed phrase")
        ));
        break;

      case "getAllSeedPhrases":
        response = (await wallet.getAllSeedPhrases()).map(withoutWords);
        break;

      case "deleteSeedPhrase":
        response = await wallet.deleteSeedPhrase(requireString(data?.id, "seed phrase ID"));
        break;

      // Accounts
      case "createAccount": {
        const options: CreateAccountOptions = {
          seedPhraseId: requireString(data?.seedPhraseId, "seed phrase ID"),
          index: data.index,
          makeActive: data.makeActive
        };
        const created = await wallet.createAccount(options);
        response = created && withoutKey(created);
        break;
      }

      case "getAccount": {
        const account = await wallet.getAccount(requireString(data?.id, "account ID"));
        response = account && withoutKey(account);
        break;
      }

      case "getAllAccounts":
        response = (await wallet.getAllAccounts()).map(withoutKey);
        break;

      case "getAccountsForSeedPhrase":
        response = (await wallet.getAccountsForSeedPhrase(requireString(data?.seedPhraseId, "seed phrase ID"))).map(withoutKey);
        break;

      case "activateAccount":
        response = await wallet.activateAccount(requireString(data?.id, "account ID"));
        break;

      case "getCurrentAccount": {
        const current = await wallet.getCurrentAccount();
        response = current && withoutKey(current);
        break;
      }

      case "deleteAccount":
        response = await wallet.deleteAccount(requireString(data?.id, "account ID"));
        break;

      // Balances and sends
      case "getWalletBalances":
        response = await tokens.getWalletBalances();
        break;

      case "sendToken":
        if (typeof data?.contractId !== "string" || typeof data?.recipient !== "string" || typeof data?.amount !== "string") {
          throw new Error("Invalid send: contractId, recipient and amount are required");
        }
        response = await tokens.sendToken(data);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    res.send({ success: true, data: response });
  } catch (error) {
    console.error("Error in message handler:", error);
    res.send({ success: false, error: error.message || "Unknown error" });
  }
}

export default handler
