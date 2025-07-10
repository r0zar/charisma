import { z } from 'zod';

export const TokenBalanceSchema = z.object({
  contractId: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().min(1),
  balance: z.number().int().min(0),
  decimals: z.number().int().min(0).max(18),
  image: z.string().optional(),
  usdValue: z.number().min(0).optional(),
});

export const WalletTransactionSchema = z.object({
  txId: z.string().min(1),
  timestamp: z.string().datetime(),
  type: z.enum(['send', 'receive', 'contract-call', 'deploy']),
  amount: z.number().min(0),
  token: z.string().min(1),
  status: z.enum(['pending', 'confirmed', 'failed']),
  blockHeight: z.number().int().min(0).optional(),
  fee: z.number().min(0),
  memo: z.string().optional(),
});

export const WalletStateSchema = z.object({
  isConnected: z.boolean(),
  address: z.string().nullable(),
  network: z.enum(['mainnet', 'testnet', 'devnet']),
  balance: z.object({
    stx: z.number().min(0),
    tokens: z.array(TokenBalanceSchema),
  }),
  transactions: z.array(WalletTransactionSchema),
  connectionMethod: z.enum(['hiro', 'xverse', 'ledger']).nullable(),
});

// Infer TypeScript types from schemas
export type TokenBalance = z.infer<typeof TokenBalanceSchema>;
export type WalletTransaction = z.infer<typeof WalletTransactionSchema>;
export type WalletState = z.infer<typeof WalletStateSchema>;