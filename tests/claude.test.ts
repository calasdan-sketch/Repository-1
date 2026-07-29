import { describe, expect, it, vi } from 'vitest';
import { ClaudeService, type AnthropicLike } from '../src/services/claude.js';
import { createDatabase } from '../src/models/db.js';
import { Repository } from '../src/models/repository.js';
import type { AutoDSProduct } from '../src/services/autods.js';
import { makeTestConfig } from './helpers.js';

const product: AutoDSProduct = {
  id: 'ad-1',
  title: 'Wireless Earbuds',
  description: 'Bluetooth 5.0 earbuds',
  price: 29.99,
  sku: 'SKU-1',
};

function fakeClient(text: string): AnthropicLike {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    },
  };
}

describe('ClaudeService', () => {
  it('generates and persists product content', async () => {
    const repo = new Repository(createDatabase(':memory:'));
    const client = fakeClient(
      '```json\n{"title":"Premium Wireless Earbuds","description":"<p>Great</p>","bullets":["a","b"],"tags":["audio"]}\n```',
    );
    const service = new ClaudeService({
      config: makeTestConfig(),
      client,
      repo,
    });

    const content = await service.generateProductContent(product);
    expect(content.title).toContain('Earbuds');
    expect(content.bullets).toEqual(['a', 'b']);

    const stored = repo.listAiContent();
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('draft');
    expect(stored[0].output_tokens).toBe(20);
  });

  it('returns cached content without calling the API twice', async () => {
    const repo = new Repository(createDatabase(':memory:'));
    const client = fakeClient(
      '{"title":"T","description":"D","bullets":[],"tags":[]}',
    );
    const service = new ClaudeService({
      config: makeTestConfig(),
      client,
      repo,
    });

    await service.generateProductContent(product);
    await service.generateProductContent(product);
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it('throws when required fields are missing', async () => {
    const repo = new Repository(createDatabase(':memory:'));
    const client = fakeClient('{"description":"only desc"}');
    const service = new ClaudeService({
      config: makeTestConfig(),
      client,
      repo,
    });
    await expect(service.generateProductContent(product)).rejects.toThrow();
  });

  it('marks the system prompt as an ephemeral cache breakpoint', async () => {
    const repo = new Repository(createDatabase(':memory:'));
    const client = fakeClient('{"score": 50, "rationale": "ok"}');
    const service = new ClaudeService({
      config: makeTestConfig(),
      client,
      repo,
    });

    await service.scoreProduct(product);

    const call = vi.mocked(client.messages.create).mock.calls[0][0];
    expect(call.system).toEqual([
      expect.objectContaining({
        type: 'text',
        cache_control: { type: 'ephemeral' },
      }),
    ]);
  });

  it('scores a product and clamps to 0-100', async () => {
    const repo = new Repository(createDatabase(':memory:'));
    const client = fakeClient('{"score": 150, "rationale": "high demand"}');
    const service = new ClaudeService({
      config: makeTestConfig(),
      client,
      repo,
    });
    const result = await service.scoreProduct(product);
    expect(result.score).toBe(100);
    expect(result.rationale).toBe('high demand');
  });

  it('can be constructed without an API key (lazy client)', () => {
    const repo = new Repository(createDatabase(':memory:'));
    const config = makeTestConfig();
    config.claude.apiKey = '';
    expect(() => new ClaudeService({ config, repo })).not.toThrow();
  });
});
