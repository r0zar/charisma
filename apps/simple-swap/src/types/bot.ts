export interface BotData {
  id: string;
  name: string;
  strategy: string;
  status: 'inactive' | 'active' | 'paused' | 'error';
  walletAddress: string;
  dailyPnL: number;
  totalPnL: number;
  lastActive: string;
  createdAt: string;
  userId: string;
}

export interface CreateBotRequest {
  strategy: string;
  userAddress: string;
}

export interface CreateBotResponse extends BotData {
  mnemonic: string;
  privateKey: string;
}

export interface UpdateStatusRequest {
  status: 'active' | 'paused' | 'inactive';
  userAddress: string;
}

export interface EncryptedWalletData {
  encryptedMnemonic: string;
  encryptedPrivateKey: string;
  mnemonicIv: string;
  privateKeyIv: string;
  walletAddress: string;
}

export interface BotActivityRecord {
  id: string;
  botId: string;
  timestamp: string;
  action: 'yield-farming' | 'withdraw-lp-tokens';
  txid?: string;
  status: 'success' | 'failure' | 'pending';
  contractAddress: string;
  contractName: string;
  functionName: string;
  errorMessage?: string;
  amount?: number; // For withdrawal records
  recipient?: string; // For withdrawal records
  blockHeight?: number; // Block height when confirmed
  blockTime?: string; // ISO timestamp when confirmed
}