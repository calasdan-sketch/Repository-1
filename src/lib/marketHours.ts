/**
 * Whether US equity markets (NYSE/Nasdaq) are in a regular trading session.
 *
 * Uses the America/New_York wall-clock time so it stays correct across DST
 * changes without a timezone-data dependency. Ignores market holidays; worst
 * case that means a handful of extra no-op checks per year.
 */
export function isUsMarketOpen(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(now);

  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);

  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }

  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= 9 * 60 + 30 && minutesSinceMidnight < 16 * 60;
}
