import { Page } from 'playwright';
import { logStatus, logWaitingLogin, logLoginSuccess, logError } from './helpers';

export async function handleLogin(page: Page, pan: string, password: string): Promise<void> {
  logWaitingLogin("No active session. Please authenticate in the opened browser window.");
  logStatus("Attempting automated credentials entry...");

  // Fill PAN
  try {
    await page.waitForSelector('#panAdhaarUserId', { timeout: 15000 });
    await page.locator('#panAdhaarUserId').fill(pan);
    await page.locator('button:has-text("Continue")').click();
  } catch (err: any) {
    logError(`Error entering PAN: ${err.message || err}`);
  }

  // Confirm secure access checkbox
  try {
    await page.waitForSelector('mat-checkbox', { timeout: 10000 });
    await page.locator('mat-checkbox').click();
  } catch (err: any) {
    logStatus("Secure access mat-checkbox bypassed or not found.");
  }

  // Fill Password
  try {
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button:has-text("Continue")').click();
  } catch (err: any) {
    logError(`Error entering password: ${err.message || err}`);
  }

  // Wait for user to complete manual OTP / Captcha checks
  logStatus("Waiting for user to complete dashboard authentication...");
  try {
    await page.waitForSelector('text=Services', { timeout: 120000 });
    logLoginSuccess("Dashboard logged in successfully.");
  } catch (err: any) {
    throw new Error(`Authentication validation timed out: ${err.message || err}`);
  }
}
