import type {
  ApprovalKind,
  ApprovalRecord,
  CommandRecord,
} from '../models/repository.js';
import { Repository } from '../models/repository.js';
import { getDivision } from '../domain/organization.js';
import { NotFoundError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';
import { Notifier } from '../services/notifier.js';

const log = createLogger('command-center');

export interface CommandCenterDeps {
  repo?: Repository;
  notifier?: Notifier;
}

export interface RequestApprovalInput {
  divisionId: string;
  agentId?: string | null;
  kind: ApprovalKind;
  summary: string;
  amount?: number | null;
  currency?: string | null;
}

/**
 * Coordinates the "arcade command center" business simulation.
 *
 * HQ (the owner) issues orders to divisions; division agents escalate purchases
 * and course-altering decisions back to the owner as approvals, which trigger an
 * email notification and are held until the owner approves or rejects them.
 */
export class CommandCenter {
  private readonly repo: Repository;
  private readonly notifier: Notifier;

  constructor(deps: CommandCenterDeps = {}) {
    this.repo = deps.repo ?? new Repository();
    this.notifier = deps.notifier ?? new Notifier();
  }

  /**
   * Issue an order from HQ to a division. Throws {@link NotFoundError} when the
   * division id is unknown so the API can respond with a 404.
   */
  issueOrder(divisionId: string, instruction: string): CommandRecord {
    const division = getDivision(divisionId);
    if (!division) {
      throw new NotFoundError(`Unknown division: ${divisionId}`);
    }
    const command = this.repo.insertCommand({ divisionId, instruction });
    log.info(
      { divisionId, commandId: command.id },
      'HQ issued order to division',
    );
    return command;
  }

  /**
   * An agent escalates a purchase or course-altering decision. The approval is
   * staged as `pending` and the owner is notified by email.
   */
  async requestApproval(input: RequestApprovalInput): Promise<ApprovalRecord> {
    const division = getDivision(input.divisionId);
    if (!division) {
      throw new NotFoundError(`Unknown division: ${input.divisionId}`);
    }

    const approval = this.repo.insertApproval({
      divisionId: input.divisionId,
      agentId: input.agentId ?? null,
      kind: input.kind,
      summary: input.summary,
      amount: input.amount ?? null,
      currency: input.currency ?? null,
    });

    const label = input.kind === 'purchase' ? 'Purchase' : 'Course-change';
    const amountText =
      approval.amount != null
        ? ` (${approval.amount}${approval.currency ? ` ${approval.currency}` : ''})`
        : '';
    await this.notifier.notifyOwner(
      `[Approval needed] ${label} — ${division.name}${amountText}`,
      `${division.name} is requesting your approval:\n\n${approval.summary}\n\n` +
        `Approve or reject it from the command center (approval #${approval.id}).`,
    );

    log.info(
      {
        divisionId: input.divisionId,
        approvalId: approval.id,
        kind: input.kind,
      },
      'Approval requested; owner notified',
    );
    return approval;
  }

  /** Owner decision on a pending approval. */
  decideApproval(
    id: number,
    decision: 'approved' | 'rejected',
  ): ApprovalRecord {
    const existing = this.repo.getApproval(id);
    if (!existing) {
      throw new NotFoundError(`Unknown approval: ${id}`);
    }
    const updated = this.repo.updateApprovalStatus(id, decision);
    log.info({ approvalId: id, decision }, 'Owner decided approval');
    return updated as ApprovalRecord;
  }
}
