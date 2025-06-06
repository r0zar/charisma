import { NextRequest, NextResponse } from 'next/server';
import {
    getKVSpinStatus,
    setKVWinningToken,
    validateUserBalancesBeforeSpin,
    resetKVForNextSpin,
    updateATHIfNeeded,
    setPreviousRoundAmount
} from '@/lib/state';
import { listTokens } from 'dexterity-sdk';
import { cleanInvalidIntentsFromQueue } from '@/lib/state';

const isDev = process.env.NODE_ENV === 'development';
const BASE_URL = isDev ? 'http://localhost:3010' : 'https://lol.charisma.rocks';

export async function GET(req: NextRequest) {
    try {
        console.log('🕐 Cron: Checking spin status...');

        const status = await getKVSpinStatus();
        const now = Date.now();
        const timeLeft = status.spinScheduledAt - now;

        // Check if spin time has passed and no winner is set
        if (timeLeft <= 0 && !status.winningTokenId) {
            console.log('🎰 Cron: Spin time reached! Starting winner selection process...');

            // STAGE 1: Validate user balances
            console.log('🔍 Cron: Starting balance validation phase...');
            const balanceValidation = await validateUserBalancesBeforeSpin();
            const { validVotes, invalidVotes, validTokenBets } = balanceValidation;

            const validUserCount = Object.keys(validVotes).length;
            const invalidUserCount = Object.keys(invalidVotes).length;

            console.log(`✅ Cron: Validation complete - ${validUserCount} valid users, ${invalidUserCount} invalid users`);

            if (invalidUserCount > 0) {
                console.log(`❌ Cron: Excluded votes from ${invalidUserCount} users due to insufficient balances`);

                // Clean invalid intents from the multihop queue
                const queueCleaning = await cleanInvalidIntentsFromQueue(invalidVotes);
                console.log(`🧹 Cron: Queue cleaning complete:`);
                console.log(`   Total intents: ${queueCleaning.totalIntents}`);
                console.log(`   Removed intents: ${queueCleaning.removedIntents}`);
                console.log(`   Remaining intents: ${queueCleaning.remainingIntents}`);
            }

            // STAGE 2: Fetch current tokens and determine winner
            const tokens = await listTokens();
            const currentTokens = tokens || [];

            let winnerId: string | null = null;

            console.log("Cron: Current token list:", JSON.stringify(currentTokens.map(t => ({ id: t.contractId, symbol: t.symbol }))));
            console.log("Cron: Validated token bets:", JSON.stringify(validTokenBets));

            // Only consider bets for tokens that exist AND have valid user balances
            const validTokenIds = new Set(currentTokens.map(token => token.contractId));
            const tokensWithBets = Object.entries(validTokenBets)
                .filter(([tokenId, amount]) =>
                    validTokenIds.has(tokenId) &&
                    typeof amount === 'number' &&
                    amount > 0
                )
                .map(([tokenId, amount]) => {
                    const token = currentTokens.find(t => t.contractId === tokenId);
                    return {
                        id: tokenId,
                        symbol: token?.symbol || 'UNKNOWN',
                        amount
                    };
                });

            if (tokensWithBets.length > 0) {
                // Calculate total bet amount
                const totalBets = tokensWithBets.reduce((sum, token) => sum + token.amount, 0);
                console.log(`Cron: Total valid bets: ${totalBets}`);

                // Log the percentage chance for each token
                tokensWithBets.forEach(token => {
                    const percentage = (token.amount / totalBets) * 100;
                    console.log(`Cron: Token ${token.id} (${token.symbol}) has ${token.amount} bets (${percentage.toFixed(2)}% chance)`);
                });

                // For extra randomness, shuffle the tokens first
                const shuffledTokens = [...tokensWithBets].sort(() => Math.random() - 0.5);

                // Generate a random point along the total bet amount
                const randomValue = Math.random();
                const randomPoint = randomValue * totalBets;
                console.log(`Cron: Random value: ${randomValue}, random point: ${randomPoint}`);

                // Find which token's bet range contains this point
                let cumulativeBet = 0;
                for (const token of shuffledTokens) {
                    const prevCumulative = cumulativeBet;
                    cumulativeBet += token.amount;
                    console.log(`Cron: Token ${token.id} (${token.symbol}) range: ${prevCumulative} to ${cumulativeBet}`);

                    if (randomPoint <= cumulativeBet) {
                        winnerId = token.id;
                        console.log(`Cron: Selected token ${token.id} (${token.symbol}) because ${randomPoint} <= ${cumulativeBet}`);
                        break;
                    }
                }

                // Double-check the winner exists in the current token list
                if (winnerId && !validTokenIds.has(winnerId)) {
                    console.error(`Cron: CRITICAL ERROR - Selected winner ${winnerId} is not in current token list!`);
                    // Fallback to highest bet valid token
                    const highestBetToken = tokensWithBets.reduce((max, token) =>
                        token.amount > max.amount ? token : max, tokensWithBets[0]);
                    winnerId = highestBetToken.id;
                    console.log(`Cron: Fallback selection - highest bet valid token ${winnerId} (${highestBetToken.symbol})`);
                }

                // If somehow no token was selected (shouldn't happen), select based on highest bet
                if (!winnerId && shuffledTokens.length > 0) {
                    const highestBetToken = shuffledTokens.reduce((max, token) =>
                        token.amount > max.amount ? token : max, shuffledTokens[0]);
                    winnerId = highestBetToken.id;
                    console.log(`Cron: Fallback selection - highest bet token ${winnerId} (${highestBetToken.symbol})`);
                }

                console.log(`Cron: Spin finished, winning token: ${winnerId} (weighted selection from ${tokensWithBets.length} tokens with bets)`);
            } else if (currentTokens.length > 0) {
                // If no valid bets, select a random token from the current token list
                const randomIndex = Math.floor(Math.random() * currentTokens.length);
                winnerId = currentTokens[randomIndex].contractId;
                console.log(`Cron: No valid bets found, selecting random token from current list. Winning token: ${winnerId} (${currentTokens[randomIndex].symbol})`);
            } else {
                console.log(`Cron: Spin finished, but no tokens available to select a winner.`);
                winnerId = 'none';
            }

            // Verify winner token exists before setting
            if (winnerId && winnerId !== 'none') {
                const winnerExists = currentTokens.some(token => token.contractId === winnerId);
                if (!winnerExists) {
                    console.error(`Cron: ERROR - Cannot set winner to ${winnerId} as it does not exist in current token list`);
                    // Emergency fallback - pick first token in list
                    winnerId = currentTokens.length > 0 ? currentTokens[0].contractId : 'none';
                    console.log(`Cron: Emergency fallback - setting winner to ${winnerId}`);
                }
            }

            // STAGE 3: Set the winner
            await setKVWinningToken(winnerId);
            console.log(`🎯 Cron: Winner set to: ${winnerId}`);

            // STAGE 4: Trigger processing of queued intents
            try {
                console.log('🔄 Cron: Triggering processing of queued intents...');
                const response = await fetch(`${BASE_URL}/api/multihop/process`, {
                    method: 'POST',
                    headers: {
                        'User-Agent': 'Meme-Roulette-Cron/1.0'
                    }
                });

                if (response.ok) {
                    console.log('✅ Cron: Successfully triggered intent processing');
                } else {
                    console.error('❌ Cron: Failed to trigger intent processing:', response.status, response.statusText);
                }
            } catch (e) {
                console.error('❌ Cron: Failed to trigger intent processing:', e);
            }

            // STAGE 5: Reset for next round (after a delay)
            console.log('⏳ Cron: Waiting 60 seconds before resetting for next round...');
            setTimeout(async () => {
                try {
                    console.log('🔄 Cron: Resetting for next round...');
                    await resetKVForNextSpin();
                    console.log('✅ Cron: Successfully reset for next round');
                } catch (error) {
                    console.error('❌ Cron: Error during reset:', error);
                }
            }, 60000);

            return NextResponse.json({
                success: true,
                message: 'Winner selection completed',
                winnerId,
                timestamp: now,
                validUsers: validUserCount,
                invalidUsers: invalidUserCount
            });
        } else if (status.winningTokenId) {
            console.log('ℹ️ Cron: Winner already selected for this round:', status.winningTokenId);
            return NextResponse.json({
                success: true,
                message: 'Winner already selected',
                winnerId: status.winningTokenId,
                timestamp: now
            });
        } else {
            const minutesLeft = Math.ceil(timeLeft / 60000);
            console.log(`⏰ Cron: Spin not ready yet. ${minutesLeft} minutes remaining.`);
            return NextResponse.json({
                success: true,
                message: 'Spin not ready yet',
                timeLeft,
                minutesLeft,
                timestamp: now
            });
        }

    } catch (error) {
        console.error('❌ Cron: Error in process-queue cron job:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
        }, { status: 500 });
    }
} 