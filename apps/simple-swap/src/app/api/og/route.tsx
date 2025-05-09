// app/api/og/route.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { listTokens } from '@/app/actions';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';

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
    const fromSubnetFlag = searchParams.get('fromSubnet');
    const toSubnetFlag = searchParams.get('toSubnet');
    const amount = searchParams.get('amount') || '1';
    const modeParam = searchParams.get('mode') || 'swap';
    const targetPriceParam = searchParams.get('targetPrice');
    const directionParam = searchParams.get('direction');
    const conditionTokenParam = searchParams.get('conditionToken');

    // Fetch tokens from the server
    const { tokens = [] } = await listTokens();

    // Find the token data for the from and to symbols
    const fromToken = tokens.find(token => {
      if (token.symbol !== fromSymbol) return false;
      const wantSubnet = fromSubnetFlag === '1' || fromSubnetFlag === 'true';
      const isSubnet = token.contractId.includes('-subnet');
      return wantSubnet ? isSubnet : !isSubnet;
    });

    const toToken = tokens.find(token => {
      if (token.symbol !== toSymbol) return false;
      const wantSubnet = toSubnetFlag === '1' || toSubnetFlag === 'true';
      const isSubnet = token.contractId.includes('-subnet');
      return wantSubnet ? isSubnet : !isSubnet;
    });

    const conditionToken = tokens.find(token => token.symbol === conditionTokenParam);

    // Get token logos
    const fromLogo = fromToken?.image;
    const toLogo = toToken?.image;

    // For swap mode we optionally fetch a quote; for order mode we just display target details
    let outputAmount = '?';
    if (fromToken && toToken) {
      try {
        // Convert amount to base units
        const amountInBaseUnits = (parseFloat(amount) * Math.pow(10, fromToken.decimals)).toString();

        // Call internal REST quote endpoint so edge bundle stays small
        const quoteRes = await fetch(`${request.nextUrl.origin}/api/v1/quote?tokenIn=${encodeURIComponent(fromToken.contractId)}&tokenOut=${encodeURIComponent(toToken.contractId)}&amount=${amountInBaseUnits}`);
        const quoteJson = await quoteRes.json();

        if (quoteJson.success && quoteJson.data) {
          const rawOutput = Number(quoteJson.data.amountOut);
          outputAmount = (rawOutput / Math.pow(10, toToken.decimals)).toFixed(6);

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
      }
    }

    // Optional sparkline for order mode
    let sparkUrl: string | undefined;
    if (modeParam === 'order') {
      try {
        const tokenIdForPrice = conditionToken?.contractId ?? toToken?.contractId;
        if (!tokenIdForPrice) {
          throw new Error('No token ID for price');
        }
        const priceRes = await fetch(`${request.nextUrl.origin}/api/price-series?contractId=${encodeURIComponent(tokenIdForPrice)}`);
        const points: { time: number; value: number }[] = await priceRes.json();
        const recent = points.slice(-60).map((p) => ({ time: Number(p.time), value: p.value }));

        if (recent.length) {
          if (typeof (globalThis as any).OffscreenCanvas !== 'undefined') {
            // Render sparkline on OffscreenCanvas (production edge)
            // @ts-ignore
            const canvas: any = new OffscreenCanvas(300, 120);
            const chart: any = createChart(canvas as any, {
              width: 300,
              height: 120,
              layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#fff' },
              grid: { vertLines: { visible: false }, horzLines: { visible: false } },
              timeScale: { visible: false },
              rightPriceScale: { visible: false },
              leftPriceScale: { visible: false },
            });
            const series = chart.addSeries('Line', { color: 'hsl(25 100% 58%)', lineWidth: 2, lineStyle: LineStyle.Solid });
            series.setData(recent);
            chart.timeScale().fitContent();

            // @ts-ignore
            const blob = await canvas.convertToBlob();
            const arrayBuffer = await blob.arrayBuffer();
            sparkUrl = `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
          } else {
            // Local dev fallback: QuickChart
            const vals = recent.map((p) => p.value.toFixed(4));
            const cfg = {
              type: 'sparkline',
              data: { datasets: [{ data: vals, borderColor: '#ec6a12', fill: false }] },
              options: { scales: { x: { display: false }, y: { display: false } }, elements: { point: { radius: 0 } }, plugins: { legend: { display: false } } },
            };
            const enc = encodeURIComponent(JSON.stringify(cfg));
            sparkUrl = `https://quickchart.io/chart?c=${enc}&backgroundColor=transparent&width=300&height=120`;
          }
        }
      } catch (err) {
        console.error('Sparkline generation failed', err);
      }
    }


    // Create modern OG card
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(110deg, #0f172a 0%, #1e293b 100%)',
            position: 'relative',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          }}
        >

          {/* Main content panel */}
          <div style={{
            width: '1080px',
            display: 'flex',
            flexDirection: 'column',
            padding: '50px 60px',
          }}>
            {/* Header bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
            }}>
              {/* Platform logo */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}>
                <img
                  src="https://charisma.rocks/charisma.png"
                  width="48"
                  height="48"
                  style={{
                    borderRadius: '10px',
                  }}
                />
                <div style={{
                  fontWeight: '600',
                  fontSize: '30px',
                  color: 'white',
                  letterSpacing: '0.01em',
                }}>Charisma</div>
              </div>

              {/* Tag pill */}
              <div style={{
                padding: '8px 24px',
                background: 'rgba(236, 106, 18, 0.15)',
                borderRadius: '9999px',
                color: 'hsl(25, 100%, 65%)',
                fontWeight: '600',
                fontSize: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.075em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <div style={{ display: 'flex' }}>{modeParam === 'order' ? 'Triggered Swap' : 'Swap Preview'}</div>
              </div>
            </div>

            {modeParam === 'order' ? (
              /* Order mode content */
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                {/* Title with dynamic trade info */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '16px',
                  marginBottom: '10px',
                }}>
                  <div style={{
                    fontSize: '72px',
                    fontWeight: '700',
                    color: 'white',
                    lineHeight: '1',
                    display: 'flex',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex', fontSize: '64px', fontWeight: '200', marginRight: '10px' }}>SWAP</div>
                      <div style={{ display: 'flex' }}>{amount}</div>
                      {fromLogo ? (
                        <img src={fromLogo} width="72" height="72" style={{ borderRadius: '50%', marginLeft: '4px' }} />
                      ) : (
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: 'hsla(25, 100%, 58%, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: '800', color: 'hsl(25 100% 58%)', marginLeft: '16px' }}>{fromSymbol.slice(0, 2)}</div>
                      )}
                      <div style={{ display: 'flex' }}> to </div>
                      {toLogo ? (
                        <img src={toLogo} width="72" height="72" style={{ borderRadius: '50%', marginLeft: '4px' }} />
                      ) : (
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: 'hsla(25, 100%, 58%, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: '800', color: 'hsl(25 100% 58%)', marginLeft: '16px' }}>{toSymbol.slice(0, 2)}</div>
                      )}
                    </div>
                  </div>
                  <div style={{
                    marginBottom: '10px',
                    fontSize: '26px',
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: '500',
                    display: 'flex',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span>when </span>
                      {conditionToken?.image ? (
                        <img src={conditionToken.image} width="32" height="32" style={{ borderRadius: '50%', marginLeft: '6px', marginRight: '6px' }} />
                      ) : (
                        <span style={{ marginLeft: '6px', marginRight: '6px', fontWeight: '600' }}>{(conditionTokenParam ? conditionTokenParam.toUpperCase() : toSymbol)}</span>
                      )}
                      <span>{directionParam === 'lt' ? 'is less than' : 'is greater than'} {targetPriceParam ?? '?'}</span>
                    </div>
                  </div>
                </div>

                {/* Price chart with indicators */}
                <div style={{
                  width: '100%',
                  height: '300px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  borderRadius: '18px',
                  padding: '0px',
                }}>
                  {sparkUrl ? (
                    <img
                      src={sparkUrl}
                      width="960"
                      height="280"
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '16px',
                      }}
                    />
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      color: 'rgba(255,255,255,0.4)',
                      fontStyle: 'italic',
                    }}>
                      Loading price chart...
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Swap mode content */
              <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '48px', width: '100%' }}>
                  {/* To Token (now on the left) */}
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
                        {fromSymbol.slice(0, 2)}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: '72px',
                        fontWeight: '800',
                        color: 'white',
                        lineHeight: '1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div style={{ display: 'flex' }}>{amount}</div>
                    </div>
                    <div
                      style={{
                        fontSize: '42px',
                        fontWeight: '700',
                        color: 'hsl(360 100% 67%)',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div style={{ display: 'flex' }}>{fromSymbol}</div>
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

                  {/* From Token (now on the right) */}
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
                        {toSymbol.slice(0, 2)}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: '72px',
                        fontWeight: '800',
                        color: 'white',
                        lineHeight: '1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div style={{ display: 'flex' }}>{outputAmount}</div>
                    </div>
                    <div
                      style={{
                        fontSize: '42px',
                        fontWeight: '700',
                        color: 'hsl(25 100% 58%)',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div style={{ display: 'flex' }}>{toSymbol}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{
              marginTop: '25px',
              paddingTop: '5px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}