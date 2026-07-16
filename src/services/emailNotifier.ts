import nodemailer, { type Transporter } from 'nodemailer';
import type { AppConfig } from '../config/index.js';
import { loadConfig } from '../config/index.js';
import { ConfigError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('email-notifier');

export interface EmailMessage {
  subject: string;
  text: string;
}

/**
 * Sends notification emails through Gmail's SMTP relay using an app
 * password (not the account password — see README for how to generate one).
 */
export class EmailNotifier {
  private readonly config: AppConfig['stockAlert'];
  private transporter: Transporter | null = null;

  constructor(config: AppConfig = loadConfig()) {
    this.config = config.stockAlert;
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }
    if (!this.config.gmailUser || !this.config.gmailAppPassword) {
      throw new ConfigError(
        'GMAIL_USER / GMAIL_APP_PASSWORD are not configured',
      );
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.config.gmailUser,
        pass: this.config.gmailAppPassword,
      },
    });
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<void> {
    const recipient = this.config.recipientEmail || this.config.gmailUser;
    if (!recipient) {
      throw new ConfigError(
        'No recipient configured (set STOCK_ALERT_RECIPIENT_EMAIL or GMAIL_USER)',
      );
    }

    const transporter = this.getTransporter();
    log.info({ recipient, subject: message.subject }, 'Sending alert email');
    await transporter.sendMail({
      from: this.config.gmailUser,
      to: recipient,
      subject: message.subject,
      text: message.text,
    });
  }
}
