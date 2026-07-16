import { ExternalApiError } from '../lib/errors.js';
import { requestJson } from '../lib/http.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('stock-price');

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';

export interface StockQuote {
  symbol: string;
  price: number;
  currency: string;
}

interface YahooChartResponse {
  chart: {
    result?: Array<{
      meta: {
        symbol?: string;
        regularMarketPrice?: number;
        currency?: string;
      };
    }>;
    error?: { description?: string } | null;
  };
}

/**
 * Fetch the latest quote for a ticker from Yahoo Finance's public chart
 * endpoint. No API key is required, but the endpoint is unofficial and can
 * change shape without notice — a single well-tested source is kept here so a
 * replacement only needs to satisfy the `StockQuote` shape.
 */
export async function getQuote(ticker: string): Promise<StockQuote> {
  log.debug({ ticker }, 'Fetching stock quote');

  const data = await requestJson<YahooChartResponse>(
    `${YAHOO_CHART_URL}${encodeURIComponent(ticker)}?interval=1d&range=1d`,
    {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; stock-alert-bot/1.0)',
      },
    },
  );

  const result = data.chart.result?.[0];
  const price = result?.meta.regularMarketPrice;

  if (data.chart.error || result === undefined || typeof price !== 'number') {
    throw new ExternalApiError(
      `No quote data returned for ${ticker}`,
      502,
      data.chart.error,
    );
  }

  return {
    symbol: result.meta.symbol ?? ticker,
    price,
    currency: result.meta.currency ?? 'USD',
  };
}
