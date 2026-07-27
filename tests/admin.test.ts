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

async function startAdminApp() {
  const app = express();
  const repo = new Repository(createDatabase(':memory:'));
  const orchestrator = {
    importAndPublishProduct: vi.fn(),
  } as unknown as Orchestrator;
  const shopify = {
    getShop: vi.fn(),
  } as unknown as ShopifyService;

  app.use('/admin', createAdminRouter(repo, orchestrator, shopify));

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address() as AddressInfo;
  return {
    repo,
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

  it('returns a consolidated omni operations snapshot', async () => {
    const { repo, server, url } = await startAdminApp();
    servers.push(server);

    repo.upsertProductMapping({ autodsProductId: 'p-1' });
    repo.upsertOrder({ shopifyOrderId: 'o-1' });
    repo.insertAiContent({ contentType: 'title', content: 'Great product' });

    const response = await fetch(`${url}/admin/omni`);
    const body = (await response.json()) as {
      omni: {
        generatedAt: string;
        counts: { products: number; orders: number; aiContent: number };
        products: unknown[];
        orders: unknown[];
        aiContent: unknown[];
        systemPlan: typeof businessPlan;
      };
    };

    expect(response.status).toBe(200);
    expect(body.omni.counts).toEqual({ products: 1, orders: 1, aiContent: 1 });
    expect(body.omni.products).toHaveLength(1);
    expect(body.omni.orders).toHaveLength(1);
    expect(body.omni.aiContent).toHaveLength(1);
    expect(body.omni.systemPlan).toEqual(businessPlan);
    expect(typeof body.omni.generatedAt).toBe('string');
  });
});
