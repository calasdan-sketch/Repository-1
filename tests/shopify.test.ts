import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('ShopifyService.getShop', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and maps the store details for display', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          shop: {
            id: 42,
            name: 'Test Store',
            email: 'owner@test.com',
            domain: 'test.com',
            myshopify_domain: 'test.myshopify.com',
            currency: 'USD',
            plan_name: 'basic',
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ShopifyService(makeTestConfig());
    const store = await service.getShop();

    expect(store).toEqual({
      id: 42,
      name: 'Test Store',
      email: 'owner@test.com',
      domain: 'test.com',
      myshopifyDomain: 'test.myshopify.com',
      currency: 'USD',
      planName: 'basic',
    });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://test.myshopify.com/admin/api/2024-10/shop.json');
  });
});
