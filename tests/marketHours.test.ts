import { describe, expect, it } from 'vitest';
import { isUsMarketOpen } from '../src/lib/marketHours.js';

describe('isUsMarketOpen', () => {
  it('is open on a weekday during regular trading hours', () => {
    // Wednesday 2024-01-10, 10:00 ET = 15:00 UTC
    expect(isUsMarketOpen(new Date('2024-01-10T15:00:00Z'))).toBe(true);
  });

  it('is closed before the opening bell', () => {
    // 9:00 ET = 14:00 UTC
    expect(isUsMarketOpen(new Date('2024-01-10T14:00:00Z'))).toBe(false);
  });

  it('is closed after the closing bell', () => {
    // 16:30 ET = 21:30 UTC
    expect(isUsMarketOpen(new Date('2024-01-10T21:30:00Z'))).toBe(false);
  });

  it('is closed on weekends', () => {
    // Saturday 2024-01-13, noon ET
    expect(isUsMarketOpen(new Date('2024-01-13T17:00:00Z'))).toBe(false);
  });
});
