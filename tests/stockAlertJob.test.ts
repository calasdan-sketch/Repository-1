import { afterEach, describe, expect, it, vi } from 'vitest';
import { decideAlert, StockAlertJob } from '../src/jobs/stockAlertJob.js';
import { createDatabase } from '../src/models/db.js';
import { StockAlertRepository } from '../src/models/stockAlertRepository.js';
import { makeTestConfig } from './helpers.js';

describe('decideAlert', () => {
  it('alerts and disarms when price first crosses the sell target', () => {
    expect(decideAlert(31, 31, true)).toEqual({
      shouldAlert: true,
      armed: false,
    });
  });

  it('does not re-alert while price stays at or above the target', () => {
    expect(decideAlert(32, 31, false)).toEqual({
      shouldAlert: false,
      armed: false,
    });
  });

  it('re-arms once price drops back below the target', () => {
    expect(decideAlert(30, 31, false)).toEqual({
      shouldAlert: false,
      armed: true,
    });
  });

  it('does not alert while below target and already armed', () => {
    expect(decideAlert(29, 31, true)).toEqual({
      shouldAlert: false,
      armed: true,
    });
  });
});

describe('StockAlertJob', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(price: number) {
    const db = createDatabase(':memory:');
    const repo = new StockAlertRepository(db);
    const notifier = { send: vi.fn().mockResolvedValue(undefined) };
    const fetchQuote = vi
      .fn()
      .mockResolvedValue({ symbol: 'JEPQ', price, currency: 'USD' });
    const config = makeTestConfig();
    // A Wednesday during regular trading hours so the job doesn't skip.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-10T15:00:00Z'));

    const job = new StockAlertJob({
      config,
      repo,
      notifier: notifier as never,
      fetchQuote,
    });
    return { job, repo, notifier, fetchQuote, config };
  }

  it('sends one email the first time price hits the sell target', async () => {
    const { job, repo, notifier } = setup(31.5);
    await job.run();

    expect(notifier.send).toHaveBeenCalledTimes(1);
    expect(notifier.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('JEPQ') }),
    );

    const state = repo.getState('JEPQ');
    expect(state?.armed).toBe(false);
    expect(state?.last_price).toBe(31.5);
  });

  it('does not send a second email while price stays above target', async () => {
    const { job, notifier, repo } = setup(31.5);
    await job.run();
    repo.upsertState('JEPQ', { armed: false, lastPrice: 32 });
    await job.run();

    expect(notifier.send).toHaveBeenCalledTimes(1);
  });

  it('re-alerts after price dips below target and crosses again', async () => {
    const { job, notifier, repo } = setup(31.5);
    await job.run();
    expect(notifier.send).toHaveBeenCalledTimes(1);

    repo.upsertState('JEPQ', { armed: true, lastPrice: 29 });
    await job.run();

    expect(notifier.send).toHaveBeenCalledTimes(2);
  });

  it('does not fetch a quote or alert outside market hours', async () => {
    const { job, notifier, fetchQuote } = setup(35);
    vi.setSystemTime(new Date('2024-01-13T17:00:00Z')); // Saturday
    await job.run();

    expect(fetchQuote).not.toHaveBeenCalled();
    expect(notifier.send).not.toHaveBeenCalled();
  });
});
