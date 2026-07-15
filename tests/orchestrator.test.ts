import { describe, expect, it, vi } from 'vitest';
import { Orchestrator } from '../src/jobs/orchestrator.js';
import { createDatabase } from '../src/models/db.js';
import { Repository } from '../src/models/repository.js';
import { makeTestConfig } from './helpers.js';
import type { ShopifyService } from '../src/services/shopify.js';
import type { AutoDSService } from '../src/services/autods.js';
import type { ClaudeService } from '../src/services/claude.js';

function build(overrides: { autoPublish?: boolean; autoFulfill?: boolean }) {
  const repo = new Repository(createDatabase(':memory:'));
  const config = makeTestConfig({
    automation: {
      autoPublish: overrides.autoPublish ?? false,
      autoFulfill: overrides.autoFulfill ?? false,
      syncCron: '* * * * *',
    },
  });

  const shopify = {
    createProduct: vi.fn().mockResolvedValue({
      id: 555,
      title: 'X',
      handle: 'x',
      status: 'active',
      variants: [{ id: 999, sku: 'SKU-1', price: '29.99' }],
    }),
    createFulfillment: vi.fn().mockResolvedValue({}),
  } as unknown as ShopifyService;

  const autods = {
    getProduct: vi.fn().mockResolvedValue({
      id: 'ad-1',
      title: 'Earbuds',
      price: 29.99,
      sku: 'SKU-1',
    }),
    createOrder: vi.fn().mockResolvedValue({
      autodsOrderId: 'ad-o-1',
      status: 'processing',
    }),
    getOrderStatus: vi.fn().mockResolvedValue({
      autodsOrderId: 'ad-o-1',
      status: 'shipped',
      trackingNumber: 'TRK1',
    }),
  } as unknown as AutoDSService;

  const claude = {
    generateProductContent: vi.fn().mockResolvedValue({
      title: 'Premium Earbuds',
      description: '<p>desc</p>',
      bullets: [],
      tags: ['audio'],
    }),
  } as unknown as ClaudeService;

  const orchestrator = new Orchestrator({
    config,
    repo,
    shopify,
    autods,
    claude,
  });
  return { orchestrator, repo, shopify, autods, claude };
}

describe('Orchestrator', () => {
  it('stages product for review when auto-publish is disabled', async () => {
    const { orchestrator, repo, shopify } = build({ autoPublish: false });
    const result = await orchestrator.importAndPublishProduct('ad-1');
    expect(result.published).toBe(false);
    expect(shopify.createProduct).not.toHaveBeenCalled();
    expect(repo.getProductMapping('ad-1')?.status).toBe('pending_review');
  });

  it('publishes product when auto-publish is enabled', async () => {
    const { orchestrator, repo, shopify } = build({ autoPublish: true });
    const result = await orchestrator.importAndPublishProduct('ad-1');
    expect(result.published).toBe(true);
    expect(result.shopifyProductId).toBe('555');
    expect(shopify.createProduct).toHaveBeenCalledOnce();
    expect(repo.getProductMapping('ad-1')?.status).toBe('published');
  });

  it('stages order when auto-fulfill is disabled', async () => {
    const { orchestrator, repo, autods } = build({ autoFulfill: false });
    const result = await orchestrator.handleOrderCreated({ id: 42 });
    expect(result.forwarded).toBe(false);
    expect(autods.createOrder).not.toHaveBeenCalled();
    expect(repo.getOrder('42')?.fulfillment_status).toBe('received');
  });

  it('forwards order to AutoDS when auto-fulfill is enabled', async () => {
    const { orchestrator, repo, autods } = build({ autoFulfill: true });
    const result = await orchestrator.handleOrderCreated({
      id: 42,
      line_items: [{ sku: 'SKU-1', quantity: 2 }],
      shipping_address: { city: 'Test' },
    });
    expect(result.forwarded).toBe(true);
    expect(autods.createOrder).toHaveBeenCalledOnce();
    expect(repo.getOrder('42')?.autods_order_id).toBe('ad-o-1');
  });

  it('syncs tracking numbers back to Shopify', async () => {
    const { orchestrator, repo, shopify } = build({ autoFulfill: true });
    repo.upsertOrder({
      shopifyOrderId: '42',
      autodsOrderId: 'ad-o-1',
      fulfillmentStatus: 'processing',
    });
    const updated = await orchestrator.syncOrderTracking();
    expect(updated).toBe(1);
    expect(shopify.createFulfillment).toHaveBeenCalledOnce();
    expect(repo.getOrder('42')?.fulfillment_status).toBe('fulfilled');
  });
});
