import { NextRequest, NextResponse } from 'next/server';
import { resolveBNSToAddress, isValidBNSFormat } from '@/lib/twitter-triggers/bns-resolver';

// POST /api/v1/twitter-triggers/resolve-bns - Test BNS resolution
export async function POST(request: NextRequest) {
    try {
        const { bnsName } = await request.json();
        
        if (!bnsName || typeof bnsName !== 'string') {
            return NextResponse.json({
                success: false,
                error: 'BNS name is required'
            }, { status: 400 });
        }
        
        // Clean and validate the BNS name
        const cleanName = bnsName.toLowerCase().replace('@', '');
        
        if (!isValidBNSFormat(cleanName)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid BNS name format. Must be in format: username.btc'
            }, { status: 400 });
        }
        
        // Attempt to resolve the BNS name
        const resolution = await resolveBNSToAddress(cleanName);
        
        return NextResponse.json({
            success: true,
            data: {
                bnsName: cleanName,
                ...resolution
            }
        });
        
    } catch (error) {
        console.error('[BNS API] Error resolving BNS name:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to resolve BNS name'
        }, { status: 500 });
    }
}