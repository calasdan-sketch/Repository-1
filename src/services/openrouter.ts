import { ExternalApiError } from '../lib/errors.js';
import type { LlmClient } from './llm-client.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * LlmClient backed by OpenRouter's OpenAI-compatible chat completions API,
 * so callers can price-shop across providers/models without leaving the
 * Anthropic-shaped message interface used throughout the app.
 */
export class OpenRouterClient implements LlmClient {
  constructor(private readonly apiKey: string) {}

  messages = {
    create: async (
      args: Parameters<LlmClient['messages']['create']>[0],
    ): ReturnType<LlmClient['messages']['create']> => {
      const systemText = (args.system ?? [])
        .map((block) => block.text)
        .join('\n\n');

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: args.model,
          max_tokens: args.max_tokens,
          messages: [
            ...(systemText ? [{ role: 'system', content: systemText }] : []),
            ...args.messages,
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new ExternalApiError(
          'OpenRouter request failed',
          response.status,
          body,
        );
      }

      const data = (await response.json()) as OpenRouterResponse;
      const text = data.choices?.[0]?.message?.content ?? '';

      return {
        content: [{ type: 'text', text }],
        usage: {
          input_tokens: data.usage?.prompt_tokens ?? 0,
          output_tokens: data.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}
