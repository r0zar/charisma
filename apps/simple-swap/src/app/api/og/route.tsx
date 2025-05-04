// app/api/og/route.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { listTokens, getQuote } from '@/app/actions';

export const runtime = 'edge';

export interface Token {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  image?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Get parameters from the URL
    const fromSymbol = searchParams.get('fromSymbol') || 'STX';
    const toSymbol = searchParams.get('toSymbol') || 'CHA';
    const amount = searchParams.get('amount') || '1';

    // Fetch tokens from the server
    const { tokens = [] } = await listTokens();

    // Find the token data for the from and to symbols
    const fromToken = tokens.find(token => token.symbol === fromSymbol);
    const toToken = tokens.find(token => token.symbol === toSymbol);

    // Get token logos
    const fromLogo = fromToken?.image;
    const toLogo = toToken?.image;

    // Get quote for the swap
    let outputAmount = '?';
    if (fromToken && toToken) {
      try {
        // Convert amount to base units
        const amountInBaseUnits = (parseFloat(amount) * Math.pow(10, fromToken.decimals)).toString();

        // Get quote
        const quoteResult = await getQuote(fromToken.contractId, toToken.contractId, amountInBaseUnits);

        if (quoteResult.success && quoteResult.data) {
          // Convert back to human readable format
          const rawOutput = Number(quoteResult.data.amountOut);
          outputAmount = (rawOutput / Math.pow(10, toToken.decimals)).toFixed(6);

          // Format the number nicely
          if (parseFloat(outputAmount) > 1000) {
            outputAmount = parseFloat(outputAmount).toLocaleString('en-US', { maximumFractionDigits: 2 });
          } else if (parseFloat(outputAmount) < 0.000001) {
            outputAmount = parseFloat(outputAmount).toExponential(2);
          } else {
            outputAmount = parseFloat(outputAmount).toFixed(6).replace(/\.?0+$/, '');
          }
        }
      } catch (error) {
        console.error('Error fetching quote:', error);
        // Keep the '?' if quote fails
      }
    }

    // Create the OG image
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'hsl(222 47% 10%)', // --color-background dark
            position: 'relative',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Background Pattern */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(circle at 25% 25%, rgba(236, 106, 18, 0.1) 0%, transparent 50%), ' +
                'radial-gradient(circle at 75% 75%, rgba(255, 105, 105, 0.1) 0%, transparent 50%)',
              backgroundSize: '100% 100%',
            }}
          />

          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '48px',
              position: 'relative',
              width: '100%',
              maxWidth: '1000px',
              padding: '40px',
            }}
          >
            {/* Title with gradient */}
            <div
              style={{
                fontSize: '72px',
                fontWeight: '800',
                background: 'linear-gradient(135deg, hsl(25 100% 58%), hsl(360 100% 67%))', // primary to secondary
                backgroundClip: 'text',
                color: 'transparent',
                letterSpacing: '-0.02em',
                textAlign: 'center',
                lineHeight: '1.1',
              }}
            >
              Swap {fromSymbol} to {toSymbol}
            </div>

            {/* Swap Section */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '48px',
                width: '100%',
              }}
            >
              {/* From Token */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '24px',
                }}
              >
                {fromLogo ? (
                  <img
                    src={fromLogo}
                    alt={fromSymbol}
                    style={{
                      width: '140px',
                      height: '140px',
                      borderRadius: '50%',
                      border: '6px solid hsla(0, 0%, 100%, 0.1)',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '140px',
                      height: '140px',
                      borderRadius: '50%',
                      backgroundColor: 'hsla(25, 100%, 58%, 0.2)',
                      border: '6px solid hsla(0, 0%, 100%, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '48px',
                      fontWeight: '800',
                      color: 'hsl(25 100% 58%)',
                    }}
                  >
                    {fromSymbol.slice(0, 2)}
                  </div>
                )}
                <div
                  style={{
                    fontSize: '72px',
                    fontWeight: '800',
                    color: 'white',
                    lineHeight: '1',
                  }}
                >
                  {amount}
                </div>
                <div
                  style={{
                    fontSize: '42px',
                    fontWeight: '700',
                    color: 'hsl(25 100% 58%)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {fromSymbol}
                </div>
              </div>

              {/* Arrow */}
              <div
                style={{
                  fontSize: '96px',
                  color: 'hsl(25 100% 58%)',
                  fontWeight: '300',
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                <svg
                  width="96"
                  height="96"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14m0 0-7-7m7 7-7 7" />
                </svg>
              </div>

              {/* To Token */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '24px',
                }}
              >
                {toLogo ? (
                  <img
                    src={toLogo}
                    alt={toSymbol}
                    style={{
                      width: '140px',
                      height: '140px',
                      borderRadius: '50%',
                      border: '6px solid hsla(0, 0%, 100%, 0.1)',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '140px',
                      height: '140px',
                      borderRadius: '50%',
                      backgroundColor: 'hsla(360, 100%, 67%, 0.2)',
                      border: '6px solid hsla(0, 0%, 100%, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '48px',
                      fontWeight: '800',
                      color: 'hsl(360 100% 67%)',
                    }}
                  >
                    {toSymbol.slice(0, 2)}
                  </div>
                )}
                <div
                  style={{
                    fontSize: '72px',
                    fontWeight: '800',
                    color: 'white',
                    lineHeight: '1',
                  }}
                >
                  {outputAmount}
                </div>
                <div
                  style={{
                    fontSize: '42px',
                    fontWeight: '700',
                    color: 'hsl(360 100% 67%)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {toSymbol}
                </div>
              </div>
            </div>

            {/* Footer with Charisma branding */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                marginTop: '24px',
              }}
            >
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  color: 'hsl(25 100% 58%)',
                  letterSpacing: '0.05em',
                }}
              >
                CHARISMA
              </div>
              <div
                style={{
                  fontSize: '24px',
                  color: 'hsla(0, 0%, 100%, 0.6)',
                  fontWeight: '500',
                  letterSpacing: '0.05em',
                }}
              >
                swap.charisma.rocks
              </div>
            </div>
          </div>

          {/* Corner Decoration */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              right: '40px',
              width: '120px',
              height: '120px',
              background: 'linear-gradient(135deg, hsla(25, 100%, 58%, 0.1), hsla(360, 100%, 67%, 0.1))',
              borderRadius: '50%',
              filter: 'blur(40px)',
            }}
          />
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (e: any) {
    console.error(e);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}