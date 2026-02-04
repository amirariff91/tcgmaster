/**
 * Price Alert Checking Job
 * Checks all active alerts and sends notifications
 */

import { inngest } from '../client';
import { checkAllAlerts } from '@/lib/pricing/alerts';

// Check alerts every 4 hours
export const checkAlerts = inngest.createFunction(
  {
    id: 'check-alerts',
    name: 'Check Price Alerts',
  },
  { cron: '0 */4 * * *' }, // Every 4 hours, offset from price sync
  async ({ step }) => {
    const result = await step.run('check-all-alerts', async () => {
      return checkAllAlerts();
    });

    return result;
  }
);

// Send notification digests
export const sendAlertDigests = inngest.createFunction(
  {
    id: 'send-alert-digests',
    name: 'Send Alert Digests',
  },
  { cron: '0 8 * * *' }, // Daily at 8 AM
  async ({ step }) => {
    // This would aggregate unsent notifications and send email digests
    // Implementation would depend on email service (Resend, SendGrid, etc.)

    return { message: 'Digest sending not yet implemented' };
  }
);
