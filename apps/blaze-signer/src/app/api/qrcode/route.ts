import { NextRequest, NextResponse } from 'next/server';
import * as QRCode from 'qrcode';

export async function POST(request: NextRequest) {
    try {
        const { url, size = 300, margin = 4 } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(url, {
            width: size,
            margin: margin,
            errorCorrectionLevel: 'H',
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            }
        });

        // Return the QR code data URL
        return NextResponse.json({
            qrcode: qrDataUrl,
            url: url
        });

    } catch (error) {
        console.error('Error generating QR code:', error);
        return NextResponse.json(
            { error: 'Failed to generate QR code' },
            { status: 500 }
        );
    }
}

// Support GET requests with query params
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const url = searchParams.get('url');
        const size = Number(searchParams.get('size') || 300);
        const margin = Number(searchParams.get('margin') || 4);
        const title = searchParams.get('title') || '';
        const description = searchParams.get('description') || '';
        const labeled = searchParams.get('labeled') === 'true';

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(url, {
            width: size,
            margin: margin,
            errorCorrectionLevel: 'H',
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            }
        });

        // If not labeled, return the QR code as a PNG
        if (!labeled) {
            // Convert data URL to buffer
            const dataURLParts = qrDataUrl.split(',');
            const base64Data = dataURLParts[1];
            const buffer = Buffer.from(base64Data, 'base64');

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': 'image/png',
                    'Content-Disposition': 'inline; filename="qrcode.png"'
                }
            });
        }

        // For labeled QR codes, return an HTML page with the QR code and labels
        // that can be screenshotted by the client
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title} QR Code</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            min-height: 100vh;
        }
        .container {
            max-width: 500px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
            border-radius: 8px;
            background-color: white;
        }
        h1 {
            margin-top: 0;
            font-size: 24px;
            font-weight: bold;
            color: #222;
        }
        .qr-code {
            margin: 20px 0;
            display: flex;
            justify-content: center;
        }
        .qr-code img {
            max-width: 100%;
            height: auto;
        }
        .description {
            font-size: 14px;
            color: #555;
            margin-bottom: 0;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <div class="qr-code">
            <img src="${qrDataUrl}" alt="${title} QR Code">
        </div>
        <p class="description">${description}</p>
    </div>
</body>
</html>
`;

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html',
                'Content-Disposition': 'inline; filename="labeled-qrcode.html"'
            }
        });

    } catch (error) {
        console.error('Error generating QR code:', error);
        return NextResponse.json(
            { error: 'Failed to generate QR code' },
            { status: 500 }
        );
    }
} 