import express, { type Express, type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createWebhookRouter } from './routes/webhooks.js';
import { createAdminRouter } from './routes/admin.js';
import { createCommandCenterRouter } from './routes/command-center.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
/**
 * Directory containing the arcade command-center UI. Resolved relative to this
 * module so it works both from `src/` (dev) and the compiled `dist/` build.
 */
const publicDir = join(moduleDir, '..', 'public');

/**
 * Assemble the Express application.
 *
 * The webhook router is mounted first because it requires a raw body parser;
 * the admin router uses JSON parsing scoped to its own routes.
 */
export function createApp(): Express {
  const app = express();

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.use('/webhooks/shopify', createWebhookRouter());
  app.use('/admin', createAdminRouter());
  app.use('/api/command-center', createCommandCenterRouter());

  // Serve the arcade command-center UI at the root.
  app.use(express.static(publicDir));

  return app;
}
