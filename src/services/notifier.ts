import type { AppConfig } from '../config/index.js';
import { loadConfig } from '../config/index.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('notifier');

/** A message queued for delivery to the business owner. */
export interface Notification {
  to: string;
  from: string;
  subject: string;
  body: string;
}

/**
 * Sends notifications to the business owner.
 *
 * The default transport simply logs the message (and records it so tests and the
 * UI can inspect what would have been sent). A real SMTP/provider transport can
 * be dropped in later without touching callers; the surrounding approval flow
 * only depends on {@link Notifier.notifyOwner}.
 */
export class Notifier {
  private readonly config: AppConfig['approvals'];
  private readonly sent: Notification[] = [];

  constructor(config: AppConfig = loadConfig()) {
    this.config = config.approvals;
  }

  /**
   * Deliver a notification to the owner. When no owner email is configured the
   * message is still recorded (and logged) so nothing is silently dropped.
   */
  async notifyOwner(subject: string, body: string): Promise<Notification> {
    const message: Notification = {
      to: this.config.ownerEmail || '(owner email not configured)',
      from: this.config.fromEmail,
      subject,
      body,
    };

    this.sent.push(message);

    if (!this.config.ownerEmail) {
      log.warn(
        { subject },
        'OWNER_EMAIL not configured; approval notification recorded but not emailed',
      );
    } else {
      log.info({ to: message.to, subject }, 'Sent owner notification');
    }

    return message;
  }

  /** Notifications recorded by this notifier (most useful for tests/UI). */
  listSent(): Notification[] {
    return [...this.sent];
  }
}
