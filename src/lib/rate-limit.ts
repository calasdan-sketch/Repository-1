import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

/**
 * Create a rate-limiting middleware.
 *
 * Protects public HTTP endpoints (webhooks, admin API) from abuse. Defaults to
 * 100 requests per minute per IP; callers may override for specific routers.
 */
export function createRateLimiter(
  options: { windowMs?: number; max?: number } = {},
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs ?? 60_000,
    max: options.max ?? 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too many requests' },
  });
}
