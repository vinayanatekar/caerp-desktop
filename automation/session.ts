import { Page } from 'playwright';
import { logSessionStatus, logStatus } from './helpers';

export async function checkSession(page: Page): Promise<boolean> {
  logStatus('Checking active portal session...');
  try {
    const result = await Promise.race([
      page.waitForSelector('#panAdhaarUserId', { timeout: 7000 }).then(() => 'login'),
      page.waitForSelector('text=Services', { timeout: 7000 }).then(() => 'dashboard')
    ]);
    if (result === 'dashboard') {
      logSessionStatus('Logged In');
      return true;
    }
  } catch (err) {
    if (await page.locator('text=Services').count() > 0 || page.url().includes('dashboard')) {
      logSessionStatus('Logged In');
      return true;
    }
  }
  logSessionStatus('Not Logged In');
  return false;
}
