import { PRICES_TABLE, query, table } from './bigquery';
import { btcUsd, listTokens, quote, SBTC } from './sources';

/** About $1 of sBTC: small enough not to move the price, big enough for a meaningful quote */
const PROBE_SATS = 1000;
/** Quotes in flight at once */
const CONCURRENCY = 4;

export interface PricePoint {
  token: string;
  usd: number;
  sbtc: number;
  /** Share of value lost buying and selling straight back (0.01 = 1%). High means thin liquidity. */
  loss: number;
}

/** Runs `work` over `items`, `limit` at a time */
async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: limit }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
  }));
}

/**
 * Prices every listed token against sBTC. Each token is bought with a little sBTC and sold straight back;
 * the geometric mean of the two prices cancels the fees and gives the mid price. Subnet tokens take their base's price.
 */
export async function priceTokens() {
  const [btc, tokens] = await Promise.all([btcUsd(), listTokens()]);
  const prices = new Map<string, PricePoint>([[SBTC, { token: SBTC, usd: btc, sbtc: 1, loss: 0 }]]);
  const failed: string[] = [];

  await pool(tokens.filter(t => t.contractId !== SBTC && t.type !== 'SUBNET'), CONCURRENCY, async t => {
    try {
      const buy = await quote(SBTC, t.contractId, PROBE_SATS);
      if (!buy) return void failed.push(`${t.symbol}: no route to buy`);
      const sell = await quote(t.contractId, SBTC, buy.amountOut);
      if (!sell) return void failed.push(`${t.symbol}: no route to sell`);
      const got = buy.amountOut / 10 ** t.decimals;
      const buyPrice = buy.amountIn / 1e8 / got;
      const sellPrice = sell.amountOut / 1e8 / got;
      const sbtc = Math.sqrt(buyPrice * sellPrice);
      if (!(sbtc > 0) || !Number.isFinite(sbtc)) return void failed.push(`${t.symbol}: bad price ${sbtc}`);
      prices.set(t.contractId, { token: t.contractId, usd: sbtc * btc, sbtc, loss: Math.max(0, 1 - sellPrice / buyPrice) });
    } catch (e) {
      failed.push(`${t.symbol}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  for (const t of tokens) {
    const base = t.type === 'SUBNET' && t.base ? prices.get(t.base) : undefined;
    if (base) prices.set(t.contractId, { ...base, token: t.contractId });
  }
  return { btc, prices: [...prices.values()], failed, listed: tokens.length };
}

/** Saves one run of prices, all stamped with the same time */
export async function savePrices(points: PricePoint[], at: Date) {
  if (!points.length) throw new Error('No prices to save');
  await query(
    `INSERT INTO ${table(PRICES_TABLE)} (token_contract_id, sbtc_price, usd_price, round_trip_loss, price_source, iterations_to_converge, final_convergence_percent, calculated_at)
     SELECT p.token, CAST(p.sbtc AS BIGNUMERIC), CAST(p.usd AS BIGNUMERIC), p.loss, 'multihop_quote', 0, 0, @at
     FROM UNNEST(@points) AS p`,
    { points, at },
    { points: [{ token: 'STRING', usd: 'FLOAT64', sbtc: 'FLOAT64', loss: 'FLOAT64' }], at: 'TIMESTAMP' },
  );
}
