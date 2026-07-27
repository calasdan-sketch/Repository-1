import express, { type Router, type Request, type Response } from 'express';
import { createLogger } from '../lib/logger.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { Repository } from '../models/repository.js';
import { Orchestrator } from '../jobs/orchestrator.js';
import { ShopifyService } from '../services/shopify.js';
import { businessPlan } from '../system/business-plan.js';

const log = createLogger('admin');

/**
 * Build the admin API router.
 *
 * Provides read access to mappings/orders/AI content and endpoints to trigger
 * workflows and approve staged (human-in-the-loop) items.
 */
export function createAdminRouter(
  repo: Repository = new Repository(),
  orchestrator: Orchestrator = new Orchestrator(),
  shopify: ShopifyService = new ShopifyService(),
): Router {
  const router = express.Router();
  router.use(createRateLimiter({ max: 100 }));
  router.use(express.json());

  // Display the connected Shopify store details.
  router.get('/store', async (_req: Request, res: Response) => {
    try {
      const store = await shopify.getShop();
      res.json({ store });
    } catch (error) {
      log.error({ err: String(error) }, 'Failed to fetch store');
      res.status(502).json({ error: 'failed to fetch store' });
    }
  });

  router.get('/products', (_req: Request, res: Response) => {
    res.json({ products: repo.listProductMappings() });
  });

  router.get('/orders', (_req: Request, res: Response) => {
    res.json({ orders: repo.listOrders() });
  });

  router.get('/ai-content', (_req: Request, res: Response) => {
    res.json({ content: repo.listAiContent() });
  });

  router.get('/system-plan', (_req: Request, res: Response) => {
    res.json({ plan: businessPlan });
  });

  // Trigger sourcing + content generation for a specific AutoDS product.
  router.post('/products/import', async (req: Request, res: Response) => {
    const { autodsProductId } = req.body ?? {};
    if (!autodsProductId) {
      res.status(400).json({ error: 'autodsProductId is required' });
      return;
    }
    try {
      const result = await orchestrator.importAndPublishProduct(
        String(autodsProductId),
      );
      res.json(result);
    } catch (error) {
      log.error({ err: String(error) }, 'Import failed');
      res.status(502).json({ error: 'import failed' });
    }
  });

  // Approve a piece of staged AI content (human-in-the-loop).
  router.post('/ai-content/:id/approve', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    repo.updateAiContentStatus(id, 'approved');
    res.json({ id, status: 'approved' });
  });

  return router;
}
