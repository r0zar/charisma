const SITE = 'https://prices.charisma.rocks';
const API = `${SITE}/api/v1`;

/**
 * One prompt that teaches any AI assistant the whole prices API, so builders paste it once instead of reading
 * every route. Pass a token to focus the examples on it. Also served as /llms.txt.
 */
export function aiPrompt(token?: { contractId: string; symbol: string; name: string }): string {
  const id = token?.contractId ?? '.stx';
  const focus = token
    ? `\n## The token I'm working with\n\n${token.name} (${token.symbol}), contract id \`${token.contractId}\`.\n- Latest price: GET ${API}/prices/${token.contractId}\n- Hourly candles for the last week: GET ${API}/prices/${token.contractId}/history?interval=1h\n`
    : '';

  return `You're helping me build with Charisma Prices, a free public API for token prices on Stacks (the Bitcoin layer 2). Read this, then help me with what I ask at the end.

Base URL: ${API}
No API key is needed. CORS is open, so it works from browsers and servers. Prices are recorded every 5 minutes from live on-chain routes, with history back to July 29, 2025.

## Endpoints (all GET, all JSON)

1. /prices — every priced token, sorted by liquidity.
   Optional query: tokens=<id>,<id> to return only those; sparkline=1 to add 7 days of closing prices.
   Returns { btcUsd, updatedAt, count, tokens: TokenPrice[] }

2. /prices/{contractId} — one token, including its 7-day sparkline. 404 if it has never been priced.

3. /prices/{contractId}/history — OHLC candles, oldest first.
   interval: 5m | 1h (default) | 4h | 1d | 1w
   quote: usd (default) | sbtc
   from, to: optional, ISO date or unix seconds. Defaults: last day (5m), 7 days (1h), 30 days (4h), all history (1d, 1w).
   One request covers at most 7 days of 5m, 90 days of 1h or 365 days of 4h candles.
   limit: 1 to 2000, default 500 (the newest candles are kept).
   Returns { token, interval, quote, count, candles: [{ time, open, high, low, close, points }] }
   time is the candle's start in unix seconds. 5m candles are single 5-minute prices, so open = high = low = close.

4. /health — { ok, lastRecordedAt, ageSeconds, tokensPriced }. Answers 503 if prices are over 15 minutes old.

## TokenPrice fields

- contractId: ".stx" for STX, otherwise "<address>.<contract-name>", e.g. "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
- symbol, name, image (logo URL, may be missing), decimals
- type: "SUBNET" marks a Blaze subnet copy of a token. It trades 1:1 with its base token (base) and shares its price.
- usd: price in US dollars
- sbtc: price in sBTC (Bitcoin). Multiply by 100,000,000 for sats.
- change: { "1h", "24h", "7d", "30d" } in percent (2.5 means +2.5%). null when there isn't enough history yet.
- liquidityUsd: dollar value of this token held in Charisma's pools
- roundTripLoss: percent lost buying about $1 of the token and selling it straight back. Low (1-3%) is healthy. null for older prices.
- thin: true when roundTripLoss is over 25%, meaning thin liquidity and a less reliable price
- updatedAt: when it was last priced (ISO). stale: true when that's over 15 minutes ago.
- sparkline: 42 USD closing prices over 7 days, oldest first (only when asked for)

## How to use it well

- Prices change every 5 minutes, so poll at most once a minute and cache on your side.
- For many tokens, make one /prices call (with tokens= if you only need some) rather than one call per token.
- For charts, TradingView's lightweight-charts library takes the candles as-is: time is a UTCTimestamp.
- Show thin and stale prices honestly to users, e.g. a small "Thin liquidity" or "Delayed" label.
- Tiny prices are common (some tokens cost under $0.000001), so format with enough significant digits.
- Please credit "Prices by Charisma" with a link to ${SITE}.

## Example (JavaScript)

const res = await fetch('${API}/prices/${id}');
const token = await res.json();
console.log(token.symbol, token.usd, token.change['24h']);
${focus}
## What I want to build

`;
}
