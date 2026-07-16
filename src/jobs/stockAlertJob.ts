import type { AppConfig } from '../config/index.js';
import { loadConfig } from '../config/index.js';
import { isUsMarketOpen } from '../lib/marketHours.js';
import { createLogger } from '../lib/logger.js';
import { EmailNotifier } from '../services/emailNotifier.js';
import { getQuote, type StockQuote } from '../services/stockPrice.js';
import { StockAlertRepository } from '../models/stockAlertRepository.js';

const log = createLogger('stock-alert-job');

export interface AlertDecision {
  shouldAlert: boolean;
  armed: boolean;
}

/**
 * Pure decision: an alert fires the moment price first reaches the sell
 * target (crossing from armed), then stays disarmed while price remains at
 * or above the target so a single crossing only sends one email. Dropping
 * back below the target re-arms it for the next crossing.
 */
export function decideAlert(
  price: number,
  sellPrice: number,
  armed: boolean,
): AlertDecision {
  if (price >= sellPrice) {
    return { shouldAlert: armed, armed: false };
  }
  return { shouldAlert: false, armed: true };
}

export class StockAlertJob {
  private readonly config: AppConfig;
  private readonly repo: StockAlertRepository;
  private readonly notifier: EmailNotifier;
  private readonly fetchQuote: (ticker: string) => Promise<StockQuote>;

  constructor(options?: {
    config?: AppConfig;
    repo?: StockAlertRepository;
    notifier?: EmailNotifier;
    fetchQuote?: (ticker: string) => Promise<StockQuote>;
  }) {
    this.config = options?.config ?? loadConfig();
    this.repo = options?.repo ?? new StockAlertRepository();
    this.notifier = options?.notifier ?? new EmailNotifier(this.config);
    this.fetchQuote = options?.fetchQuote ?? getQuote;
  }

  async run(): Promise<void> {
    const { ticker, sellPrice } = this.config.stockAlert;

    if (!isUsMarketOpen()) {
      log.debug('Market closed, skipping check');
      return;
    }

    const quote = await this.fetchQuote(ticker);
    const state = this.repo.getState(ticker);
    const armed = state?.armed ?? true;

    const decision = decideAlert(quote.price, sellPrice, armed);
    log.info(
      {
        ticker,
        price: quote.price,
        sellPrice,
        wasArmed: armed,
        shouldAlert: decision.shouldAlert,
        nowArmed: decision.armed,
      },
      'Checked stock price',
    );

    if (decision.shouldAlert) {
      await this.notifier.send({
        subject: `Sell alert: ${ticker} hit $${quote.price.toFixed(2)}`,
        text:
          `${ticker} is now trading at $${quote.price.toFixed(2)}, at or ` +
          `above your $${sellPrice.toFixed(2)} sell target.\n\n` +
          `Time to sell.`,
      });
    }

    this.repo.upsertState(ticker, {
      armed: decision.armed,
      lastPrice: quote.price,
      lastAlertAt: decision.shouldAlert
        ? new Date().toISOString()
        : (state?.last_alert_at ?? null),
    });
  }
}
