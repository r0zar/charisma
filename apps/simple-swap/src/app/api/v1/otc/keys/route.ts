// app/api/v1/otc/keys/route.ts
import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        // Get all keys that match the prefix for offers
        const keys = await kv.keys('otc:offer:*');

        // Extract just the UUIDs from the keys
        const uuids = keys.map(key => {
            // Extract the UUID part from the key format "otc:offer:UUID"
            const parts = key.split(':');
            return parts.length >= 3 ? parts[2] : key;
        });

        return NextResponse.json({
            success: true,
            keys: uuids
        });
    } catch (error) {
        console.error('Error fetching offer keys:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch offer keys'
            },
            { status: 500 }
        );
    }
}