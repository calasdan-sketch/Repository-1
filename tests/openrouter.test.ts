import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterClient } from '../src/services/openrouter.js';
import { ExternalApiError } from '../src/lib/errors.js';

describe('OpenRouterClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('translates the request/response to the shared LlmClient shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hello there' } }],
        usage: { prompt_tokens: 12, completion_tokens: 5 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenRouterClient('or-key');
    const result = await client.messages.create({
      model: 'anthropic/claude-3.5-sonnet',
      max_tokens: 100,
      system: [{ type: 'text', text: 'You are helpful.' }],
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content).toEqual([{ type: 'text', text: 'hello there' }]);
    expect(result.usage).toEqual({ input_tokens: 12, output_tokens: 5 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer or-key');
    const body = JSON.parse(init.body);
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' },
    ]);
  });

  it('throws ExternalApiError on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => 'insufficient credits',
      }),
    );

    const client = new OpenRouterClient('or-key');
    await expect(
      client.messages.create({
        model: 'anthropic/claude-3.5-sonnet',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toThrow(ExternalApiError);
  });
});
