import { NextRequest, NextResponse } from 'next/server';
import { getUserTokenBalance } from '@repo/balances';
import { getUserVotes } from '@/lib/state'; // Assuming getUserVotes fetches from KV
import type { Vote } from '@/types/spin';

// Define the subnet CHA contract ID (ensure this matches what WalletContext uses)
const CHARISMA_SUBNET_CONTRACT_ID =
    process.env.NEXT_PUBLIC_CHARISMA_CONTRACT_ID ||
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
        return NextResponse.json({ success: false, error: 'userAddress query parameter is required' }, { status: 400 });
    }

    try {
        // 1. Fetch raw subnet balance
        const balanceData = await getUserTokenBalance(CHARISMA_SUBNET_CONTRACT_ID, userAddress);
        const rawSubnetBalance = BigInt(balanceData.preconfirmationBalance || '0');

        // 2. Fetch user's committed votes
        const userVotes: Vote[] = await getUserVotes(userAddress);

        // 3. Sum total committed CHA
        let totalCommittedCHA = 0n;
        if (userVotes && userVotes.length > 0) {
            totalCommittedCHA = userVotes.reduce((sum, vote) => {
                // Ensure voteAmountCHA is treated as a number/BigInt before adding
                const voteAmount = BigInt(vote.voteAmountCHA || '0');
                return sum + voteAmount;
            }, 0n);
        }

        // 4. Calculate effective spendable balance
        const effectiveSpendableBalance = rawSubnetBalance - totalCommittedCHA;

        // Ensure effective balance doesn't go below zero
        const finalEffectiveBalance = effectiveSpendableBalance < 0n ? 0n : effectiveSpendableBalance;

        return NextResponse.json({
            success: true,
            data: {
                rawSubnetBalance: rawSubnetBalance.toString(),
                totalCommittedCHA: totalCommittedCHA.toString(),
                effectiveSpendableBalance: finalEffectiveBalance.toString(),
            }
        });

    } catch (error: any) {
        console.error(`[API /effective-cha] Error fetching effective balance for ${userAddress}:`, error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to calculate effective balance' }, { status: 500 });
    }
}

// Optional: Configure for Edge runtime if KV access is Edge-compatible
// export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 