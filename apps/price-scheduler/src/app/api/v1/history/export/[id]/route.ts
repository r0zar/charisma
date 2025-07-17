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

function convertToCSV(snapshot: any, prices: any[]): string {
    let csv = '';
    
    // Snapshot metadata
    csv += 'SNAPSHOT METADATA\n';
    csv += `ID,${snapshot.id}\n`;
    csv += `Timestamp,${new Date(snapshot.timestamp).toISOString()}\n`;
    csv += `Total Tokens,${snapshot.totalTokens}\n`;
    csv += `Successful Prices,${snapshot.successfulPrices}\n`;
    csv += `Failed Prices,${snapshot.failedPrices}\n`;
    csv += `Calculation Time (ms),${snapshot.calculationTimeMs}\n`;
    csv += `Arbitrage Opportunities,${snapshot.arbitrageOpportunities}\n`;
    csv += `BTC Price,${snapshot.btcPrice || 'N/A'}\n`;
    csv += `Storage Size,${snapshot.storageSize}\n`;
    csv += '\n';
    
    // Engine stats
    csv += 'ENGINE STATISTICS\n';
    csv += `Oracle,${snapshot.engineStats.oracle}\n`;
    csv += `Market,${snapshot.engineStats.market}\n`;
    csv += `Intrinsic,${snapshot.engineStats.intrinsic}\n`;
    csv += `Hybrid,${snapshot.engineStats.hybrid}\n`;
    csv += '\n';
    
    // Price data
    csv += 'PRICE DATA\n';
    csv += 'Token ID,Symbol,USD Price,sBTC Ratio,Source,Reliability,Last Updated\n';
    prices.forEach(price => {
        csv += `"${price.tokenId}",${price.symbol},${price.usdPrice},${price.sbtcRatio},${price.source},${price.reliability},${new Date(price.lastUpdated).toISOString()}\n`;
    });
    
    return csv;
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    if (!BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json({ error: 'Export not available - storage not configured' }, { status: 500 });
    }

    try {
        const { id } = await context.params;
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'json';
        
        const targetTimestamp = Number(id);
        if (!targetTimestamp) {
            return NextResponse.json({ error: 'Invalid snapshot id' }, { status: 400 });
        }

        console.log(`[ExportAPI] Exporting single snapshot: id=${id}, format=${format}`);

        // Find the specific snapshot file
        const blobs = await list({
            prefix: 'snapshots/',
            token: BLOB_READ_WRITE_TOKEN,
            limit: 1000
        });

        const match = blobs.blobs.find(blob => extractTimestampFromPath(blob.pathname) === targetTimestamp);
        if (!match) {
            return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
        }

        // Fetch the snapshot data
        const response = await fetch(match.url);
        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch snapshot file' }, { status: 500 });
        }

        const data = await response.json();

        // Format the data
        const snapshot = {
            id: String(data.timestamp),
            timestamp: data.timestamp,
            totalTokens: data.metadata?.totalTokens || 0,
            successfulPrices: Object.keys(data.prices || {}).length,
            failedPrices: (data.metadata?.totalTokens || 0) - Object.keys(data.prices || {}).length,
            engineStats: data.metadata?.engineStats || { oracle: 0, market: 0, intrinsic: 0, hybrid: 0 },
            calculationTimeMs: data.metadata?.calculationTime || 0,
            arbitrageOpportunities: data.metadata?.arbitrageOpportunities || 0,
            btcPrice: data.metadata?.btcPrice,
            storageSize: match.size
        };

        const prices = Object.entries(data.prices || {}).map(([tokenId, priceData]: [string, any]) => ({
            tokenId,
            symbol: priceData.symbol || 'UNKNOWN',
            usdPrice: priceData.usdPrice || 0,
            sbtcRatio: priceData.sbtcRatio || 0,
            source: priceData.source || 'unknown',
            reliability: priceData.reliability || 0,
            lastUpdated: data.timestamp
        }));

        let responseData: string;
        let contentType: string;
        let filename: string;

        const timestamp = new Date(snapshot.timestamp).toISOString().split('T')[0];
        const timeStr = new Date(snapshot.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, -5);

        switch (format.toLowerCase()) {
            case 'csv':
                responseData = convertToCSV(snapshot, prices);
                contentType = 'text/csv';
                filename = `price-snapshot-${id}-${timeStr}.csv`;
                break;
                
            case 'xlsx':
                // For XLSX, we'll use a simple XML format
                let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Snapshot ${id}">
<Table>`;
                
                // Metadata section
                xml += '<Row><Cell><Data ss:Type="String">SNAPSHOT METADATA</Data></Cell></Row>';
                xml += `<Row><Cell><Data ss:Type="String">ID</Data></Cell><Cell><Data ss:Type="String">${snapshot.id}</Data></Cell></Row>`;
                xml += `<Row><Cell><Data ss:Type="String">Timestamp</Data></Cell><Cell><Data ss:Type="String">${new Date(snapshot.timestamp).toISOString()}</Data></Cell></Row>`;
                xml += `<Row><Cell><Data ss:Type="String">Total Tokens</Data></Cell><Cell><Data ss:Type="Number">${snapshot.totalTokens}</Data></Cell></Row>`;
                xml += '<Row></Row>'; // Empty row
                
                // Price data headers
                xml += '<Row><Cell><Data ss:Type="String">Token ID</Data></Cell><Cell><Data ss:Type="String">Symbol</Data></Cell><Cell><Data ss:Type="String">USD Price</Data></Cell><Cell><Data ss:Type="String">sBTC Ratio</Data></Cell><Cell><Data ss:Type="String">Source</Data></Cell><Cell><Data ss:Type="String">Reliability</Data></Cell></Row>';
                
                // Price data
                prices.forEach(price => {
                    xml += `<Row>
                        <Cell><Data ss:Type="String">${price.tokenId}</Data></Cell>
                        <Cell><Data ss:Type="String">${price.symbol}</Data></Cell>
                        <Cell><Data ss:Type="Number">${price.usdPrice}</Data></Cell>
                        <Cell><Data ss:Type="Number">${price.sbtcRatio}</Data></Cell>
                        <Cell><Data ss:Type="String">${price.source}</Data></Cell>
                        <Cell><Data ss:Type="Number">${price.reliability}</Data></Cell>
                    </Row>`;
                });
                
                xml += '</Table></Worksheet></Workbook>';
                responseData = xml;
                contentType = 'application/vnd.ms-excel';
                filename = `price-snapshot-${id}-${timeStr}.xlsx`;
                break;
                
            case 'json':
            default:
                responseData = JSON.stringify({
                    metadata: {
                        exportedAt: new Date().toISOString(),
                        snapshotId: id,
                        totalPrices: prices.length,
                        format: 'json'
                    },
                    snapshot,
                    prices
                }, null, 2);
                contentType = 'application/json';
                filename = `price-snapshot-${id}-${timeStr}.json`;
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
        console.error('[ExportAPI] Single snapshot export failed:', error);
        return NextResponse.json({
            error: 'Export failed',
            message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        }, { status: 500 });
    }
}