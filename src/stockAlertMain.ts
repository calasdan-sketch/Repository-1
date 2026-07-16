import cron from 'node-cron';
import { loadConfig } from './config/index.js';
import { closeDb, getDb } from './models/db.js';
import { createLogger } from './lib/logger.js';
import { StockAlertJob } from './jobs/stockAlertJob.js';

const log = createLogger('stock-alert-main');

/**
 * Standalone entrypoint for the JEPQ (or any ticker) sell-price watcher.
 * Deliberately independent of the Shopify/AutoDS server so it can run as its
 * own lightweight process: `npm run stock-alert` (loop) or
 * `npm run stock-alert:once` (single check, useful for testing your setup).
 */
async function main(): Promise<void> {
  const config = loadConfig();
  getDb();

  const job = new StockAlertJob({ config });
  const runOnce = process.argv.includes('--once');

  const check = async (): Promise<void> => {
    try {
      await job.run();
    } catch (error) {
      log.error({ err: String(error) }, 'Stock alert check failed');
    }
  };

  if (runOnce) {
    await check();
    closeDb();
    return;
  }

  const { ticker, sellPrice, checkCron } = config.stockAlert;
  if (!cron.validate(checkCron)) {
    log.error({ checkCron }, 'Invalid STOCK_ALERT_CRON expression');
    process.exitCode = 1;
    return;
  }

  log.info({ ticker, sellPrice, checkCron }, 'Stock alert watcher started');
  await check();
  const task = cron.schedule(checkCron, check, { name: 'stock-alert-check' });

  const shutdown = (signal: string): void => {
    log.info({ signal }, 'Shutting down stock alert watcher');
    void task.stop();
    closeDb();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
