import express, { type Router, type Request, type Response } from 'express';
import { createLogger } from '../lib/logger.js';
import { VerificationError } from '../lib/errors.js';
import { ShopifyService } from '../services/shopify.js';
import { Orchestrator } from '../jobs/orchestrator.js';

const log = createLogger('webhooks');

/**
 * Build the Shopify webhook router.
 *
 * Uses a raw body parser so the exact bytes are available for HMAC
 * verification; re-serialising JSON would break the signature check.
 */
export function createWebhookRouter(
  shopify: ShopifyService = new ShopifyService(),
  orchestrator: Orchestrator = new Orchestrator(),
): Router {
  const router = express.Router();

  router.use(express.raw({ type: 'application/json' }));

  function verify(req: Request): Record<string, unknown> {
    const hmac = req.get('X-Shopify-Hmac-Sha256') ?? '';
    const rawBody: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body ?? {}));

    if (!shopify.verifyWebhook(rawBody, hmac)) {
      throw new VerificationError('Invalid Shopify webhook signature');
    }
    return JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
  }

  router.post('/orders/create', async (req: Request, res: Response) => {
    let payload: Record<string, unknown>;
    try {
      payload = verify(req);
    } catch (error) {
      log.warn({ err: String(error) }, 'Rejected webhook');
      res.status(401).json({ error: 'invalid signature' });
      return;
    }

    // Acknowledge quickly, then process asynchronously.
    res.status(200).json({ received: true });
    orchestrator.handleOrderCreated(payload).catch((error) => {
      log.error({ err: String(error) }, 'Failed to process order webhook');
    });
  });

  router.post('/products/update', (req: Request, res: Response) => {
    try {
      verify(req);
    } catch {
      res.status(401).json({ error: 'invalid signature' });
      return;
    }
    res.status(200).json({ received: true });
  });

  router.post('/app/uninstalled', (req: Request, res: Response) => {
    try {
      verify(req);
    } catch {
      res.status(401).json({ error: 'invalid signature' });
      return;
    }
    log.warn('App uninstalled webhook received');
    res.status(200).json({ received: true });
  });

  return router;
}
