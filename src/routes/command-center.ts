import express, { type Router, type Request, type Response } from 'express';
import { NotFoundError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { organizationChart, getDivision } from '../domain/organization.js';
import { CommandCenter } from '../jobs/command-center.js';
import { Repository } from '../models/repository.js';
import type { ApprovalKind } from '../models/repository.js';

const log = createLogger('command-center-api');

const APPROVAL_KINDS: ApprovalKind[] = ['purchase', 'course_change'];

/**
 * Build the command-center API router that backs the arcade UI.
 *
 * Exposes the organization map, lets HQ issue orders to divisions, lists the
 * agents' escalated approvals, and records the owner's approve/reject decisions.
 */
export function createCommandCenterRouter(
  repo: Repository = new Repository(),
  commandCenter: CommandCenter = new CommandCenter({ repo }),
): Router {
  const router = express.Router();
  router.use(createRateLimiter({ max: 200 }));
  router.use(express.json());

  // The full org chart: HQ plus every division and its agents.
  router.get('/organization', (_req: Request, res: Response) => {
    res.json(organizationChart());
  });

  // A single division (with its agents).
  router.get('/divisions/:id', (req: Request, res: Response) => {
    const division = getDivision(req.params.id);
    if (!division) {
      res.status(404).json({ error: 'unknown division' });
      return;
    }
    res.json({ division });
  });

  // Orders issued from HQ.
  router.get('/commands', (_req: Request, res: Response) => {
    res.json({ commands: repo.listCommands() });
  });

  // Issue an order from HQ to a division.
  router.post('/commands', (req: Request, res: Response) => {
    const { divisionId, instruction } = req.body ?? {};
    if (!divisionId || !instruction) {
      res
        .status(400)
        .json({ error: 'divisionId and instruction are required' });
      return;
    }
    try {
      const command = commandCenter.issueOrder(
        String(divisionId),
        String(instruction),
      );
      res.status(201).json({ command });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      log.error({ err: String(error) }, 'Failed to issue order');
      res.status(500).json({ error: 'failed to issue order' });
    }
  });

  // Approvals awaiting (or already decided by) the owner.
  router.get('/approvals', (req: Request, res: Response) => {
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json({ approvals: repo.listApprovals(status) });
  });

  // An agent escalates a purchase or course-altering decision to the owner.
  router.post('/approvals', async (req: Request, res: Response) => {
    const { divisionId, agentId, kind, summary, amount, currency } =
      req.body ?? {};
    if (!divisionId || !kind || !summary) {
      res
        .status(400)
        .json({ error: 'divisionId, kind and summary are required' });
      return;
    }
    if (!APPROVAL_KINDS.includes(kind as ApprovalKind)) {
      res
        .status(400)
        .json({ error: `kind must be one of: ${APPROVAL_KINDS.join(', ')}` });
      return;
    }
    try {
      const approval = await commandCenter.requestApproval({
        divisionId: String(divisionId),
        agentId: agentId != null ? String(agentId) : null,
        kind: kind as ApprovalKind,
        summary: String(summary),
        amount: amount != null ? Number(amount) : null,
        currency: currency != null ? String(currency) : null,
      });
      res.status(201).json({ approval });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      log.error({ err: String(error) }, 'Failed to request approval');
      res.status(500).json({ error: 'failed to request approval' });
    }
  });

  // Owner approves or rejects a pending approval.
  router.post('/approvals/:id/decision', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const decision = (req.body ?? {}).decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      res
        .status(400)
        .json({ error: 'decision must be "approved" or "rejected"' });
      return;
    }
    try {
      const approval = commandCenter.decideApproval(id, decision);
      res.json({ approval });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      log.error({ err: String(error) }, 'Failed to decide approval');
      res.status(500).json({ error: 'failed to decide approval' });
    }
  });

  return router;
}
