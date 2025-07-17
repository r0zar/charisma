import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function extractTimestampFromPath(path: string): number | null {
    const parts = path.split('/');
    if (parts.length !== 5) return null;
    const [_, year, month, day, timeFile] = parts;
    const [hour, minute] = timeFile.replace('.json', '').split('-');
    const date = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
    ));
    return date.getTime();
}

function convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                // Escape commas and quotes in CSV
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');
    
    return csvContent;
}

function convertToXLSX(data: any[]): string {
    // Simple XML-based XLSX format (minimal implementation)
    // For a full implementation, you'd want to use a library like xlsx
    const headers = Object.keys(data[0] || {});
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Price Snapshots">
<Table>
<Row>`;
    
    // Headers
    headers.forEach(header => {
        xml += `<Cell><Data ss:Type="String">${header}</Data></Cell>`;
    });
    xml += '</Row>';
    
    // Data rows
    data.forEach(row => {
        xml += '<Row>';
        headers.forEach(header => {
            const value = row[header];
            const type = typeof value === 'number' ? 'Number' : 'String';
            xml += `<Cell><Data ss:Type="${type}">${value}</Data></Cell>`;
        });
        xml += '</Row>';
    });
    
    xml += '</Table></Worksheet></Workbook>';
    return xml;
}

export async function GET(request: NextRequest) {
    if (!BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json({ error: 'Export not available - storage not configured' }, { status: 500 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'json';
        const timeRange = searchParams.get('timeRange') || '24h';
        const limit = parseInt(searchParams.get('limit') || '100');

        console.log(`[ExportAPI] Exporting snapshots: format=${format}, timeRange=${timeRange}, limit=${limit}`);

        // Calculate time range
        const now = Date.now();
        let startTime = 0;
        
        switch (timeRange) {
            case '1h':
                startTime = now - (60 * 60 * 1000);
                break;
            case '24h':
                startTime = now - (24 * 60 * 60 * 1000);
                break;
            case '7d':
                startTime = now - (7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startTime = now - (30 * 24 * 60 * 60 * 1000);
                break;
        }

        // List all snapshot files
        const blobs = await list({
            prefix: 'snapshots/',
            token: BLOB_READ_WRITE_TOKEN,
            limit: 1000
        });

        // Filter and sort by timestamp
        const filtered = blobs.blobs
            .map(blob => ({ ...blob, timestamp: extractTimestampFromPath(blob.pathname) }))
            .filter(blob => blob.timestamp && blob.timestamp >= startTime)
            .sort((a, b) => (b.timestamp! - a.timestamp!))
            .slice(0, limit);

        // Fetch and format snapshot data
        const snapshots: any[] = [];
        
        for (const blob of filtered) {
            try {
                const response = await fetch(blob.url);
                if (!response.ok) continue;
                
                const data = await response.json();
                
                // Flatten the data for export
                const flatSnapshot = {
                    id: String(blob.timestamp),
                    timestamp: new Date(blob.timestamp!).toISOString(),
                    totalTokens: data.metadata?.totalTokens || 0,
                    successfulPrices: Object.keys(data.prices || {}).length,
                    failedPrices: (data.metadata?.totalTokens || 0) - Object.keys(data.prices || {}).length,
                    oracleEngineCount: data.metadata?.engineStats?.oracle || 0,
                    marketEngineCount: data.metadata?.engineStats?.market || 0,
                    intrinsicEngineCount: data.metadata?.engineStats?.intrinsic || 0,
                    hybridEngineCount: data.metadata?.engineStats?.hybrid || 0,
                    calculationTimeMs: data.metadata?.calculationTime || 0,
                    arbitrageOpportunities: data.metadata?.arbitrageOpportunities || 0,
                    btcPrice: data.metadata?.btcPrice || null,
                    storageSize: blob.size
                };
                
                snapshots.push(flatSnapshot);
            } catch (error) {
                console.error(`[ExportAPI] Error processing blob ${blob.pathname}:`, error);
            }
        }

        let responseData: string | Uint8Array;
        let contentType: string;
        let filename: string;

        const timestamp = new Date().toISOString().split('T')[0];

        switch (format.toLowerCase()) {
            case 'csv':
                responseData = convertToCSV(snapshots);
                contentType = 'text/csv';
                filename = `price-snapshots-${timeRange}-${timestamp}.csv`;
                break;
                
            case 'xlsx':
                responseData = convertToXLSX(snapshots);
                contentType = 'application/vnd.ms-excel';
                filename = `price-snapshots-${timeRange}-${timestamp}.xlsx`;
                break;
                
            case 'json':
            default:
                responseData = JSON.stringify({
                    metadata: {
                        timeRange,
                        exportedAt: new Date().toISOString(),
                        totalSnapshots: snapshots.length,
                        format: 'json'
                    },
                    snapshots
                }, null, 2);
                contentType = 'application/json';
                filename = `price-snapshots-${timeRange}-${timestamp}.json`;
                break;
        }

        return new NextResponse(responseData, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-cache'
            }
        });

    } catch (error) {
        console.error('[ExportAPI] Export failed:', error);
        return NextResponse.json({
            error: 'Export failed',
            message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        }, { status: 500 });
    }
}