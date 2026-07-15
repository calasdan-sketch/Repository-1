import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestJson } from '../src/lib/http.js';
import { ExternalApiError } from '../src/lib/errors.js';

describe('requestJson', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        ),
    );
    const result = await requestJson<{ ok: boolean }>('https://x.test');
    expect(result.ok).toBe(true);
  });

  it('retries on 429 then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 429,
          headers: { 'retry-after': '0' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestJson<{ ok: boolean }>('https://x.test', {
      baseDelayMs: 1,
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws ExternalApiError on non-retryable 4xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('bad', { status: 400 })),
    );
    await expect(requestJson('https://x.test')).rejects.toBeInstanceOf(
      ExternalApiError,
    );
  });

  it('gives up after max retries on persistent 500s', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('err', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      requestJson('https://x.test', { maxRetries: 2, baseDelayMs: 1 }),
    ).rejects.toBeInstanceOf(ExternalApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
