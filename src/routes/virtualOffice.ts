import { timingSafeEqual } from 'node:crypto';
import express, { type Router, type Request, type Response } from 'express';
import { loadConfig } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { AgentBus } from '../virtualOffice/agentBus.js';
import { renderDashboardHtml } from '../virtualOffice/dashboardHtml.js';
import { agentEventSchema, type AgentState } from '../virtualOffice/types.js';

const log = createLogger('virtual-office');

function safeTokenMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Build the Virtual Office router: a live dashboard visualising Claude Code
 * subagents as they're reported to `POST /report` by the outer agent.
 *
 * Read endpoints (`/`, `/agents`, `/events`) are intentionally
 * unauthenticated — the browser `EventSource` API cannot send custom
 * headers, so bearer-token auth can only gate the write endpoint. This
 * mirrors the existing `/admin/*` routes, which also have no read auth.
 */
export function createVirtualOfficeRouter(
  bus: AgentBus = new AgentBus(loadConfig().virtualOffice),
  reportToken: string = loadConfig().virtualOffice.reportToken,
): Router {
  const router = express.Router();
  router.use(createRateLimiter({ max: 100 }));
  router.use(express.json());

  router.get('/', (_req: Request, res: Response) => {
    res.type('html').send(renderDashboardHtml());
  });

  router.get('/agents', (_req: Request, res: Response) => {
    res.json({ agents: bus.snapshot() });
  });

  router.get('/events', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(
      `retry: 2000\n\nevent: snapshot\ndata: ${JSON.stringify(bus.snapshot())}\n\n`,
    );

    const onAgent = (agent: AgentState): void => {
      writeSseEvent(res, 'agent', agent);
    };
    const onRemove = (payload: { id: string }): void => {
      writeSseEvent(res, 'remove', payload);
    };
    bus.on('agent', onAgent);
    bus.on('remove', onRemove);

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 15_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      bus.off('agent', onAgent);
      bus.off('remove', onRemove);
    });
  });

  router.post(
    '/report',
    createRateLimiter({ max: 300 }),
    (req: Request, res: Response) => {
      if (!reportToken) {
        res
          .status(503)
          .json({ error: 'virtual office reporting not configured' });
        return;
      }

      const authHeader = req.get('authorization') ?? '';
      const [scheme, token] = authHeader.split(' ');
      if (
        scheme !== 'Bearer' ||
        !token ||
        !safeTokenMatch(reportToken, token)
      ) {
        res.status(401).json({ error: 'invalid or missing token' });
        return;
      }

      const parsed = agentEventSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const agent = bus.applyEvent(parsed.data);
      log.info(
        { id: agent.id, type: parsed.data.type, status: agent.status },
        'Applied virtual office event',
      );
      res.status(202).json({ ok: true, agent });
    },
  );

  return router;
}
