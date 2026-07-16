import { EventEmitter } from 'node:events';
import { createLogger } from '../lib/logger.js';
import type { AgentEventPayload, AgentState } from './types.js';

const log = createLogger('war-room');

const HISTORY_LIMIT = 5;
const DEFAULT_RETIRE_AFTER_MS = 10 * 60_000;
const DEFAULT_STALE_AFTER_MS = 45 * 60_000;

function isTerminal(status: AgentState['status']): boolean {
  return status === 'done' || status === 'error';
}

/**
 * In-memory hub of "War Room" agent state.
 *
 * Applies lifecycle events reported by the outer Claude Code agent, keeps a
 * live snapshot per agent id, and emits `'agent'` (upsert) / `'remove'`
 * (retired) events that SSE clients subscribe to. Nothing here is persisted:
 * a live-ops view is expected to reset on restart.
 */
export class AgentBus extends EventEmitter {
  private readonly agents = new Map<string, AgentState>();
  private readonly retireAfterMs: number;
  private readonly staleAfterMs: number;
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(opts: { retireAfterMs?: number; staleAfterMs?: number } = {}) {
    super();
    // Each connected SSE client adds two listeners ('agent' + 'remove');
    // the default cap of 10 would warn with just a handful of open tabs.
    this.setMaxListeners(50);
    this.retireAfterMs = opts.retireAfterMs ?? DEFAULT_RETIRE_AFTER_MS;
    this.staleAfterMs = opts.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
    this.sweepTimer = setInterval(() => this.sweep(), 30_000).unref();
  }

  applyEvent(payload: AgentEventPayload): AgentState {
    const now = Date.now();
    const existing = this.agents.get(payload.id);

    if (existing && isTerminal(existing.status) && payload.type !== 'spawn') {
      log.warn(
        { id: payload.id, type: payload.type, status: existing.status },
        'Ignoring event against a terminal agent',
      );
      return existing;
    }

    if (existing && payload.type === 'spawn') {
      log.warn({ id: payload.id }, 'Re-spawn of an already-known agent');
    }
    if (!existing && payload.type !== 'spawn') {
      log.warn(
        { id: payload.id, type: payload.type },
        'Event for an unknown agent; auto-vivifying',
      );
    }

    const status = ((): AgentState['status'] => {
      switch (payload.type) {
        case 'spawn':
          return 'spawning';
        case 'status':
          return 'running';
        case 'complete':
          return 'done';
        case 'error':
          return 'error';
      }
    })();

    const action =
      payload.action ??
      (payload.type === 'complete'
        ? 'Mission complete'
        : payload.type === 'error'
          ? 'Mission failed'
          : (existing?.action ?? 'Awaiting orders'));

    const history = [...(existing?.history ?? []), action].slice(
      -HISTORY_LIMIT,
    );

    const next: AgentState = {
      id: payload.id,
      name: payload.name ?? existing?.name ?? payload.id,
      role: payload.role ?? existing?.role ?? 'unassigned',
      status,
      action,
      history,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.agents.set(payload.id, next);
    this.emit('agent', next);
    return next;
  }

  snapshot(): AgentState[] {
    return [...this.agents.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Retire terminal agents past `retireAfterMs` and force-error agents that
   * have gone quiet past `staleAfterMs` (e.g. the reporting process crashed
   * without sending `complete`/`error`). Exposed directly so tests can drive
   * it deterministically with an injected timestamp instead of real timers.
   */
  sweep(now: number = Date.now()): void {
    for (const agent of this.agents.values()) {
      if (isTerminal(agent.status)) {
        if (now - agent.updatedAt >= this.retireAfterMs) {
          this.agents.delete(agent.id);
          this.emit('remove', { id: agent.id });
        }
        continue;
      }

      if (now - agent.updatedAt >= this.staleAfterMs) {
        const stale: AgentState = {
          ...agent,
          status: 'error',
          action: 'Lost contact — no updates received',
          history: [
            ...agent.history,
            'Lost contact — no updates received',
          ].slice(-HISTORY_LIMIT),
          updatedAt: now,
        };
        this.agents.set(agent.id, stale);
        this.emit('agent', stale);
      }
    }
  }

  stop(): void {
    clearInterval(this.sweepTimer);
  }
}
