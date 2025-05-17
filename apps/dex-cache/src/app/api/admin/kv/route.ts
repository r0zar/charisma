import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Simple admin key for authentication - in production use a proper auth system
const ADMIN_SECRET = process.env.ADMIN_SECRET;

/**
 * Search for keys in the KV store
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const authKey = searchParams.get('key');
    const pattern = searchParams.get('pattern') || '*';
    const valueKey = searchParams.get('valueKey');

    try {
        if (valueKey) {
            // If a specific key is requested, return its value
            const value = await kv.get(valueKey);
            return NextResponse.json({
                success: true,
                key: valueKey,
                value
            });
        } else {
            // List keys matching the pattern
            const keys = await kv.keys(pattern);

            // Get some basic stats
            const stats = {
                totalKeys: keys.length,
                keysByPrefix: keys.reduce((acc, key) => {
                    const prefix = key.split(':')[0] || 'other';
                    acc[prefix] = (acc[prefix] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>)
            };

            return NextResponse.json({
                success: true,
                pattern,
                keys,
                stats
            });
        }
    } catch (error) {
        console.error('Error accessing KV store:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to access KV store',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

/**
 * Delete a key from the KV store
 */
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const authKey = searchParams.get('key');
    const deleteKey = searchParams.get('deleteKey');

    // Basic auth check
    if (authKey !== ADMIN_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!deleteKey) {
        return NextResponse.json({ error: 'deleteKey parameter is required' }, { status: 400 });
    }

    try {
        await kv.del(deleteKey);
        return NextResponse.json({
            success: true,
            message: `Key "${deleteKey}" deleted successfully`
        });
    } catch (error) {
        console.error(`Error deleting key ${deleteKey}:`, error);
        return NextResponse.json({
            success: false,
            error: 'Failed to delete key',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
} 