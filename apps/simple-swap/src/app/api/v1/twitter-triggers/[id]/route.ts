import { NextRequest, NextResponse } from 'next/server';
import { getTwitterTriggerWithStats, updateTwitterTrigger, deleteTwitterTrigger } from '@/lib/twitter-triggers/store';

// GET /api/v1/twitter-triggers/[id] - Get specific trigger with stats
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = await params;

        const trigger = await getTwitterTriggerWithStats(id);

        if (!trigger) {
            return NextResponse.json({
                success: false,
                error: 'Twitter trigger not found'
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: trigger
        });

    } catch (error) {
        console.error(`[Twitter API] Error getting trigger ${params.id}:`, error);
        return NextResponse.json({
            success: false,
            error: 'Failed to get Twitter trigger'
        }, { status: 500 });
    }
}

// PUT /api/v1/twitter-triggers/[id] - Update trigger
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = await params;
        const updates = await request.json();

        // Only allow certain fields to be updated
        const allowedUpdates = {
            isActive: updates.isActive,
            maxTriggers: updates.maxTriggers,
            validTo: updates.validTo,
        };

        // Remove undefined values
        const cleanUpdates = Object.fromEntries(
            Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
        );

        if (Object.keys(cleanUpdates).length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No valid updates provided'
            }, { status: 400 });
        }

        const updatedTrigger = await updateTwitterTrigger(id, cleanUpdates);

        if (!updatedTrigger) {
            return NextResponse.json({
                success: false,
                error: 'Twitter trigger not found'
            }, { status: 404 });
        }

        console.log(`[Twitter API] Updated trigger ${id}`);

        return NextResponse.json({
            success: true,
            data: updatedTrigger,
            message: 'Twitter trigger updated successfully'
        });

    } catch (error) {
        console.error(`[Twitter API] Error updating trigger ${params.id}:`, error);
        return NextResponse.json({
            success: false,
            error: 'Failed to update Twitter trigger'
        }, { status: 500 });
    }
}

// DELETE /api/v1/twitter-triggers/[id] - Delete trigger
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = await params;

        const deleted = await deleteTwitterTrigger(id);

        if (!deleted) {
            return NextResponse.json({
                success: false,
                error: 'Twitter trigger not found'
            }, { status: 404 });
        }

        console.log(`[Twitter API] Deleted trigger ${id}`);

        return NextResponse.json({
            success: true,
            message: 'Twitter trigger deleted successfully'
        });

    } catch (error) {
        console.error(`[Twitter API] Error deleting trigger ${params.id}:`, error);
        return NextResponse.json({
            success: false,
            error: 'Failed to delete Twitter trigger'
        }, { status: 500 });
    }
}