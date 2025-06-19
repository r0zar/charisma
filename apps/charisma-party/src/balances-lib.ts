import { getAccountBalances } from '@repo/polyglot';

export interface BalanceData {
  userId: string;
  contractId: string;
  balance: string;
  totalSent: string;
  totalReceived: string;
  timestamp: number;
  source: string;
}

/**
 * Fetch balances for multiple users efficiently using getAccountBalances
 * Each call gets ALL token balances for that user
 */
export async function fetchUserBalances(userIds: string[]): Promise<Record<string, BalanceData>> {
  console.log(`💰 Fetching balances for ${userIds.length} users`);

  const balanceUpdates: Record<string, BalanceData> = {};
  const timestamp = Date.now();

  // Process users in parallel with some rate limiting
  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        const accountBalances = await getAccountBalances(userId, { unanchored: true });

        if (!accountBalances) {
          console.warn(`No balances found for user: ${userId}`);
          return null;
        }

        // Process STX balance
        if (accountBalances.stx) {
          const key = `${userId}:.stx`;
          balanceUpdates[key] = {
            userId,
            contractId: '.stx',
            balance: accountBalances.stx.balance,
            totalSent: accountBalances.stx.total_sent,
            totalReceived: accountBalances.stx.total_received,
            timestamp,
            source: 'hiro-api'
          };
        }

        // Process all fungible token balances
        if (accountBalances.fungible_tokens) {
          Object.entries(accountBalances.fungible_tokens).forEach(([contractId, tokenBalance]) => {
            const balance = tokenBalance as { balance: string; total_sent: string; total_received: string };
            const key = `${userId}:${contractId}`;
            balanceUpdates[key] = {
              userId,
              contractId,
              balance: balance.balance,
              totalSent: balance.total_sent,
              totalReceived: balance.total_received,
              timestamp,
              source: 'hiro-api'
            };
          });
        }

        console.log(`✅ Fetched balances for ${userId}: ${Object.keys(accountBalances.fungible_tokens || {}).length + 1} tokens`);
        return accountBalances;

      } catch (error) {
        console.error(`❌ Failed to fetch balances for ${userId}:`, error);
        return null;
      }
    })
  );

  // Log summary
  const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  const failed = results.length - successful;
  const totalBalances = Object.keys(balanceUpdates).length;

  console.log(`📊 Balance fetch summary:`);
  console.log(`   • ${successful} users successful, ${failed} failed`);
  console.log(`   • ${totalBalances} total balance entries`);
  console.log(`   → Broadcasting ${totalBalances} balance updates`);

  return balanceUpdates;
}