import { Page } from 'playwright';
import { logSessionStatus, logStatus } from './helpers';

export async function checkSession(page: Page): Promise<boolean> {
  logStatus('Checking active portal session...');

  // Check if page URL or content indicates session expired
  if (page.url().includes('sessionExpire') || page.url().includes('session-expired') || page.url().includes('sessionExpired')) {
    logStatus('Session expired URL detected.');
    logSessionStatus('Not Logged In');
    return false;
  }

  try {
    const isExpiredText = await page.locator('text=Session has Expired').count();
    if (isExpiredText > 0) {
      logStatus('Session has Expired banner detected.');
      logSessionStatus('Not Logged In');
      return false;
    }
  } catch (e) {
    // Ignore locator error
  }

  try {
    const result = await Promise.race([
      page.waitForSelector('#panAdhaarUserId', { timeout: 6000 }).then(() => 'login'),
      page.waitForSelector('text=Services', { timeout: 6000 }).then(() => 'dashboard')
    ]);

    if (result === 'dashboard') {
      logSessionStatus('Logged In');
      return true;
    }
  } catch (err) {
    if (!page.url().includes('sessionExpired') && await page.locator('text=Services').count() > 0) {
      logSessionStatus('Logged In');
      return true;
    }
  }

  logSessionStatus('Not Logged In');
  return false;
}
