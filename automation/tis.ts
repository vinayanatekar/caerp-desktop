import { BrowserContext, Page } from 'playwright';
import { logStatus, logSuccess } from './helpers';

export async function navigateToTIS(context: BrowserContext, page: Page): Promise<void> {
  logStatus("Navigating to compliance portal for TIS...");

  // Ensure we are on dashboard and click Services menu dropdown
  await page.waitForSelector('text=Services', { timeout: 30000 });
  await page.locator('text=Services').first().click();

  // Click Annual Information Statement (AIS)
  logStatus("Selecting Annual Information Statement (AIS)...");
  await page.waitForSelector('text=Annual Information Statement (AIS)', { timeout: 10000 });
  await page.locator('text=Annual Information Statement (AIS)').first().click();

  // Handle proceed warning popup
  await page.waitForSelector('button:has-text("Proceed")', { timeout: 15000 });

  logStatus("Intercepting redirection to AIS compliance portal...");
  const [aisPage] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('button:has-text("Proceed")').click()
  ]);

  await aisPage.waitForURL(url => url.href !== 'about:blank', { timeout: 30000 });
  await aisPage.waitForLoadState('domcontentloaded');

  logStatus("Opening Taxpayer Information Summary (TIS) tile...");
  await aisPage.waitForSelector('text=Taxpayer Information Summary (TIS)', { timeout: 20000 });
  await aisPage.locator('text=Taxpayer Information Summary (TIS)').first().click();

  logSuccess("TIS Workspace opened successfully.");
}
