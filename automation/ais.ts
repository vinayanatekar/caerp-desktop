import { BrowserContext, Page } from 'playwright';
import { logStatus, logSuccess } from './helpers';

export async function navigateToAIS(context: BrowserContext, page: Page): Promise<void> {
  logStatus("Navigating to compliance portal for AIS...");
  
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

  logStatus("Navigating directly to AIS details section...");
  await aisPage.goto('https://ais.insight.gov.in/complianceportal/ais/details/ais-form-26-as', {
    waitUntil: 'domcontentloaded'
  });

  logSuccess("AIS Workspace opened successfully.");
}
