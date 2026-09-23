import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PriceSeriesService } from './price-series-service';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ price_history: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function requestedParams(): URLSearchParams {
  const [url] = fetchMock.mock.calls[0];
  return new URL(String(url)).searchParams;
}

describe('PriceSeriesService timeframes', () => {
  it.each([
    ['24h', 'hour', '24'],
    ['7d', 'hour', '168'],
    ['30d', 'day', '30'],
  ])('%s requests %s buckets with limit %s', async (timeframe, interval, limit) => {
    await new PriceSeriesService().fetchSingleSeries('SP1.token', timeframe);

    const params = requestedParams();
    expect(params.get('interval')).toBe(interval);
    expect(params.get('limit')).toBe(limit);
  });
});
