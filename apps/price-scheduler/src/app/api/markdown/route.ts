import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    
    if (!file) {
      return NextResponse.json({ error: 'File parameter required' }, { status: 400 });
    }

    // Validate and construct file path
    let filePath: string;
    const priceServicePath = join(process.cwd(), '../../services/prices');
    
    if (file === 'README.md') {
      filePath = join(priceServicePath, 'README.md');
    } else if (file === 'ARCHITECTURE.md') {
      filePath = join(priceServicePath, 'ARCHITECTURE.md');
    } else {
      return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
    }

    // Read the markdown file
    const content = await readFile(filePath, 'utf-8');
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });

  } catch (error) {
    console.error('Error reading markdown file:', error);
    return NextResponse.json(
      { error: 'Failed to read markdown file' }, 
      { status: 500 }
    );
  }
}