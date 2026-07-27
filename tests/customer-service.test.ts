import { describe, expect, it, vi } from 'vitest';
import { ClaudeService, type AnthropicLike } from '../src/services/claude.js';
import { CustomerServiceAgent } from '../src/services/customer-service.js';
import { createDatabase } from '../src/models/db.js';
import { Repository } from '../src/models/repository.js';
import { makeTestConfig } from './helpers.js';

function fakeClient(text: string): AnthropicLike {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text }],
        usage: { input_tokens: 12, output_tokens: 8 },
      }),
    },
  };
}

function build(replyText: string) {
  const repo = new Repository(createDatabase(':memory:'));
  const client = fakeClient(replyText);
  const claude = new ClaudeService({
    config: makeTestConfig(),
    client,
    repo,
  });
  const agent = new CustomerServiceAgent({
    config: makeTestConfig(),
    repo,
    claude,
  });
  return { repo, client, claude, agent };
}

describe('CustomerServiceAgent', () => {
  it('drafts a reply and stages it as support_reply content', async () => {
    const { repo, agent } = build('Thanks for reaching out!');

    const result = await agent.respondToInquiry({
      message: 'Where is my order?',
    });

    expect(result.reply).toBe('Thanks for reaching out!');
    expect(result.orderFound).toBe(false);

    const stored = repo.listAiContent();
    expect(stored).toHaveLength(1);
    expect(stored[0].content_type).toBe('support_reply');
    expect(stored[0].status).toBe('draft');
  });

  it('grounds the reply on order context when the order exists', async () => {
    const { repo, client, agent } = build('Your order is on its way.');
    repo.upsertOrder({
      shopifyOrderId: 'order-1',
      fulfillmentStatus: 'fulfilled',
      trackingNumber: 'TRACK123',
    });

    const result = await agent.respondToInquiry({
      message: 'Any tracking info?',
      shopifyOrderId: 'order-1',
    });

    expect(result.orderFound).toBe(true);
    const call = (client.messages.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.messages[0].content).toContain('TRACK123');
    expect(call.messages[0].content).toContain('fulfilled');
  });

  it('reports orderFound=false when the order is unknown', async () => {
    const { client, agent } = build('We will look into it.');

    const result = await agent.respondToInquiry({
      message: 'Status please',
      shopifyOrderId: 'missing',
    });

    expect(result.orderFound).toBe(false);
    const call = (client.messages.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.messages[0].content).toContain('No order context');
  });

  it('rejects an empty customer message', async () => {
    const { agent } = build('unused');
    await expect(agent.respondToInquiry({ message: '   ' })).rejects.toThrow();
  });
});
