import { NextResponse } from 'next/server';
import { getDisplayNamesForUsers } from '@/lib/leaderboard-kv';

export async function POST(request: Request) {
    try {
        const { userIds }: { userIds: string[] } = await request.json();

        if (!Array.isArray(userIds)) {
            return NextResponse.json(
                { error: 'userIds must be an array' },
                { status: 400 }
            );
        }

        // Get display names from server-side BNS lookup
        const displayNames = await getDisplayNamesForUsers(userIds);

        return NextResponse.json({ displayNames });
    } catch (error) {
        console.error('Failed to get BNS names:', error);

        // Fallback to truncated addresses if BNS lookup fails
        const { userIds } = await request.json();
        const fallbackNames: Record<string, string> = {};

        if (Array.isArray(userIds)) {
            userIds.forEach((userId: string) => {
                fallbackNames[userId] = userId.length > 12
                    ? `${userId.slice(0, 6)}...${userId.slice(-4)}`
                    : userId;
            });
        }

        return NextResponse.json({ displayNames: fallbackNames });
    }
} 