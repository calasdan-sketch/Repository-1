import type { AppConfig } from '../src/config/index.js';

/**
 * Build a fully-populated AppConfig for tests, with overrides.
 */
export function makeTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    port: 3000,
    logLevel: 'silent',
    databasePath: ':memory:',
    shopify: {
      shop: 'test.myshopify.com',
      accessToken: 'token',
      webhookSecret: 'shhh-secret',
      apiVersion: '2024-10',
    },
    autods: {
      apiBase: 'https://api.autods.com',
      apiToken: 'autods-token',
      storeId: 'store-1',
    },
    claude: { apiKey: 'anthropic-key', model: 'claude-x', maxTokens: 100 },
    automation: {
      autoPublish: false,
      autoFulfill: false,
      syncCron: '* * * * *',
    },
    stockAlert: {
      ticker: 'JEPQ',
      sellPrice: 31,
      checkCron: '* * * * *',
      gmailUser: 'sender@gmail.com',
      gmailAppPassword: 'app-password',
      recipientEmail: 'me@example.com',
    },
    ...overrides,
  };
}
