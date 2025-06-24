import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { fetchNonce } from '@stacks/transactions';
import { BLAZE_SOLVER_ADDRESS } from '@/lib/constants';

// POST /api/admin/nonce/reset - Reset nonce counter to fix gaps
export async function POST(request: NextRequest) {
    try {
        console.log('[Nonce Reset API] Starting manual nonce reset...');
        
        const nonceKey = `nonce_counter:${BLAZE_SOLVER_ADDRESS}`;
        
        // Get current state
        const currentCounter = await kv.get(nonceKey);
        const blockchainNonce = await fetchNonce({ address: BLAZE_SOLVER_ADDRESS });
        const blockchainNonceNum = Number(blockchainNonce);
        
        console.log('[Nonce Reset API] Current state:', {
            redisCounter: currentCounter,
            blockchainNonce: blockchainNonceNum,
            gap: currentCounter ? Number(currentCounter) - blockchainNonceNum : 'N/A'
        });
        
        // Clear the Redis counter to force fresh blockchain nonce usage
        await kv.del(nonceKey);
        
        console.log('[Nonce Reset API] ✅ Redis nonce counter cleared');
        console.log('[Nonce Reset API] 🔧 System will now use fresh blockchain nonce for all transactions');
        
        return NextResponse.json({
            success: true,
            message: 'Nonce counter reset successfully',
            data: {
                previousCounter: currentCounter,
                currentBlockchainNonce: blockchainNonceNum,
                action: 'Redis counter cleared - will use blockchain nonce',
                nextNonce: blockchainNonceNum
            }
        }, { status: 200 });
        
    } catch (error) {
        console.error('[Nonce Reset API] Error resetting nonce:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to reset nonce counter'
        }, { status: 500 });
    }
}

// GET /api/admin/nonce/reset - Check current nonce state
export async function GET(request: NextRequest) {
    try {
        const nonceKey = `nonce_counter:${BLAZE_SOLVER_ADDRESS}`;
        
        // Get current state
        const currentCounter = await kv.get(nonceKey);
        const blockchainNonce = await fetchNonce({ address: BLAZE_SOLVER_ADDRESS });
        const blockchainNonceNum = Number(blockchainNonce);
        
        const gap = currentCounter ? Number(currentCounter) - blockchainNonceNum : 0;
        const hasGap = gap > 0;
        
        return NextResponse.json({
            success: true,
            data: {
                redisCounter: currentCounter,
                blockchainNonce: blockchainNonceNum,
                gap: gap,
                hasGap: hasGap,
                status: hasGap ? 'GAP DETECTED - System may be stuck' : 'Normal operation',
                recommendation: hasGap ? 'POST to this endpoint to reset' : 'No action needed'
            }
        }, { status: 200 });
        
    } catch (error) {
        console.error('[Nonce Reset API] Error checking nonce state:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to check nonce state'
        }, { status: 500 });
    }
}