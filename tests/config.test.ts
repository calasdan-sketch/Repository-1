import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, resetConfigCache } from '../src/config/index.js';

describe('config', () => {
  beforeEach(() => {
    resetConfigCache();
  });

  it('applies defaults when env vars are absent', () => {
    delete process.env.PORT;
    delete process.env.AUTO_PUBLISH;
    const config = loadConfig();
    expect(config.port).toBe(3000);
    expect(config.automation.autoPublish).toBe(false);
    expect(config.claude.model).toContain('claude');
  });

  it('parses boolean flags from strings', () => {
    process.env.AUTO_PUBLISH = 'true';
    process.env.AUTO_FULFILL = '1';
    resetConfigCache();
    const config = loadConfig();
    expect(config.automation.autoPublish).toBe(true);
    expect(config.automation.autoFulfill).toBe(true);
  });

  it('coerces numeric port from env', () => {
    process.env.PORT = '8080';
    resetConfigCache();
    expect(loadConfig().port).toBe(8080);
  });
});
