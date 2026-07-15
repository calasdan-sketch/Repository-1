import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../config/index.js';
import { loadConfig } from '../config/index.js';
import { ConfigError } from '../lib/errors.js';
import { requestJson } from '../lib/http.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('shopify');

export interface ShopifyProductInput {
  title: string;
  bodyHtml?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  status?: 'active' | 'draft' | 'archived';
  variants?: Array<{
    price: string;
    sku?: string;
    inventoryQuantity?: number;
  }>;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  status: string;
  variants: Array<{ id: number; sku: string | null; price: string }>;
}

/**
 * Thin wrapper over the Shopify Admin REST API.
 *
 * Handles authentication, base-URL construction, retry/backoff (via the shared
 * HTTP helper) and webhook HMAC verification. Only the operations needed by the
 * automation flows are exposed.
 */
export class ShopifyService {
  private readonly config: AppConfig['shopify'];

  constructor(config: AppConfig = loadConfig()) {
    this.config = config.shopify;
  }

  private baseUrl(): string {
    if (!this.config.shop) {
      throw new ConfigError('SHOPIFY_SHOP is not configured');
    }
    return `https://${this.config.shop}/admin/api/${this.config.apiVersion}`;
  }

  private headers(): Record<string, string> {
    if (!this.config.accessToken) {
      throw new ConfigError('SHOPIFY_ACCESS_TOKEN is not configured');
    }
    return {
      'X-Shopify-Access-Token': this.config.accessToken,
    };
  }

  /**
   * Verify the HMAC signature of an incoming Shopify webhook.
   *
   * @param rawBody The exact raw request body bytes (not re-serialised JSON).
   * @param hmacHeader The value of the `X-Shopify-Hmac-Sha256` header.
   */
  verifyWebhook(rawBody: Buffer | string, hmacHeader: string): boolean {
    if (!this.config.webhookSecret) {
      throw new ConfigError('SHOPIFY_WEBHOOK_SECRET is not configured');
    }
    if (!hmacHeader) {
      return false;
    }

    const digest = createHmac('sha256', this.config.webhookSecret)
      .update(rawBody)
      .digest('base64');

    const expected = Buffer.from(digest);
    const received = Buffer.from(hmacHeader);

    if (expected.length !== received.length) {
      return false;
    }
    return timingSafeEqual(expected, received);
  }

  async createProduct(input: ShopifyProductInput): Promise<ShopifyProduct> {
    const payload = {
      product: {
        title: input.title,
        body_html: input.bodyHtml,
        vendor: input.vendor,
        product_type: input.productType,
        tags: input.tags?.join(', '),
        status: input.status ?? 'draft',
        variants: input.variants?.map((v) => ({
          price: v.price,
          sku: v.sku,
          inventory_quantity: v.inventoryQuantity,
        })),
      },
    };

    log.info({ title: input.title }, 'Creating Shopify product');
    const response = await requestJson<{ product: ShopifyProduct }>(
      `${this.baseUrl()}/products.json`,
      { method: 'POST', headers: this.headers(), body: payload },
    );
    return response.product;
  }

  async updateProduct(
    productId: string | number,
    input: Partial<ShopifyProductInput>,
  ): Promise<ShopifyProduct> {
    const payload = {
      product: {
        id: productId,
        title: input.title,
        body_html: input.bodyHtml,
        tags: input.tags?.join(', '),
        status: input.status,
      },
    };

    log.info({ productId }, 'Updating Shopify product');
    const response = await requestJson<{ product: ShopifyProduct }>(
      `${this.baseUrl()}/products/${productId}.json`,
      { method: 'PUT', headers: this.headers(), body: payload },
    );
    return response.product;
  }

  async updateInventory(
    inventoryItemId: string | number,
    locationId: string | number,
    available: number,
  ): Promise<void> {
    log.info({ inventoryItemId, available }, 'Updating inventory level');
    await requestJson(`${this.baseUrl()}/inventory_levels/set.json`, {
      method: 'POST',
      headers: this.headers(),
      body: {
        inventory_item_id: inventoryItemId,
        location_id: locationId,
        available,
      },
    });
  }

  async getOrder(orderId: string | number): Promise<Record<string, unknown>> {
    const response = await requestJson<{ order: Record<string, unknown> }>(
      `${this.baseUrl()}/orders/${orderId}.json`,
      { headers: this.headers() },
    );
    return response.order;
  }

  async createFulfillment(
    orderId: string | number,
    input: {
      trackingNumber?: string;
      trackingCompany?: string;
      lineItems?: Array<{ id: number; quantity: number }>;
    },
  ): Promise<Record<string, unknown>> {
    log.info({ orderId }, 'Creating fulfillment');
    const response = await requestJson<{
      fulfillment: Record<string, unknown>;
    }>(`${this.baseUrl()}/orders/${orderId}/fulfillments.json`, {
      method: 'POST',
      headers: this.headers(),
      body: {
        fulfillment: {
          tracking_number: input.trackingNumber,
          tracking_company: input.trackingCompany,
          line_items: input.lineItems,
        },
      },
    });
    return response.fulfillment;
  }
}
