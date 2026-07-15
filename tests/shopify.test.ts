import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ShopifyService } from '../src/services/shopify.js';
import { makeTestConfig } from './helpers.js';

describe('ShopifyService.verifyWebhook', () => {
  const secret = 'shhh-secret';
  const service = new ShopifyService(makeTestConfig());

  it('accepts a valid signature', () => {
    const body = JSON.stringify({ id: 123 });
    const hmac = createHmac('sha256', secret).update(body).digest('base64');
    expect(service.verifyWebhook(body, hmac)).toBe(true);
  });

  it('rejects an invalid signature', () => {
    const body = JSON.stringify({ id: 123 });
    expect(service.verifyWebhook(body, 'not-the-right-hmac')).toBe(false);
  });

  it('rejects an empty signature', () => {
    expect(service.verifyWebhook('{}', '')).toBe(false);
  });

  it('is resistant to tampered bodies', () => {
    const body = JSON.stringify({ id: 123 });
    const hmac = createHmac('sha256', secret).update(body).digest('base64');
    const tampered = JSON.stringify({ id: 999 });
    expect(service.verifyWebhook(tampered, hmac)).toBe(false);
  });
});
