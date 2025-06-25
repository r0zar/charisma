import { NextResponse } from 'next/server';
import { 
    initializeServerRavenCache, 
    getServerRavenCacheStatus,
    getServerUserRavenIds,
    getServerHighestRavenId 
} from '@/lib/server/raven-cache';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userAddress = searchParams.get('userAddress');
        
        // Initialize server cache if needed
        await initializeServerRavenCache();
        
        if (userAddress) {
            // Return specific user's Raven data
            const ravenIds = getServerUserRavenIds(userAddress);
            const highestRavenId = getServerHighestRavenId(userAddress);
            
            return NextResponse.json({
                success: true,
                userAddress,
                ravenIds,
                highestRavenId,
                cacheStatus: getServerRavenCacheStatus()
            });
        } else {
            // Return cache status only
            const status = getServerRavenCacheStatus();
            
            return NextResponse.json({
                success: true,
                cacheStatus: status
            });
        }
        
    } catch (error) {
        console.error('Error in raven-cache API:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get Raven cache data' },
            { status: 500 }
        );
    }
}

// Optional: Allow manual cache refresh
export async function POST() {
    try {
        // Force update the server cache
        const { updateServerRavenCache } = await import('@/lib/server/raven-cache');
        await updateServerRavenCache();
        
        return NextResponse.json({
            success: true,
            message: 'Server Raven cache updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating server Raven cache:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update server Raven cache' },
            { status: 500 }
        );
    }
}