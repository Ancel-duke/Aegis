import { Injectable, Logger } from '@nestjs/common';

export interface SendPasswordResetEmailOptions {
  to: string;
  resetLink: string;
  expiresInMinutes: number;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /**
   * Send password reset email. Mock implementation logs to console.
   * Replace with real SMTP/transactional provider (e.g. SendGrid, SES) when available.
   */
  async sendPasswordResetEmail(options: SendPasswordResetEmailOptions): Promise<void> {
    this.logger.log(
      `[Mock Mail] Password reset requested for ${options.to}. ` +
        `Link: ${options.resetLink} (expires in ${options.expiresInMinutes} min)`,
    );
    // In production: await this.transport.sendMail({ to, subject, html: ... });
  }
}
