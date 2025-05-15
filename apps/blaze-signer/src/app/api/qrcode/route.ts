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
        const redeemUrl = searchParams.get('redeemUrl');
        const verifyUrl = searchParams.get('verifyUrl');
        const size = Number(searchParams.get('size') || 300);
        const margin = Number(searchParams.get('margin') || 4);
        const title = searchParams.get('title') || '';
        const description = searchParams.get('description') || '';
        const labeled = searchParams.get('labeled') === 'true';
        const combined = searchParams.get('combined') === 'true';
        const tokenAmount = searchParams.get('amount') || '';
        const tokenImageUrl = searchParams.get('tokenImage') || '';
        const tokenName = searchParams.get('tokenName') || 'Token Redemption';
        const tokenSymbol = searchParams.get('tokenSymbol') || '';
        const tokenDecimals = Number(searchParams.get('tokenDecimals') || '0');

        // Format token amount for display if decimals provided
        let formattedAmount = tokenAmount;
        if (tokenAmount && tokenDecimals > 0) {
            try {
                // Convert amount from smallest unit to readable format
                const amountNum = Number(tokenAmount);
                if (!isNaN(amountNum)) {
                    formattedAmount = (amountNum / Math.pow(10, tokenDecimals)).toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: tokenDecimals
                    });
                }
            } catch (error) {
                console.error('Error formatting token amount:', error);
                // Use original amount if there's an error
            }
        }

        // Function to safely replace amount in description text
        const formatDescriptionWithAmount = (text: string) => {
            if (!tokenAmount || !formattedAmount) return text;

            // Handle specific formats we know about
            if (text.includes(`${tokenAmount} token`)) {
                return text.replace(`${tokenAmount} token`, `${formattedAmount} token`);
            } else if (text.includes(`UUID: ${tokenAmount}`)) {
                return text.replace(`UUID: ${tokenAmount}`, `UUID: ${formattedAmount}`);
            }

            // General case - just return the original
            return text;
        };

        // Handle combined QR codes (redeem + verify)
        if (combined && redeemUrl && verifyUrl) {
            // Generate both QR codes as data URLs
            const [redeemQrDataUrl, verifyQrDataUrl] = await Promise.all([
                QRCode.toDataURL(redeemUrl, {
                    width: size,
                    margin: margin,
                    errorCorrectionLevel: 'H',
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF',
                    }
                }),
                QRCode.toDataURL(verifyUrl, {
                    width: size,
                    margin: margin,
                    errorCorrectionLevel: 'H',
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF',
                    }
                })
            ]);

            // Return HTML page with both QR codes
            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bearer Token QR Codes</title>
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
        }
        .container {
            position: relative;
            max-width: 800px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
            border-radius: 8px;
            background-color: white;
            overflow: hidden;
        }
        .watermark {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-position: center;
            background-repeat: no-repeat;
            background-size: 60%;
            opacity: 0.08;
            z-index: 0;
            pointer-events: none;
        }
        .content {
            position: relative;
            z-index: 1;
        }
        h1 {
            margin-top: 0;
            font-size: 24px;
            font-weight: bold;
            color: #222;
            margin-bottom: 20px;
        }
        .qr-codes {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
            gap: 30px;
            margin: 20px 0;
        }
        .qr-code {
            display: flex;
            flex-direction: column;
            align-items: center;
            max-width: 300px;
            padding: 10px;
            border-radius: 8px;
        }
        .qr-code img {
            max-width: 100%;
            height: auto;
            border: 1px solid #eee;
            border-radius: 4px;
            padding: 10px;
            background-color: white;
        }
        .qr-code h2 {
            margin-top: 0;
            font-size: 18px;
            color: #444;
            margin-bottom: 10px;
        }
        .description {
            font-size: 14px;
            color: #555;
            margin: 20px 0;
            line-height: 1.5;
            text-align: left;
            padding: 0 20px;
            border-top: 1px solid #eee;
            padding-top: 20px;
            border-radius: 8px;
        }
        .token-amount {
            font-weight: bold;
            font-size: 18px;
            color: #333;
            margin: 10px 0;
            background-color: rgba(255, 255, 255, 0.9);
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
        }
        .footer-watermark {
            font-size: 12px;
            color: #aaa;
            margin-top: 20px;
            text-align: center;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        ${tokenImageUrl ? `<div class="watermark" style="background-image: url('${tokenImageUrl}');"></div>` : ''}
        <div class="content">
            <h1>${tokenName}${tokenSymbol ? ` (${tokenSymbol})` : ''}</h1>
            ${tokenAmount ? `<div class="token-amount">${formattedAmount} Token${formattedAmount === "1" ? "" : "s"}</div>` : ''}
            <div class="qr-codes">
                <div class="qr-code">
                    <h2>REDEEM</h2>
                    <img src="${redeemQrDataUrl}" alt="Redeem QR Code">
                </div>
                <div class="qr-code">
                    <h2>VERIFY</h2>
                    <img src="${verifyQrDataUrl}" alt="Verify QR Code">
                </div>
            </div>
            <div class="description">
                <p><strong>Instructions:</strong></p>
                <p>1. Use the <strong>REDEEM</strong> QR code to claim your tokens.</p>
                <p>2. Use the <strong>VERIFY</strong> QR code to check if this note has already been redeemed.</p>
                <p>${formatDescriptionWithAmount(description)}</p>
            </div>
            <div class="footer-watermark">Blaze Protocol v1.0</div>
        </div>
    </div>
</body>
</html>
`;

            return new NextResponse(html, {
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Disposition': 'inline; filename="bearer-token-qrcodes.html"'
                }
            });
        }

        // If not combined, check if URL is provided
        if (!url && !combined) {
            return NextResponse.json({ error: 'URL is required for single QR code' }, { status: 400 });
        }

        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(url!, {
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
        .token-info {
            font-size: 16px;
            color: #444;
            margin: 5px 0 15px;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        ${tokenName && title === 'REDEEM' ? `<div class="token-info">${tokenName}${tokenSymbol ? ` (${tokenSymbol})` : ''}</div>` : ''}
        <div class="qr-code">
            <img src="${qrDataUrl}" alt="${title} QR Code">
        </div>
        <p class="description">${formatDescriptionWithAmount(description)}</p>
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