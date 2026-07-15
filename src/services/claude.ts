import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { AppConfig } from '../config/index.js';
import { loadConfig } from '../config/index.js';
import { ConfigError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';
import { Repository } from '../models/repository.js';
import type { AutoDSProduct } from './autods.js';

const log = createLogger('claude');

export interface GeneratedProductContent {
  title: string;
  description: string;
  bullets: string[];
  tags: string[];
}

export interface ProductScore {
  score: number;
  rationale: string;
}

/**
 * Minimal shape of the Anthropic client we depend on, so it can be swapped for
 * a fake in tests without pulling in the real SDK.
 */
export interface AnthropicLike {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    }): Promise<{
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    }>;
  };
}

function hashPrompt(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Extract plain text from an Anthropic message response.
 */
function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n')
    .trim();
}

/**
 * Parse a JSON object from a model response, tolerating surrounding prose or
 * markdown code fences.
 */
function parseJsonLoose<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

/**
 * Wrapper around the Anthropic Claude API for dropshipping automation tasks.
 *
 * Provides SEO product-content generation and product scoring, with prompt-hash
 * caching (via the datastore) and token accounting to control cost.
 */
export class ClaudeService {
  private readonly config: AppConfig['claude'];
  private readonly repo: Repository;
  private client: AnthropicLike | null;

  constructor(options?: {
    config?: AppConfig;
    client?: AnthropicLike;
    repo?: Repository;
  }) {
    const config = options?.config ?? loadConfig();
    this.config = config.claude;
    this.repo = options?.repo ?? new Repository();
    // The client is created lazily so the app can start without an API key;
    // the key is only required when a Claude call is actually made.
    this.client = options?.client ?? null;
  }

  private getClient(): AnthropicLike {
    if (this.client) {
      return this.client;
    }
    if (!this.config.apiKey) {
      throw new ConfigError('ANTHROPIC_API_KEY is not configured');
    }
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
    }) as unknown as AnthropicLike;
    return this.client;
  }

  private async complete(
    system: string,
    userPrompt: string,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const response = await this.getClient().messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    return {
      text: extractText(response.content),
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  }

  /**
   * Generate SEO-optimised product content from a source AutoDS product.
   *
   * Results are cached by prompt hash to avoid duplicate spend, and persisted to
   * the datastore as `draft` for optional human review before publishing.
   */
  async generateProductContent(
    product: AutoDSProduct,
  ): Promise<GeneratedProductContent> {
    const system =
      'You are an expert e-commerce copywriter. Produce accurate, ' +
      'non-misleading, SEO-optimised product content. Respond ONLY with a JSON ' +
      'object with keys: title (string), description (string, HTML allowed), ' +
      'bullets (array of strings), tags (array of strings).';

    const userPrompt = [
      'Create marketing content for this product:',
      `Source title: ${product.title}`,
      product.description ? `Source description: ${product.description}` : '',
      `Price: ${product.price}`,
    ]
      .filter(Boolean)
      .join('\n');

    const promptHash = hashPrompt(`content:${this.config.model}:${userPrompt}`);
    const cached = this.repo.findAiContentByHash(promptHash);
    if (cached) {
      log.info({ productId: product.id }, 'Returning cached product content');
      return JSON.parse(cached.content) as GeneratedProductContent;
    }

    const { text, inputTokens, outputTokens } = await this.complete(
      system,
      userPrompt,
    );
    const parsed = parseJsonLoose<GeneratedProductContent>(text);

    // Basic guardrail: ensure required fields exist.
    if (!parsed.title || !parsed.description) {
      throw new Error('Generated content missing required fields');
    }
    parsed.bullets = parsed.bullets ?? [];
    parsed.tags = parsed.tags ?? [];

    this.repo.insertAiContent({
      autodsProductId: product.id,
      contentType: 'product_content',
      promptHash,
      content: JSON.stringify(parsed),
      status: 'draft',
      inputTokens,
      outputTokens,
    });

    log.info(
      { productId: product.id, inputTokens, outputTokens },
      'Generated product content',
    );
    return parsed;
  }

  /**
   * Score a candidate product for dropshipping viability (0-100).
   */
  async scoreProduct(
    product: AutoDSProduct,
    criteria = 'margin potential, demand, and competition',
  ): Promise<ProductScore> {
    const system =
      'You are a dropshipping product analyst. Evaluate the product and ' +
      'respond ONLY with a JSON object: { "score": number (0-100), ' +
      '"rationale": string }.';

    const userPrompt = [
      `Evaluate this product against: ${criteria}.`,
      `Title: ${product.title}`,
      `Price: ${product.price}`,
      product.description ? `Description: ${product.description}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const { text } = await this.complete(system, userPrompt);
    const parsed = parseJsonLoose<ProductScore>(text);
    parsed.score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    return parsed;
  }
}
