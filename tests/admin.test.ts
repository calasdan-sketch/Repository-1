import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdminRouter } from '../src/routes/admin.js';
import { businessPlan } from '../src/system/business-plan.js';
import { createDatabase } from '../src/models/db.js';
import { Repository } from '../src/models/repository.js';
import type { Orchestrator } from '../src/jobs/orchestrator.js';
import type { ShopifyService } from '../src/services/shopify.js';
import type { CustomerServiceAgent } from '../src/services/customer-service.js';

async function startAdminApp() {
  const app = express();
  const repo = new Repository(createDatabase(':memory:'));
  const orchestrator = {
    importAndPublishProduct: vi.fn(),
  } as unknown as Orchestrator;
  const shopify = {
    getShop: vi.fn(),
  } as unknown as ShopifyService;
  const customerService = {
    respondToInquiry: vi
      .fn()
      .mockResolvedValue({ reply: 'Hi there!', orderFound: false }),
  } as unknown as CustomerServiceAgent;

  app.use(
    '/admin',
    createAdminRouter(repo, orchestrator, shopify, customerService),
  );

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address() as AddressInfo;
  return {
    repo,
    customerService,
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

describe('admin routes', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
                return;
              }
              resolve();
            });
          }),
      ),
    );
  });

  it('returns the machine-readable business system plan', async () => {
    const { server, url } = await startAdminApp();
    servers.push(server);

    const response = await fetch(`${url}/admin/system-plan`);
    const body = (await response.json()) as { plan: typeof businessPlan };

    expect(response.status).toBe(200);
    expect(body.plan).toEqual(businessPlan);
    expect(body.plan.repositories).toHaveLength(3);
  });

  it('drafts a customer-service reply', async () => {
    const { server, url, customerService } = await startAdminApp();
    servers.push(server);

    const response = await fetch(`${url}/admin/support/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: 'Where is my order?',
        shopifyOrderId: 'order-1',
      }),
    });
    const body = (await response.json()) as {
      reply: string;
      orderFound: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.reply).toBe('Hi there!');
    expect(customerService.respondToInquiry).toHaveBeenCalledWith({
      message: 'Where is my order?',
      shopifyOrderId: 'order-1',
    });
  });

  it('rejects a support reply request without a message', async () => {
    const { server, url } = await startAdminApp();
    servers.push(server);

    const response = await fetch(`${url}/admin/support/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });
});
