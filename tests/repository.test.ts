import { describe, expect, it, beforeEach } from 'vitest';
import { createDatabase } from '../src/models/db.js';
import { Repository } from '../src/models/repository.js';

describe('Repository', () => {
  let repo: Repository;

  beforeEach(() => {
    repo = new Repository(createDatabase(':memory:'));
  });

  it('upserts and reads a product mapping', () => {
    const created = repo.upsertProductMapping({
      autodsProductId: 'ad-1',
      autodsSku: 'SKU-1',
    });
    expect(created.autods_product_id).toBe('ad-1');
    expect(created.status).toBe('pending');

    const updated = repo.upsertProductMapping({
      autodsProductId: 'ad-1',
      shopifyProductId: 'shop-1',
      status: 'published',
    });
    expect(updated.shopify_product_id).toBe('shop-1');
    // COALESCE keeps the original SKU.
    expect(updated.autods_sku).toBe('SKU-1');
    expect(updated.status).toBe('published');
    expect(repo.listProductMappings()).toHaveLength(1);
  });

  it('upserts and reads orders', () => {
    repo.upsertOrder({ shopifyOrderId: 'o-1', rawPayload: { a: 1 } });
    const updated = repo.upsertOrder({
      shopifyOrderId: 'o-1',
      autodsOrderId: 'ad-o-1',
      fulfillmentStatus: 'fulfilled',
      trackingNumber: 'TRK1',
    });
    expect(updated.autods_order_id).toBe('ad-o-1');
    expect(updated.tracking_number).toBe('TRK1');
    expect(updated.fulfillment_status).toBe('fulfilled');
  });

  it('stores and retrieves sync state', () => {
    repo.setSyncState('last_sync', '2026-01-01');
    expect(repo.getSyncState('last_sync')).toBe('2026-01-01');
    repo.setSyncState('last_sync', '2026-02-02');
    expect(repo.getSyncState('last_sync')).toBe('2026-02-02');
  });

  it('caches AI content by prompt hash', () => {
    repo.insertAiContent({
      autodsProductId: 'ad-1',
      contentType: 'product_content',
      promptHash: 'hash-1',
      content: '{"title":"x"}',
    });
    const found = repo.findAiContentByHash('hash-1');
    expect(found?.content).toBe('{"title":"x"}');
    expect(repo.findAiContentByHash('missing')).toBeUndefined();
  });

  it('updates AI content status', () => {
    const record = repo.insertAiContent({
      contentType: 'product_content',
      content: '{}',
    });
    repo.updateAiContentStatus(record.id, 'approved');
    const all = repo.listAiContent();
    expect(all[0].status).toBe('approved');
  });
});
