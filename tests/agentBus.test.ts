import { afterEach, describe, expect, it } from 'vitest';
import { AgentBus } from '../src/virtualOffice/agentBus.js';

describe('AgentBus', () => {
  let bus: AgentBus;

  afterEach(() => {
    bus?.stop();
  });

  it('creates a spawning agent', () => {
    bus = new AgentBus();
    const agent = bus.applyEvent({
      id: 'a1',
      type: 'spawn',
      name: 'Recon-1',
      role: 'explore',
      action: 'Mapping the codebase',
    });

    expect(agent).toMatchObject({
      id: 'a1',
      name: 'Recon-1',
      role: 'explore',
      status: 'spawning',
      action: 'Mapping the codebase',
      history: ['Mapping the codebase'],
    });
    expect(bus.snapshot()).toEqual([agent]);
  });

  it('transitions to running on a status event and caps history at 5', () => {
    bus = new AgentBus();
    bus.applyEvent({ id: 'a1', type: 'spawn', name: 'Recon-1' });
    for (let i = 1; i <= 6; i += 1) {
      bus.applyEvent({ id: 'a1', type: 'status', action: `Step ${i}` });
    }

    const agent = bus.snapshot()[0];
    expect(agent.status).toBe('running');
    expect(agent.history).toEqual([
      'Step 2',
      'Step 3',
      'Step 4',
      'Step 5',
      'Step 6',
    ]);
  });

  it('marks complete/error as terminal', () => {
    bus = new AgentBus();
    bus.applyEvent({ id: 'a1', type: 'spawn', name: 'Recon-1' });
    const done = bus.applyEvent({ id: 'a1', type: 'complete' });
    expect(done.status).toBe('done');
    expect(done.action).toBe('Task complete');

    bus = new AgentBus();
    bus.applyEvent({ id: 'a2', type: 'spawn', name: 'Recon-2' });
    const errored = bus.applyEvent({ id: 'a2', type: 'error' });
    expect(errored.status).toBe('error');
    expect(errored.action).toBe('Task failed');
  });

  it('ignores further events against a terminal agent', () => {
    bus = new AgentBus();
    bus.applyEvent({ id: 'a1', type: 'spawn', name: 'Recon-1' });
    bus.applyEvent({ id: 'a1', type: 'complete' });
    bus.applyEvent({ id: 'a1', type: 'status', action: 'still going?' });

    const agent = bus.snapshot()[0];
    expect(agent.status).toBe('done');
    expect(agent.action).toBe('Task complete');
  });

  it('auto-vivifies on a status event for an unknown id', () => {
    bus = new AgentBus();
    const agent = bus.applyEvent({
      id: 'unknown-1',
      type: 'status',
      action: 'Already in progress',
    });

    expect(agent.status).toBe('running');
    expect(agent.name).toBe('unknown-1');
    expect(agent.role).toBe('unassigned');
  });

  it('sweep retires terminal agents past retireAfterMs', () => {
    bus = new AgentBus({ retireAfterMs: 1000 });
    bus.applyEvent({ id: 'a1', type: 'spawn', name: 'Recon-1' });
    bus.applyEvent({ id: 'a1', type: 'complete' });

    const removed: string[] = [];
    bus.on('remove', (payload: { id: string }) => removed.push(payload.id));

    bus.sweep(Date.now() + 500);
    expect(bus.snapshot()).toHaveLength(1);

    bus.sweep(Date.now() + 1500);
    expect(bus.snapshot()).toHaveLength(0);
    expect(removed).toEqual(['a1']);
  });

  it('sweep force-errors stale running agents past staleAfterMs', () => {
    bus = new AgentBus({ staleAfterMs: 1000 });
    bus.applyEvent({ id: 'a1', type: 'spawn', name: 'Recon-1' });

    bus.sweep(Date.now() + 500);
    expect(bus.snapshot()[0].status).toBe('spawning');

    bus.sweep(Date.now() + 1500);
    const agent = bus.snapshot()[0];
    expect(agent.status).toBe('error');
    expect(agent.action).toBe('No status update received');
  });
});
