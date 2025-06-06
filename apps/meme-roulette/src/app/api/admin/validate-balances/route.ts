import { NextRequest, NextResponse } from 'next/server';
import { validateUserBalancesBeforeSpin, cleanInvalidIntentsFromQueue } from '@/lib/state';
import { verifySignatureAndGetSigner } from 'blaze-sdk';
import { listPrices, type KraxelPriceData } from '@repo/tokens';

// CHA token contract ID
const CHA_TOKEN_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token";

// Function to get current CHA price using the same logic as useTokenPrices
async function getCHAPrice(): Promise<number> {
    try {
        const priceData: KraxelPriceData = await listPrices();
        const chaPrice = priceData[CHA_TOKEN_CONTRACT];

        if (typeof chaPrice === 'number' && chaPrice > 0) {
            return chaPrice;
        }

        // Fallback price if CHA price not found or invalid
        console.warn('CHA price not found in price data, using fallback');
        return 0.0015;
    } catch (error) {
        console.warn('Failed to fetch CHA price from @repo/tokens, using fallback:', error);
        return 0.0015; // Fallback price
    }
}

// Convert atomic units to decimal CHA (6 decimal places)
function atomicToDecimal(atomicAmount: number): number {
    return atomicAmount / 1_000_000;
}

export async function POST(request: NextRequest) {
    const verificationResult = await verifySignatureAndGetSigner(request, {
        message: 'Validate user balances',
    });

    if (verificationResult.signer !== 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS') {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        console.log('🔍 Admin triggered balance validation...');
        const processingStart = Date.now();

        // Get current CHA price
        const chaPrice = await getCHAPrice();
        console.log(`💰 Current CHA price: $${chaPrice}`);

        // Perform balance validation
        const balanceValidation = await validateUserBalancesBeforeSpin();
        const { validVotes, invalidVotes, partialVotes, validTokenBets } = balanceValidation;

        const validUserCount = Object.keys(validVotes).length;
        const invalidUserCount = Object.keys(invalidVotes).length;
        const partialUserCount = Object.keys(partialVotes).length;
        const validTokenCount = Object.keys(validTokenBets).length;

        // Calculate totals (keeping in atomic units for calculations)
        let totalValidCHA = 0;
        let totalInvalidCHA = 0;
        let totalPartialValidCHA = 0;
        let totalPartialInvalidCHA = 0;

        // Valid users (all votes valid)
        Object.values(validVotes).forEach(votes => {
            totalValidCHA += votes.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
        });

        // Invalid users (all votes invalid)
        Object.values(invalidVotes).forEach(votes => {
            totalInvalidCHA += votes.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
        });

        // Partial users (some votes valid, some invalid)
        Object.values(partialVotes).forEach(({ valid, invalid }) => {
            totalPartialValidCHA += valid.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
            totalPartialInvalidCHA += invalid.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
        });

        // Combine valid amounts
        const totalValidAmount = totalValidCHA + totalPartialValidCHA;
        const totalInvalidAmount = totalInvalidCHA + totalPartialInvalidCHA;

        // Convert to decimal for USD calculations
        const totalValidDecimal = atomicToDecimal(totalValidAmount);
        const totalInvalidDecimal = atomicToDecimal(totalInvalidAmount);

        // Prepare detailed user information
        const validUsers = Object.entries(validVotes).map(([userId, votes]) => {
            const totalVotedCHA = votes.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
            return {
                userId,
                status: 'valid',
                totalVotedCHA, // Keep in atomic units for frontend conversion
                validVotedCHA: totalVotedCHA,
                invalidVotedCHA: 0,
                voteCount: votes.length,
                validVoteCount: votes.length,
                invalidVoteCount: 0
            };
        });

        const partialUsers = Object.entries(partialVotes).map(([userId, { valid, invalid }]) => {
            const validAmount = valid.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
            const invalidAmount = invalid.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
            return {
                userId,
                status: 'partial',
                totalVotedCHA: validAmount + invalidAmount, // Keep in atomic units
                validVotedCHA: validAmount,
                invalidVotedCHA: invalidAmount,
                voteCount: valid.length + invalid.length,
                validVoteCount: valid.length,
                invalidVoteCount: invalid.length
            };
        });

        const invalidUsers = Object.entries(invalidVotes).map(([userId, votes]) => {
            const totalVotedCHA = votes.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
            return {
                userId,
                status: 'invalid',
                totalVotedCHA, // Keep in atomic units
                validVotedCHA: 0,
                invalidVotedCHA: totalVotedCHA,
                voteCount: votes.length,
                validVoteCount: 0,
                invalidVoteCount: votes.length
            };
        });

        // Clean invalid intents from queue (only fully invalid + partial invalid votes)
        const allInvalidVotes = { ...invalidVotes };
        Object.entries(partialVotes).forEach(([userId, { invalid }]) => {
            if (invalid.length > 0) {
                allInvalidVotes[userId] = invalid;
            }
        });

        let queueCleaning = null;
        if (Object.keys(allInvalidVotes).length > 0) {
            queueCleaning = await cleanInvalidIntentsFromQueue(allInvalidVotes);
        }

        const processingTime = Date.now() - processingStart;

        return NextResponse.json({
            success: true,
            timestamp: Date.now(),
            stats: {
                validCHA: totalValidAmount, // Atomic units for frontend conversion
                invalidCHA: totalInvalidAmount,
                totalCHA: totalValidAmount + totalInvalidAmount,
                validUSD: totalValidDecimal * chaPrice,
                invalidUSD: totalInvalidDecimal * chaPrice,
                totalUSD: (totalValidDecimal + totalInvalidDecimal) * chaPrice
            },
            validUsers,
            partialUsers,
            invalidUsers,
            details: {
                totalUsers: validUserCount + partialUserCount + invalidUserCount,
                fullyValidUsers: validUserCount,
                partiallyValidUsers: partialUserCount,
                invalidUsers: invalidUserCount,
                validTokens: validTokenCount,
                chaPrice,
                processingTime
            },
            validation: {
                validUsers: validUserCount,
                partialUsers: partialUserCount,
                invalidUsers: invalidUserCount,
                validTokens: validTokenCount,
                totalValidCHA: totalValidAmount,
                totalInvalidCHA: totalInvalidAmount,
                validTokenBets
            },
            queueCleaning
        });
    } catch (error) {
        console.error('Admin balance validation error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

export async function GET() {
    // Non-authenticated endpoint to just check validation without cleaning
    try {
        const processingStart = Date.now();

        // Get current CHA price
        const chaPrice = await getCHAPrice();

        const balanceValidation = await validateUserBalancesBeforeSpin();
        const { validVotes, invalidVotes, partialVotes, validTokenBets } = balanceValidation;

        const validUserCount = Object.keys(validVotes).length;
        const invalidUserCount = Object.keys(invalidVotes).length;
        const partialUserCount = Object.keys(partialVotes).length;
        const validTokenCount = Object.keys(validTokenBets).length;

        let totalValidCHA = 0;
        let totalInvalidCHA = 0;

        Object.values(validVotes).forEach(votes => {
            totalValidCHA += votes.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
        });

        Object.values(invalidVotes).forEach(votes => {
            totalInvalidCHA += votes.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
        });

        // Add partial validation amounts
        Object.values(partialVotes).forEach(({ valid, invalid }) => {
            totalValidCHA += valid.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
            totalInvalidCHA += invalid.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
        });

        const processingTime = Date.now() - processingStart;

        return NextResponse.json({
            success: true,
            timestamp: Date.now(),
            validation: {
                validUsers: validUserCount,
                partialUsers: partialUserCount,
                invalidUsers: invalidUserCount,
                validTokens: validTokenCount,
                totalValidCHA,
                totalInvalidCHA,
                validTokenBets
            },
            details: {
                totalUsers: validUserCount + partialUserCount + invalidUserCount,
                fullyValidUsers: validUserCount,
                partiallyValidUsers: partialUserCount,
                invalidUsers: invalidUserCount,
                processingTime,
                chaPrice
            },
            note: "Read-only validation - queue not cleaned. Use POST to clean invalid intents."
        });
    } catch (error) {
        console.error('Balance validation check error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 