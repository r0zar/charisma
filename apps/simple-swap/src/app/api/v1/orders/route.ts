import { NextResponse } from 'next/server';
import { listOrders, listOrdersPaginated } from '@/lib/orders/store';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const owner = searchParams.get('owner') || undefined;
        
        // Check if pagination is requested
        const pageParam = searchParams.get('page');
        const limitParam = searchParams.get('limit');
        const sortBy = searchParams.get('sortBy') as 'createdAt' | 'status' || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc';
        let statusFilter = searchParams.get('status') as 'all' | 'open' | 'broadcasted' | 'confirmed' | 'failed' | 'cancelled' || 'all';
        const searchQuery = searchParams.get('search') || undefined;
        
        // Handle legacy 'filled' status by mapping to 'broadcasted'
        if (statusFilter === 'filled' as any) {
            statusFilter = 'broadcasted';
        }
        
        if (pageParam || limitParam) {
            // Return paginated results
            const page = pageParam ? parseInt(pageParam, 10) : 1;
            const limit = limitParam ? parseInt(limitParam, 10) : 10;
            
            // Validate pagination parameters
            if (isNaN(page) || page < 1) {
                return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 });
            }
            if (isNaN(limit) || limit < 1 || limit > 50) {
                return NextResponse.json({ error: 'Invalid limit parameter (1-50)' }, { status: 400 });
            }
            
            const result = await listOrdersPaginated(owner, page, limit, sortBy, sortOrder, statusFilter, searchQuery);
            return NextResponse.json({ 
                status: 'success', 
                data: result.orders,
                pagination: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    totalPages: result.totalPages,
                    hasNextPage: result.hasNextPage,
                    hasPrevPage: result.hasPrevPage
                }
            });
        } else {
            // Return all orders (legacy behavior)
            const orders = await listOrders(owner);
            return NextResponse.json({ status: 'success', data: orders });
        }
    } catch (err) {
        console.error('Orders list error', err);
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
} 