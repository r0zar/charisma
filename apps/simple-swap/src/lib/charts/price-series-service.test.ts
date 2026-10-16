import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PriceSeriesService } from './price-series-service';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ candles: [] }), { status: 200 }));
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
    ['24h', '5m', '288'],
    ['7d', '1h', '168'],
    ['30d', '4h', '180'],
  ])('%s requests %s candles with limit %s', async (timeframe: string, interval: string, limit: string) => {
    await new PriceSeriesService().fetchSingleSeries('SP1.token', timeframe);

    const params = requestedParams();
    expect(params.get('interval')).toBe(interval);
    expect(params.get('limit')).toBe(limit);
  });
});
