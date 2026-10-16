import { BigQuery, type Query } from '@google-cloud/bigquery';

/** Raw price points: one row per token every 5 minutes, since July 2025 */
export const PRICES_TABLE = 'token_prices';
/** Hourly and daily candles built from the raw points with junk filtered out */
export const CANDLES_TABLE = 'token_price_candles';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. The prices app needs it to reach the price history in BigQuery.`);
  return value;
};

let client: BigQuery | null = null;

/** BigQuery client from GOOGLE_CLOUD_CREDENTIALS (service account JSON, plain or base64) */
export function bigquery(): BigQuery {
  if (client) return client;
  const raw = required('GOOGLE_CLOUD_CREDENTIALS').trim();
  const credentials = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  client = new BigQuery({ projectId: required('GOOGLE_CLOUD_PROJECT'), credentials });
  return client;
}

/** `dataset.table`, quoted for SQL */
export const table = (name: string) => `\`${required('BIGQUERY_DATASET')}.${name}\``;

/** Runs a query. Every user value goes in `params`, never into the SQL text. */
export async function query<T>(sql: string, params?: Query['params'], types?: Query['types']): Promise<T[]> {
  const [rows] = await bigquery().query({ query: sql, params, types });
  return rows as T[];
}
