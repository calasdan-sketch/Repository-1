import type { AppConfig } from '../config/index.js';
import { loadConfig } from '../config/index.js';
import { ConfigError } from '../lib/errors.js';
import { requestJson } from '../lib/http.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('autods');

/** HTTP Authorization scheme used by the AutoDS API (token-based bearer auth). */
const AUTH_SCHEME = 'Bearer';

export interface AutoDSProduct {
  id: string;
  title: string;
  description?: string;
  price: number;
  sku?: string;
  images?: string[];
  stock?: number;
}

export interface AutoDSOrderInput {
  shopifyOrderId: string;
  items: Array<{ sku: string; quantity: number }>;
  shippingAddress: Record<string, unknown>;
}

export interface AutoDSOrderResult {
  autodsOrderId: string;
  status: string;
  trackingNumber?: string;
}

/**
 * Client for the AutoDS API.
 *
 * NOTE: AutoDS's public API surface varies by plan tier. Endpoint paths here
 * are placeholders that centralise the integration; adjust them to match the
 * account's actual API once confirmed. All requests flow through the shared
 * retry/backoff HTTP helper.
 */
export class AutoDSService {
  private readonly config: AppConfig['autods'];

  constructor(config: AppConfig = loadConfig()) {
    this.config = config.autods;
  }

  private headers(): Record<string, string> {
    if (!this.config.apiToken) {
      throw new ConfigError('AUTODS_API_TOKEN is not configured');
    }
    return {
      Authorization: `${AUTH_SCHEME} ${this.config.apiToken}`,
    };
  }

  private url(path: string): string {
    return `${this.config.apiBase.replace(/\/$/, '')}${path}`;
  }

  /**
   * List products available in the AutoDS catalogue/store for sourcing.
   */
  async listProducts(limit = 50): Promise<AutoDSProduct[]> {
    log.info({ limit }, 'Listing AutoDS products');
    const response = await requestJson<{ products: AutoDSProduct[] }>(
      this.url(`/products?store_id=${this.config.storeId}&limit=${limit}`),
      { headers: this.headers() },
    );
    return response.products ?? [];
  }

  /**
   * Fetch a single product's details, used for content generation and mapping.
   */
  async getProduct(productId: string): Promise<AutoDSProduct> {
    const response = await requestJson<{ product: AutoDSProduct }>(
      this.url(`/products/${productId}`),
      { headers: this.headers() },
    );
    return response.product;
  }

  /**
   * Forward a Shopify order to AutoDS for automated fulfillment.
   */
  async createOrder(input: AutoDSOrderInput): Promise<AutoDSOrderResult> {
    log.info(
      { shopifyOrderId: input.shopifyOrderId },
      'Forwarding order to AutoDS',
    );
    const response = await requestJson<AutoDSOrderResult>(this.url('/orders'), {
      method: 'POST',
      headers: this.headers(),
      body: {
        store_id: this.config.storeId,
        external_order_id: input.shopifyOrderId,
        items: input.items,
        shipping_address: input.shippingAddress,
      },
    });
    return response;
  }

  /**
   * Poll an AutoDS order for its current fulfillment/tracking status.
   */
  async getOrderStatus(autodsOrderId: string): Promise<AutoDSOrderResult> {
    const response = await requestJson<AutoDSOrderResult>(
      this.url(`/orders/${autodsOrderId}`),
      { headers: this.headers() },
    );
    return response;
  }
}
