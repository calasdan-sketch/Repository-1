import { describe, expect, it, beforeEach } from 'vitest';
import { CommandCenter } from '../src/jobs/command-center.js';
import { NotFoundError } from '../src/lib/errors.js';
import { createDatabase } from '../src/models/db.js';
import { Repository } from '../src/models/repository.js';
import { Notifier } from '../src/services/notifier.js';
import { makeTestConfig } from './helpers.js';

function build() {
  const repo = new Repository(createDatabase(':memory:'));
  const notifier = new Notifier(makeTestConfig());
  const center = new CommandCenter({ repo, notifier });
  return { repo, notifier, center };
}

describe('CommandCenter', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('issues an order to a known division', () => {
    const command = ctx.center.issueOrder('social', 'Post a launch teaser');
    expect(command.division_id).toBe('social');
    expect(ctx.repo.listCommands()).toHaveLength(1);
  });

  it('rejects orders to unknown divisions', () => {
    expect(() => ctx.center.issueOrder('nope', 'do a thing')).toThrow(
      NotFoundError,
    );
  });

  it('stages an approval and notifies the owner', async () => {
    const approval = await ctx.center.requestApproval({
      divisionId: 'operations',
      agentId: 'op-buyer',
      kind: 'purchase',
      summary: 'Buy 200 units of SKU-1',
      amount: 500,
      currency: 'USD',
    });

    expect(approval.status).toBe('pending');
    const sent = ctx.notifier.listSent();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('owner@example.com');
    expect(sent[0].subject).toContain('Purchase');
    expect(sent[0].subject).toContain('500');
  });

  it('rejects approvals for unknown divisions', async () => {
    await expect(
      ctx.center.requestApproval({
        divisionId: 'ghost',
        kind: 'course_change',
        summary: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('records the owner decision on a pending approval', async () => {
    const approval = await ctx.center.requestApproval({
      divisionId: 'marketing',
      kind: 'course_change',
      summary: 'Shift budget to paid search',
    });
    const decided = ctx.center.decideApproval(approval.id, 'approved');
    expect(decided.status).toBe('approved');
  });

  it('throws when deciding an unknown approval', () => {
    expect(() => ctx.center.decideApproval(999, 'rejected')).toThrow(
      NotFoundError,
    );
  });
});

describe('Notifier', () => {
  it('records notifications even when no owner email is configured', async () => {
    const notifier = new Notifier(
      makeTestConfig({
        approvals: { ownerEmail: '', fromEmail: 'cc@example.com' },
      }),
    );
    const message = await notifier.notifyOwner('Subject', 'Body');
    expect(message.to).toContain('not configured');
    expect(notifier.listSent()).toHaveLength(1);
  });
});
