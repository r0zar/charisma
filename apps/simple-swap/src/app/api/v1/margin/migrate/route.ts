import { NextResponse } from 'next/server';
import { listPositions } from '@/lib/perps/store';
import { getMarginAccount, updateMarginUsage } from '@/lib/margin/store';

// Migrate a specific user's positions to the margin system
async function migrateUserPositions(owner: string): Promise<{ migrated: boolean; adjustment: number; positions: number }> {
    try {
        // Get user's open positions
        const allPositions = await listPositions(owner);
        const openPositions = allPositions.filter((p: any) => p.status === 'open');

        if (openPositions.length === 0) {
            return { migrated: false, adjustment: 0, positions: 0 };
        }

        // Get current margin account
        const marginAccount = await getMarginAccount(owner);

        // Calculate total margin that should be used based on open positions
        let expectedUsedMargin = 0;
        for (const position of openPositions) {
            if (position.marginRequired) {
                expectedUsedMargin += parseFloat(position.marginRequired);
            }
        }

        // Check if there's a significant mismatch (more than $0.01 difference)
        const currentUsedMargin = marginAccount.usedMargin;
        const marginDifference = Math.abs(expectedUsedMargin - currentUsedMargin);

        if (marginDifference > 0.01) {
            // Update to correct margin usage
            const marginAdjustment = expectedUsedMargin - currentUsedMargin;
            await updateMarginUsage({
                owner,
                usedMarginChange: marginAdjustment
            });

            return {
                migrated: true,
                adjustment: marginAdjustment,
                positions: openPositions.length
            };
        }

        return { migrated: false, adjustment: 0, positions: openPositions.length };
    } catch (error) {
        console.error(`Error migrating positions for user ${owner}:`, error);
        throw error;
    }
}

// POST /api/v1/margin/migrate - Migrate specific user or all users
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { owner } = body;

        if (owner) {
            // Migrate specific user
            console.log(`🔧 Migrating positions for user: ${owner.substring(0, 8)}...`);

            const result = await migrateUserPositions(owner);

            if (result.migrated) {
                console.log(`✅ Migrated ${result.positions} positions for ${owner.substring(0, 8)}, adjusted margin by ${result.adjustment >= 0 ? '+' : ''}${result.adjustment.toFixed(2)}`);

                return NextResponse.json({
                    status: 'success',
                    message: `Migrated ${result.positions} positions`,
                    data: {
                        owner: owner.substring(0, 8) + '...',
                        positionsMigrated: result.positions,
                        marginAdjustment: result.adjustment
                    }
                });
            } else {
                return NextResponse.json({
                    status: 'success',
                    message: 'No migration needed - margin already correct',
                    data: {
                        owner: owner.substring(0, 8) + '...',
                        openPositions: result.positions,
                        marginAdjustment: 0
                    }
                });
            }
        } else {
            // Migrate all users with open positions
            console.log('🔧 Starting bulk migration for all users with open positions...');

            const allPositions = await listPositions();
            const openPositions = allPositions.filter((p: any) => p.status === 'open');

            if (openPositions.length === 0) {
                return NextResponse.json({
                    status: 'success',
                    message: 'No open positions found - nothing to migrate'
                });
            }

            // Group positions by owner
            const positionsByOwner: Record<string, any[]> = {};
            openPositions.forEach((position: any) => {
                if (!positionsByOwner[position.owner]) {
                    positionsByOwner[position.owner] = [];
                }
                positionsByOwner[position.owner].push(position);
            });

            const results = [];
            let totalMigrated = 0;
            let totalAdjustment = 0;

            for (const [userOwner, positions] of Object.entries(positionsByOwner)) {
                const result = await migrateUserPositions(userOwner);
                if (result.migrated) {
                    results.push({
                        owner: userOwner.substring(0, 8) + '...',
                        positions: result.positions,
                        adjustment: result.adjustment
                    });
                    totalMigrated += result.positions;
                    totalAdjustment += result.adjustment;
                }
            }

            console.log(`✅ Bulk migration complete: ${results.length} users, ${totalMigrated} positions, ${totalAdjustment >= 0 ? '+' : ''}${totalAdjustment.toFixed(2)} total adjustment`);

            return NextResponse.json({
                status: 'success',
                message: `Migrated ${totalMigrated} positions for ${results.length} users`,
                data: {
                    usersMigrated: results.length,
                    totalPositions: totalMigrated,
                    totalMarginAdjustment: totalAdjustment,
                    details: results
                }
            });
        }
    } catch (error) {
        console.error('❌ Migration error:', error);
        return NextResponse.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Migration failed'
        }, { status: 500 });
    }
}

// GET /api/v1/margin/migrate - Check migration status
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const owner = searchParams.get('owner');

        if (owner) {
            // Check specific user
            const allPositions = await listPositions(owner);
            const openPositions = allPositions.filter((p: any) => p.status === 'open');

            if (openPositions.length === 0) {
                return NextResponse.json({
                    status: 'success',
                    needsMigration: false,
                    message: 'No open positions'
                });
            }

            const marginAccount = await getMarginAccount(owner);

            let expectedUsedMargin = 0;
            for (const position of openPositions) {
                if (position.marginRequired) {
                    expectedUsedMargin += parseFloat(position.marginRequired);
                }
            }

            const marginDifference = Math.abs(expectedUsedMargin - marginAccount.usedMargin);
            const needsMigration = marginDifference > 0.01;

            return NextResponse.json({
                status: 'success',
                needsMigration,
                data: {
                    owner: owner.substring(0, 8) + '...',
                    openPositions: openPositions.length,
                    expectedUsedMargin,
                    currentUsedMargin: marginAccount.usedMargin,
                    difference: marginDifference
                }
            });
        } else {
            // Check all users
            const allPositions = await listPositions();
            const openPositions = allPositions.filter((p: any) => p.status === 'open');

            const positionsByOwner: Record<string, any[]> = {};
            openPositions.forEach((position: any) => {
                if (!positionsByOwner[position.owner]) {
                    positionsByOwner[position.owner] = [];
                }
                positionsByOwner[position.owner].push(position);
            });

            const usersNeedingMigration = [];
            let totalPositionsNeedingMigration = 0;

            for (const [userOwner, positions] of Object.entries(positionsByOwner)) {
                const marginAccount = await getMarginAccount(userOwner);

                let expectedUsedMargin = 0;
                for (const position of positions) {
                    if (position.marginRequired) {
                        expectedUsedMargin += parseFloat(position.marginRequired);
                    }
                }

                const marginDifference = Math.abs(expectedUsedMargin - marginAccount.usedMargin);
                if (marginDifference > 0.01) {
                    usersNeedingMigration.push({
                        owner: userOwner.substring(0, 8) + '...',
                        positions: positions.length,
                        expectedMargin: expectedUsedMargin,
                        currentMargin: marginAccount.usedMargin,
                        difference: marginDifference
                    });
                    totalPositionsNeedingMigration += positions.length;
                }
            }

            return NextResponse.json({
                status: 'success',
                needsMigration: usersNeedingMigration.length > 0,
                data: {
                    usersNeedingMigration: usersNeedingMigration.length,
                    totalPositionsNeedingMigration,
                    details: usersNeedingMigration
                }
            });
        }
    } catch (error) {
        console.error('❌ Migration check error:', error);
        return NextResponse.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Migration check failed'
        }, { status: 500 });
    }
} 