import type Database from 'better-sqlite3';
import { getDb } from './db.js';

export interface ProductMapping {
  id: number;
  autods_product_id: string;
  autods_sku: string | null;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OrderRecord {
  id: number;
  shopify_order_id: string;
  autods_order_id: string | null;
  fulfillment_status: string;
  tracking_number: string | null;
  raw_payload: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiContentRecord {
  id: number;
  autods_product_id: string | null;
  content_type: string;
  prompt_hash: string | null;
  content: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export interface CommandRecord {
  id: number;
  division_id: string;
  instruction: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Kinds of decision an agent can escalate for the owner to approve. */
export type ApprovalKind = 'purchase' | 'course_change';

export interface ApprovalRecord {
  id: number;
  division_id: string;
  agent_id: string | null;
  kind: string;
  summary: string;
  amount: number | null;
  currency: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Data-access layer over the SQLite datastore.
 *
 * Repositories keep SQL in one place and return typed rows so the rest of the
 * codebase never touches raw statements.
 */
export class Repository {
  private readonly db: Database.Database;

  constructor(db: Database.Database = getDb()) {
    this.db = db;
  }

  // ---- Product mappings ----

  upsertProductMapping(input: {
    autodsProductId: string;
    autodsSku?: string | null;
    shopifyProductId?: string | null;
    shopifyVariantId?: string | null;
    status?: string;
  }): ProductMapping {
    this.db
      .prepare(
        `INSERT INTO product_mappings
           (autods_product_id, autods_sku, shopify_product_id, shopify_variant_id, status)
         VALUES (@autodsProductId, @autodsSku, @shopifyProductId, @shopifyVariantId, @status)
         ON CONFLICT(autods_product_id) DO UPDATE SET
           autods_sku = COALESCE(excluded.autods_sku, product_mappings.autods_sku),
           shopify_product_id = COALESCE(excluded.shopify_product_id, product_mappings.shopify_product_id),
           shopify_variant_id = COALESCE(excluded.shopify_variant_id, product_mappings.shopify_variant_id),
           status = excluded.status,
           updated_at = datetime('now')`,
      )
      .run({
        autodsProductId: input.autodsProductId,
        autodsSku: input.autodsSku ?? null,
        shopifyProductId: input.shopifyProductId ?? null,
        shopifyVariantId: input.shopifyVariantId ?? null,
        status: input.status ?? 'pending',
      });

    return this.getProductMapping(input.autodsProductId) as ProductMapping;
  }

  getProductMapping(autodsProductId: string): ProductMapping | undefined {
    return this.db
      .prepare('SELECT * FROM product_mappings WHERE autods_product_id = ?')
      .get(autodsProductId) as ProductMapping | undefined;
  }

  listProductMappings(): ProductMapping[] {
    return this.db
      .prepare('SELECT * FROM product_mappings ORDER BY id DESC')
      .all() as ProductMapping[];
  }

  // ---- Orders ----

  upsertOrder(input: {
    shopifyOrderId: string;
    autodsOrderId?: string | null;
    fulfillmentStatus?: string;
    trackingNumber?: string | null;
    rawPayload?: unknown;
  }): OrderRecord {
    this.db
      .prepare(
        `INSERT INTO orders
           (shopify_order_id, autods_order_id, fulfillment_status, tracking_number, raw_payload)
         VALUES (@shopifyOrderId, @autodsOrderId, @fulfillmentStatus, @trackingNumber, @rawPayload)
         ON CONFLICT(shopify_order_id) DO UPDATE SET
           autods_order_id = COALESCE(excluded.autods_order_id, orders.autods_order_id),
           fulfillment_status = excluded.fulfillment_status,
           tracking_number = COALESCE(excluded.tracking_number, orders.tracking_number),
           raw_payload = COALESCE(excluded.raw_payload, orders.raw_payload),
           updated_at = datetime('now')`,
      )
      .run({
        shopifyOrderId: input.shopifyOrderId,
        autodsOrderId: input.autodsOrderId ?? null,
        fulfillmentStatus: input.fulfillmentStatus ?? 'pending',
        trackingNumber: input.trackingNumber ?? null,
        rawPayload:
          input.rawPayload === undefined
            ? null
            : JSON.stringify(input.rawPayload),
      });

    return this.getOrder(input.shopifyOrderId) as OrderRecord;
  }

  getOrder(shopifyOrderId: string): OrderRecord | undefined {
    return this.db
      .prepare('SELECT * FROM orders WHERE shopify_order_id = ?')
      .get(shopifyOrderId) as OrderRecord | undefined;
  }

  listOrders(): OrderRecord[] {
    return this.db
      .prepare('SELECT * FROM orders ORDER BY id DESC')
      .all() as OrderRecord[];
  }

  // ---- Sync state ----

  setSyncState(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO sync_state (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = datetime('now')`,
      )
      .run(key, value);
  }

  getSyncState(key: string): string | undefined {
    const row = this.db
      .prepare('SELECT value FROM sync_state WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value;
  }

  // ---- AI content ----

  insertAiContent(input: {
    autodsProductId?: string | null;
    contentType: string;
    promptHash?: string | null;
    content: string;
    status?: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
  }): AiContentRecord {
    const result = this.db
      .prepare(
        `INSERT INTO ai_content
           (autods_product_id, content_type, prompt_hash, content, status, input_tokens, output_tokens)
         VALUES (@autodsProductId, @contentType, @promptHash, @content, @status, @inputTokens, @outputTokens)`,
      )
      .run({
        autodsProductId: input.autodsProductId ?? null,
        contentType: input.contentType,
        promptHash: input.promptHash ?? null,
        content: input.content,
        status: input.status ?? 'draft',
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
      });

    return this.db
      .prepare('SELECT * FROM ai_content WHERE id = ?')
      .get(result.lastInsertRowid) as AiContentRecord;
  }

  findAiContentByHash(promptHash: string): AiContentRecord | undefined {
    return this.db
      .prepare(
        'SELECT * FROM ai_content WHERE prompt_hash = ? ORDER BY id DESC LIMIT 1',
      )
      .get(promptHash) as AiContentRecord | undefined;
  }

  updateAiContentStatus(id: number, status: string): void {
    this.db
      .prepare('UPDATE ai_content SET status = ? WHERE id = ?')
      .run(status, id);
  }

  listAiContent(): AiContentRecord[] {
    return this.db
      .prepare('SELECT * FROM ai_content ORDER BY id DESC')
      .all() as AiContentRecord[];
  }

  // ---- Commands (orders issued from HQ to a division) ----

  insertCommand(input: {
    divisionId: string;
    instruction: string;
    status?: string;
  }): CommandRecord {
    const result = this.db
      .prepare(
        `INSERT INTO commands (division_id, instruction, status)
         VALUES (@divisionId, @instruction, @status)`,
      )
      .run({
        divisionId: input.divisionId,
        instruction: input.instruction,
        status: input.status ?? 'issued',
      });

    return this.db
      .prepare('SELECT * FROM commands WHERE id = ?')
      .get(result.lastInsertRowid) as CommandRecord;
  }

  updateCommandStatus(id: number, status: string): void {
    this.db
      .prepare(
        `UPDATE commands SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(status, id);
  }

  listCommands(): CommandRecord[] {
    return this.db
      .prepare('SELECT * FROM commands ORDER BY id DESC')
      .all() as CommandRecord[];
  }

  // ---- Approvals (human-in-the-loop for purchases / course changes) ----

  insertApproval(input: {
    divisionId: string;
    agentId?: string | null;
    kind: ApprovalKind;
    summary: string;
    amount?: number | null;
    currency?: string | null;
    status?: string;
  }): ApprovalRecord {
    const result = this.db
      .prepare(
        `INSERT INTO approvals
           (division_id, agent_id, kind, summary, amount, currency, status)
         VALUES (@divisionId, @agentId, @kind, @summary, @amount, @currency, @status)`,
      )
      .run({
        divisionId: input.divisionId,
        agentId: input.agentId ?? null,
        kind: input.kind,
        summary: input.summary,
        amount: input.amount ?? null,
        currency: input.currency ?? null,
        status: input.status ?? 'pending',
      });

    return this.db
      .prepare('SELECT * FROM approvals WHERE id = ?')
      .get(result.lastInsertRowid) as ApprovalRecord;
  }

  getApproval(id: number): ApprovalRecord | undefined {
    return this.db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as
      ApprovalRecord | undefined;
  }

  updateApprovalStatus(id: number, status: string): ApprovalRecord | undefined {
    this.db
      .prepare(
        `UPDATE approvals SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(status, id);
    return this.getApproval(id);
  }

  listApprovals(status?: string): ApprovalRecord[] {
    if (status) {
      return this.db
        .prepare('SELECT * FROM approvals WHERE status = ? ORDER BY id DESC')
        .all(status) as ApprovalRecord[];
    }
    return this.db
      .prepare('SELECT * FROM approvals ORDER BY id DESC')
      .all() as ApprovalRecord[];
  }
}
