import { NextRequest, NextResponse } from 'next/server';
import { seedCharismaData } from '@/lib/utils/server-actions';

export const runtime = 'nodejs'; // Need Node.js runtime for dynamic imports

/**
 * POST /api/seed/charisma - Seed data from Charisma API
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Starting Charisma data seeding...');
    
    const result = await seedCharismaData();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.data?.message,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Seeding API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET /api/seed/charisma - Check seeding status or get info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/seed/charisma',
    method: 'POST',
    description: 'Seed addresses and contracts from Charisma investment API',
    source: 'https://invest.charisma.rocks/api/v1/prices'
  });
}