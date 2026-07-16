import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createVirtualOfficeRouter } from '../src/routes/virtualOffice.js';
import { AgentBus } from '../src/virtualOffice/agentBus.js';

const TOKEN = 'test-token';

describe('Virtual Office router', () => {
  let server: Server;
  let baseUrl: string;
  let bus: AgentBus;

  async function start(token: string): Promise<void> {
    bus = new AgentBus();
    const app = express();
    app.use('/virtual-office', createVirtualOfficeRouter(bus, token));
    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}/virtual-office`;
  }

  afterEach(async () => {
    bus.stop();
    await new Promise((resolve) => server.close(resolve));
  });

  describe('GET /', () => {
    beforeEach(() => start(TOKEN));

    it('serves the dashboard HTML', async () => {
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const body = await res.text();
      expect(body).toContain('Virtual Office');
    });
  });

  describe('POST /report', () => {
    it('returns 503 when no report token is configured', async () => {
      await start('');
      const res = await fetch(`${baseUrl}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'a1', type: 'spawn', name: 'Recon-1' }),
      });
      expect(res.status).toBe(503);
    });

    it('returns 401 for a missing or wrong token', async () => {
      await start(TOKEN);
      const res = await fetch(`${baseUrl}/report`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer wrong-token',
        },
        body: JSON.stringify({ id: 'a1', type: 'spawn', name: 'Recon-1' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 for an invalid body', async () => {
      await start(TOKEN);
      const res = await fetch(`${baseUrl}/report`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ id: 'a1', type: 'spawn' }), // missing name
      });
      expect(res.status).toBe(400);
    });

    it('accepts a valid event and reflects it in GET /agents', async () => {
      await start(TOKEN);
      const res = await fetch(`${baseUrl}/report`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({
          id: 'a1',
          type: 'spawn',
          name: 'Recon-1',
          role: 'explore',
          action: 'Mapping the codebase',
        }),
      });
      expect(res.status).toBe(202);

      const agentsRes = await fetch(`${baseUrl}/agents`);
      const { agents } = (await agentsRes.json()) as {
        agents: Array<{ id: string; name: string }>;
      };
      expect(agents).toHaveLength(1);
      expect(agents[0]).toMatchObject({ id: 'a1', name: 'Recon-1' });
    });
  });

  describe('GET /events', () => {
    beforeEach(() => start(TOKEN));

    it('opens an SSE stream starting with a snapshot event', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/events`, {
        signal: controller.signal,
      });
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      const reader = res.body?.getReader();
      const { value } = await reader!.read();
      const chunk = Buffer.from(value!).toString('utf8');
      expect(chunk).toContain('event: snapshot');

      controller.abort();
    });
  });
});
