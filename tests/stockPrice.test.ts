import { afterEach, describe, expect, it, vi } from 'vitest';
import { getQuote } from '../src/services/stockPrice.js';
import { ExternalApiError } from '../src/lib/errors.js';

describe('getQuote', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses the regular market price from the chart response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    symbol: 'JEPQ',
                    regularMarketPrice: 31.42,
                    currency: 'USD',
                  },
                },
              ],
              error: null,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const quote = await getQuote('JEPQ');
    expect(quote).toEqual({ symbol: 'JEPQ', price: 31.42, currency: 'USD' });
  });

  it('throws when the ticker is unknown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            chart: { result: null, error: { description: 'No data found' } },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(getQuote('NOPE')).rejects.toBeInstanceOf(ExternalApiError);
  });
});
