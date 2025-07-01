import { broadcastTransaction, makeContractCall } from '@stacks/transactions';
import { type NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { BotData, EncryptedWalletData, BotActivityRecord } from '@/types/bot';

// Hard-coded contract values from hoot-farmer
const CONTRACT_ADDRESS = "SPGYCP878RYFVT03ZT8TWGPKNYTSQB1578VVXHGE";
const CONTRACT_NAME = "powerful-farmer";
const FUNCTION_NAME = "execute-both";

// Encryption utilities (copied from bot creation)
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('WALLET_ENCRYPTION_KEY environment variable is required');
}

function decryptText(encryptedText: string, iv: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY!).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Cron job handler to execute yield farming for all active yield farming bots
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // --- Security Check ---
    if (!cronSecret) {
        console.error("CRON_SECRET environment variable is not set.");
        return NextResponse.json({ status: 'error', message: 'Server configuration error (missing cron secret).' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("Unauthorized cron job access attempt.");
        return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    // --- Environment Check ---
    if (!ENCRYPTION_KEY) {
        console.error("WALLET_ENCRYPTION_KEY environment variable is not set.");
        return NextResponse.json({ status: 'error', message: 'Server configuration error (missing encryption key).' }, { status: 500 });
    }

    console.log("Yield Farmers Cron: Starting execution for all active yield farming bots...");

    try {
        // --- Discover All Active Yield Farming Bots ---
        const allUserKeys = await kv.keys('user_bots:*');
        const activeBots: Array<{ bot: BotData; userAddress: string; walletData: EncryptedWalletData }> = [];

        for (const userKey of allUserKeys) {
            const userAddress = userKey.replace('user_bots:', '');
            const botIds = await kv.get<string[]>(userKey) || [];

            for (const botId of botIds) {
                const botStorageKey = `bot:${userAddress}:${botId}`;
                const walletStorageKey = `wallet:${userAddress}:${botId}`;
                
                const [botData, walletData] = await Promise.all([
                    kv.get<BotData>(botStorageKey),
                    kv.get<EncryptedWalletData>(walletStorageKey)
                ]);

                if (botData && walletData && 
                    botData.strategy === 'yield-farming' && 
                    botData.status === 'active') {
                    activeBots.push({ bot: botData, userAddress, walletData });
                }
            }
        }

        console.log(`Yield Farmers Cron: Found ${activeBots.length} active yield farming bots`);

        if (activeBots.length === 0) {
            return NextResponse.json({ 
                status: 'success', 
                message: 'No active yield farming bots found',
                processedBots: 0,
                successfulOperations: 0,
                failedOperations: 0
            });
        }

        // --- Process Each Bot ---
        const results = {
            processedBots: activeBots.length,
            successfulOperations: 0,
            failedOperations: 0,
            transactions: [] as string[]
        };

        for (const { bot, userAddress, walletData } of activeBots) {
            const activityId = crypto.randomUUID();
            const timestamp = new Date().toISOString();

            // Create initial activity record
            const activityRecord: BotActivityRecord = {
                id: activityId,
                botId: bot.id,
                timestamp,
                action: 'yield-farming',
                status: 'pending',
                contractAddress: CONTRACT_ADDRESS,
                contractName: CONTRACT_NAME,
                functionName: FUNCTION_NAME
            };

            try {
                console.log(`Yield Farmers Cron: Processing bot ${bot.id} (${bot.name}) for user ${userAddress}`);

                // Decrypt bot's private key
                const privateKey = decryptText(walletData.encryptedPrivateKey, walletData.privateKeyIv);

                // Create and broadcast transaction
                const transaction = await makeContractCall({
                    contractAddress: CONTRACT_ADDRESS,
                    contractName: CONTRACT_NAME,
                    functionName: FUNCTION_NAME,
                    functionArgs: [],
                    postConditionMode: 'allow',
                    senderKey: privateKey,
                });

                const result = await broadcastTransaction({ transaction });

                // Update activity record with success
                activityRecord.txid = result.txid;
                activityRecord.status = 'success';

                // Update bot's lastActive timestamp
                const updatedBot = { ...bot, lastActive: timestamp };
                await kv.set(`bot:${userAddress}:${bot.id}`, updatedBot);

                results.successfulOperations++;
                results.transactions.push(result.txid);

                console.log(`Yield Farmers Cron: Successfully executed farming for bot ${bot.id}, TxID: ${result.txid}`);

            } catch (error: any) {
                console.error(`Yield Farmers Cron: Error executing farming for bot ${bot.id}:`, error);

                // Update activity record with failure
                activityRecord.status = 'failure';
                activityRecord.errorMessage = error instanceof Error ? error.message : String(error);

                results.failedOperations++;
            }

            // Store activity record
            try {
                const activityKey = `bot_activity:${userAddress}:${bot.id}`;
                const existingActivities = await kv.get<BotActivityRecord[]>(activityKey) || [];
                
                // Add new activity to the beginning and keep only last 50
                const updatedActivities = [activityRecord, ...existingActivities].slice(0, 50);
                await kv.set(activityKey, updatedActivities);

            } catch (activityError) {
                console.error(`Yield Farmers Cron: Failed to store activity record for bot ${bot.id}:`, activityError);
            }
        }

        // --- Return Results ---
        console.log(`Yield Farmers Cron: Completed processing. Success: ${results.successfulOperations}, Failed: ${results.failedOperations}`);

        return NextResponse.json({
            status: 'success',
            message: `Processed ${results.processedBots} bots`,
            processedBots: results.processedBots,
            successfulOperations: results.successfulOperations,
            failedOperations: results.failedOperations,
            transactions: results.transactions
        });

    } catch (error: any) {
        console.error("Yield Farmers Cron: Fatal error during execution:", error);
        let errorMessage = 'An unknown error occurred';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json(
            { status: 'error', message: `Cron execution failed: ${errorMessage}` },
            { status: 500 }
        );
    }
}