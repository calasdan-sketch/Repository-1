import type { AppConfig } from '../config/index.js';
import { loadConfig } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { Repository, type OrderRecord } from '../models/repository.js';
import { ClaudeService } from './claude.js';

const log = createLogger('customer-service');

export interface CustomerInquiry {
  message: string;
  shopifyOrderId?: string;
}

export interface SupportResponse {
  reply: string;
  orderFound: boolean;
}

export interface CustomerServiceDeps {
  config?: AppConfig;
  repo?: Repository;
  claude?: ClaudeService;
}

/**
 * AI customer-service agent for handling inbound inquiries.
 *
 * Looks up the referenced order in the datastore to ground the reply on real
 * fulfillment/tracking data, then asks Claude to draft a customer-facing
 * response. Drafts are staged (human-in-the-loop) rather than sent directly.
 */
export class CustomerServiceAgent {
  private readonly repo: Repository;
  private readonly claude: ClaudeService;

  constructor(deps: CustomerServiceDeps = {}) {
    const config = deps.config ?? loadConfig();
    this.repo = deps.repo ?? new Repository();
    this.claude =
      deps.claude ?? new ClaudeService({ config, repo: this.repo });
  }

  /**
   * Draft a reply to a customer inquiry, grounding it on order context when a
   * matching order can be located in the datastore.
   */
  async respondToInquiry(inquiry: CustomerInquiry): Promise<SupportResponse> {
    const message = inquiry.message?.trim();
    if (!message) {
      throw new Error('Customer message is required');
    }

    let order: OrderRecord | undefined;
    if (inquiry.shopifyOrderId) {
      order = this.repo.getOrder(inquiry.shopifyOrderId);
    }

    const orderContext = order ? this.formatOrderContext(order) : undefined;

    const { reply } = await this.claude.draftSupportReply({
      message,
      orderContext,
    });

    log.info(
      { shopifyOrderId: inquiry.shopifyOrderId, orderFound: Boolean(order) },
      'Drafted customer service reply',
    );
    return { reply, orderFound: Boolean(order) };
  }

  /**
   * Build a compact, factual order summary for grounding the AI reply.
   */
  private formatOrderContext(order: OrderRecord): string {
    const lines = [
      `Shopify order id: ${order.shopify_order_id}`,
      `Fulfillment status: ${order.fulfillment_status}`,
    ];
    if (order.tracking_number) {
      lines.push(`Tracking number: ${order.tracking_number}`);
    }
    lines.push(`Order created at: ${order.created_at}`);
    lines.push(`Last updated at: ${order.updated_at}`);
    return lines.join('\n');
  }
}
