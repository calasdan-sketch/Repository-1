import type Database from 'better-sqlite3';
import { getDb } from './db.js';

export interface StockAlertState {
  ticker: string;
  armed: boolean;
  last_price: number | null;
  last_checked_at: string | null;
  last_alert_at: string | null;
}

interface StockAlertStateRow {
  ticker: string;
  armed: number;
  last_price: number | null;
  last_checked_at: string | null;
  last_alert_at: string | null;
}

/**
 * Persists per-ticker alert state (whether an alert is "armed" and ready to
 * fire, plus the last observed price) so the watcher only emails once per
 * threshold crossing instead of on every scheduled check.
 */
export class StockAlertRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database = getDb()) {
    this.db = db;
  }

  getState(ticker: string): StockAlertState | undefined {
    const row = this.db
      .prepare('SELECT * FROM stock_alert_state WHERE ticker = ?')
      .get(ticker) as StockAlertStateRow | undefined;

    if (!row) {
      return undefined;
    }
    return { ...row, armed: row.armed === 1 };
  }

  upsertState(
    ticker: string,
    input: {
      armed: boolean;
      lastPrice: number;
      lastAlertAt?: string | null;
    },
  ): void {
    this.db
      .prepare(
        `INSERT INTO stock_alert_state
           (ticker, armed, last_price, last_checked_at, last_alert_at)
         VALUES (@ticker, @armed, @lastPrice, datetime('now'), @lastAlertAt)
         ON CONFLICT(ticker) DO UPDATE SET
           armed = excluded.armed,
           last_price = excluded.last_price,
           last_checked_at = excluded.last_checked_at,
           last_alert_at = COALESCE(excluded.last_alert_at, stock_alert_state.last_alert_at)`,
      )
      .run({
        ticker,
        armed: input.armed ? 1 : 0,
        lastPrice: input.lastPrice,
        lastAlertAt: input.lastAlertAt ?? null,
      });
  }
}
