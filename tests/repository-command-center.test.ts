import { describe, expect, it, beforeEach } from 'vitest';
import { createDatabase } from '../src/models/db.js';
import { Repository } from '../src/models/repository.js';

describe('Repository — commands & approvals', () => {
  let repo: Repository;

  beforeEach(() => {
    repo = new Repository(createDatabase(':memory:'));
  });

  it('inserts, lists and updates commands', () => {
    const command = repo.insertCommand({
      divisionId: 'software',
      instruction: 'Ship the checkout revamp',
    });
    expect(command.division_id).toBe('software');
    expect(command.status).toBe('issued');

    repo.updateCommandStatus(command.id, 'done');
    const all = repo.listCommands();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('done');
  });

  it('inserts approvals with defaults and reads them back', () => {
    const approval = repo.insertApproval({
      divisionId: 'operations',
      agentId: 'op-buyer',
      kind: 'purchase',
      summary: 'Buy 500 units of SKU-9',
      amount: 1200.5,
      currency: 'USD',
    });
    expect(approval.status).toBe('pending');
    expect(approval.amount).toBe(1200.5);
    expect(repo.getApproval(approval.id)?.summary).toBe(
      'Buy 500 units of SKU-9',
    );
  });

  it('filters approvals by status and records decisions', () => {
    const a = repo.insertApproval({
      divisionId: 'marketing',
      kind: 'course_change',
      summary: 'Pivot campaign to TikTok',
    });
    repo.insertApproval({
      divisionId: 'operations',
      kind: 'purchase',
      summary: 'Restock',
    });

    expect(repo.listApprovals('pending')).toHaveLength(2);

    const decided = repo.updateApprovalStatus(a.id, 'approved');
    expect(decided?.status).toBe('approved');
    expect(repo.listApprovals('pending')).toHaveLength(1);
    expect(repo.listApprovals('approved')).toHaveLength(1);
    expect(repo.listApprovals()).toHaveLength(2);
  });
});
