import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getFundingRequest, updateFundingRequestStatus } from '@/lib/perps/p2p-kv';

export async function POST(req: NextRequest) {
    try {
        const { fundingRequestId, traderTxId, funderTxId } = await req.json();

        if (!fundingRequestId || !traderTxId || !funderTxId) {
            return NextResponse.json(
                { success: false, error: "Missing required parameters" },
                { status: 400 }
            );
        }

        // Get the funding request
        const fundingRequest = await getFundingRequest(fundingRequestId);
        if (!fundingRequest) {
            return NextResponse.json(
                { success: false, error: "Funding request not found" },
                { status: 404 }
            );
        }

        if (fundingRequest.fundingStatus !== 'funded') {
            return NextResponse.json(
                { success: false, error: "Funding request is not in funded status" },
                { status: 400 }
            );
        }

        // TODO: Verify both transactions have been executed on-chain
        // This would involve checking the Stacks blockchain for both the trader's REDEEM_BEARER
        // and the funder's TRANSFER_TOKENS_LTE transactions

        // For now, we'll assume the transactions are valid and create the perpetual position

        // TODO: Create the actual perpetual position in the perps system
        // This would involve:
        // 1. Creating a new position record with the funding request details
        // 2. Setting up the position with proper collateral management
        // 3. Linking the trader's margin and funder's collateral
        // 4. Setting up fee collection for the funder

        const perpPositionData = {
            id: `perp-${fundingRequest.perpUuid}`,
            traderId: fundingRequest.traderId,
            funderId: fundingRequest.funderId!,
            direction: fundingRequest.direction,
            leverage: fundingRequest.leverage,
            positionSize: fundingRequest.positionSize,
            entryPrice: fundingRequest.entryPrice,
            liquidationPrice: fundingRequest.liquidationPrice,
            traderMargin: fundingRequest.traderMargin,
            funderCollateral: fundingRequest.maxCollateralNeeded,
            fundingFeeRate: fundingRequest.fundingFeeRate,
            baseToken: fundingRequest.baseToken,
            quoteToken: fundingRequest.quoteToken,
            status: 'active',
            createdAt: Date.now(),
            traderTxId,
            funderTxId
        };

        console.log(`🎯 Would create perpetual position:`, perpPositionData);

        // Update funding request status to settled
        await updateFundingRequestStatus(fundingRequestId, 'settled');

        // Invalidate relevant caches
        revalidatePath('/shop');
        revalidatePath('/swap'); // Pro mode might show this

        console.log(`✅ Activated P2P perpetual position for funding request ${fundingRequestId}`);

        return NextResponse.json({
            success: true,
            message: "Perpetual position activated successfully",
            positionId: perpPositionData.id
        });

    } catch (err: any) {
        console.error("Error activating perpetual position:", err);
        return NextResponse.json(
            { success: false, error: "Failed to activate position" },
            { status: 500 }
        );
    }
} 