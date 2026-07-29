/**
 * Minimal shape of a chat-completion client that ClaudeService depends on, so
 * it can be swapped for a fake in tests, or for an alternate provider (e.g.
 * OpenRouter), without changing any call sites.
 */
export interface LlmClient {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system?: Array<{
        type: 'text';
        text: string;
        cache_control?: { type: 'ephemeral' };
      }>;
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    }): Promise<{
      content: Array<{ type: string; text?: string }>;
      usage?: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    }>;
  };
}
