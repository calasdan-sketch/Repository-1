import { describe, expect, it } from 'vitest';
import { EmailNotifier } from '../src/services/emailNotifier.js';
import { ConfigError } from '../src/lib/errors.js';
import { makeTestConfig } from './helpers.js';

describe('EmailNotifier', () => {
  it('throws when Gmail credentials are not configured', async () => {
    const config = makeTestConfig({
      stockAlert: {
        ticker: 'JEPQ',
        sellPrice: 31,
        checkCron: '* * * * *',
        gmailUser: '',
        gmailAppPassword: '',
        recipientEmail: '',
      },
    });
    const notifier = new EmailNotifier(config);

    await expect(
      notifier.send({ subject: 'test', text: 'test' }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it('throws when no recipient can be resolved', async () => {
    const config = makeTestConfig({
      stockAlert: {
        ticker: 'JEPQ',
        sellPrice: 31,
        checkCron: '* * * * *',
        gmailUser: '',
        gmailAppPassword: 'app-password',
        recipientEmail: '',
      },
    });
    const notifier = new EmailNotifier(config);

    await expect(
      notifier.send({ subject: 'test', text: 'test' }),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});
