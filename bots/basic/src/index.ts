export {
  ContractCaller,
  createContractCaller,
  callContract,
  type ContractCallArgs,
  type ContractCallResult,
  type BotCredentials
} from './contract-caller';

// Re-export useful types from @stacks/transactions
export type { StacksTransactionWire } from '@stacks/transactions';

/**
 * @bots/basic - Basic contract calling utilities for bot strategies
 * 
 * This package provides a simple interface for making contract calls
 * from bot strategies running in the Vercel sandbox environment.
 * 
 * Usage:
 * 
 * ```typescript
 * import { createContractCaller } from '@bots/basic';
 * 
 * const caller = createContractCaller({ privateKey: bot.walletCredentials.privateKey });
 * const result = await caller.call('SP123...', 'my-contract', 'my-function', []);
 * ```
 */