// Types for Vercel Sandbox integration

export interface SandboxConfig {
  runtime?: 'node22' | 'python3.13';
  timeout?: number; // in milliseconds
  teamId?: string;
  projectId?: string;
  token?: string;
}

export interface SandboxExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  executionTime?: number;
  sandboxId?: string;
}

export interface BotContext {
  // Bot metadata
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error' | 'inactive' | 'setup';
  wallet_address: string;
  created_at: string;
  last_active: string;
  
  // Execution mode
  testMode?: boolean;
  
  // Wallet credentials (only available in real mode)
  walletCredentials?: {
    privateKey?: string;
  };
  
  // Unified balance object
  balance: { [token: string]: number }; // e.g. { STX: 1000000, USDA: 500000, 'STX-USDA-LP': 250000 }
  
  // Bot trading methods (built-in context)
  swap(fromToken: string, toToken: string, amount: number, slippage?: number): Promise<{success: boolean, txid?: string, amountReceived?: number, error?: string}>;
  addLiquidity(token1: string, token2: string, amount1: number, amount2: number, slippage?: number): Promise<{success: boolean, txid?: string, lpTokensReceived?: number, error?: string}>;
  removeLiquidity(lpToken: string, amount: number, slippage?: number): Promise<{success: boolean, txid?: string, tokensReceived?: {[token: string]: number}, error?: string}>;
  claimRewards(contractId: string): Promise<{success: boolean, txid?: string, amountClaimed?: number, error?: string}>;
  stake(contractId: string, amount: number): Promise<{success: boolean, txid?: string, error?: string}>;
  unstake(contractId: string, amount: number): Promise<{success: boolean, txid?: string, error?: string}>;
}

export interface StrategyExecutionOptions {
  testMode?: boolean;
  timeout?: number;
  enableLogs?: boolean;
}

export interface StrategyExecutionResult {
  success: boolean;
  result?: any;
  logs?: string[];
  error?: string;
  executionTime?: number;
  sandboxId?: string;
  botContext?: Partial<BotContext>;
}

// API-specific types
export interface ApiExecuteRequest {
  code: string;
  testMode?: boolean;
  timeout?: number;
  enableLogs?: boolean;
}

export interface ApiExecuteResponse {
  success: boolean;
  result?: any;
  logs?: string[];
  error?: string;
  executionTime?: number;
  sandboxId?: string;
  botContext?: any;
}