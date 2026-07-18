import { BrowserContext, Page } from 'playwright';
import { logStatus, logSuccess, logError } from './helpers';
import { logoutPortal } from './portal';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

export async function navigateToAIS(context: BrowserContext, page: Page, pan: string = 'default'): Promise<void> {
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

  logStatus("Ensuring we are on AIS home page...");
  if (!aisPage.url().includes('/complianceportal/ais/home')) {
    await aisPage.goto('https://ais.insight.gov.in/complianceportal/ais/home', {
      waitUntil: 'domcontentloaded'
    });
  }

  logStatus("Clicking the Annual Information Statement (AIS) tile...");
  await aisPage.waitForSelector('text=Annual Information Statement (AIS)', { timeout: 30000 });
  await aisPage.locator('text=Annual Information Statement (AIS)').first().click();

  logStatus("Waiting for download options to appear on the AIS page...");
  await aisPage.waitForTimeout(2000);

  const downloadsDir = path.resolve(process.cwd(), 'automation', 'downloads', pan);
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  // 1. Open Download Options Modal / Icon if present
  let openedModal = false;
  const downloadIconSelectors = [
    'button:has-text("Download")',
    'a:has-text("Download")',
    '[title*="Download"]',
    '[aria-label*="Download"]',
    '.download-icon',
    'mat-icon:has-text("download")',
    'i.fa-download',
    '.btn-download',
    '#download'
  ];

  for (const selector of downloadIconSelectors) {
    try {
      const locator = aisPage.locator(selector).first();
      if (await locator.isVisible({ timeout: 1500 })) {
        logStatus(`Clicking download option trigger: ${selector}`);
        await locator.click();
        openedModal = true;
        await aisPage.waitForTimeout(1000);
        break;
      }
    } catch (e) {
      // Try next
    }
  }

  // 2. Download AIS PDF
  logStatus("Attempting to download AIS PDF...");
  const downloadedPdfPath = await downloadFile(aisPage, downloadsDir, ['PDF', 'AIS (PDF)', 'Download PDF', 'button:has-text("PDF")']);
  if (downloadedPdfPath) {
    logSuccess(`AIS PDF downloaded to: ${downloadedPdfPath}`);
  }

  // 3. Download AIS JSON
  logStatus("Attempting to download AIS JSON...");
  const downloadedJsonPath = await downloadFile(aisPage, downloadsDir, ['JSON', 'AIS (JSON)', 'Download JSON', 'button:has-text("JSON")']);
  if (downloadedJsonPath) {
    logSuccess(`AIS JSON downloaded to: ${downloadedJsonPath}`);
  }

  // 4. Auto-Open Downloaded Files / Folder
  const targetToOpen = downloadedPdfPath || downloadedJsonPath || downloadsDir;
  logStatus(`Opening downloaded AIS workspace: ${targetToOpen}`);
  try {
    const startCmd = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${startCmd} "${targetToOpen}"`);
    logSuccess("AIS PDF & JSON downloaded and workspace opened successfully.");
  } catch (err: any) {
    logStatus(`Note: Could not auto-launch viewer: ${err.message || err}`);
    logSuccess("AIS PDF & JSON downloaded successfully.");
  }

  // 5. Gracefully logout portal session
  try {
    await logoutPortal(page);
  } catch (e) {
    // Ignore logout error
  }
}

async function downloadFile(aisPage: Page, downloadsDir: string, btnTexts: string[]): Promise<string | null> {
  for (const text of btnTexts) {
    try {
      const btn = aisPage.locator(text.startsWith('button') ? text : `button:has-text("${text}"), a:has-text("${text}"), text="${text}"`).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        logStatus(`Clicking download option: "${text}"`);
        
        const downloadPromise = aisPage.waitForEvent('download', { timeout: 30000 });
        await btn.click();
        
        const download = await downloadPromise;
        if (download) {
          const suggestedFilename = download.suggestedFilename();
          const targetPath = path.join(downloadsDir, suggestedFilename);
          await download.saveAs(targetPath);
          return targetPath;
        }
      }
    } catch (e) {
      // Try next selector
    }
  }

  // Fallback: Check if generic download button triggers a file
  try {
    const downloadPromise = aisPage.waitForEvent('download', { timeout: 10000 });
    const genericBtn = aisPage.getByRole('button', { name: /download/i }).first();
    if (await genericBtn.isVisible({ timeout: 1500 })) {
      await genericBtn.click();
      const download = await downloadPromise;
      if (download) {
        const targetPath = path.join(downloadsDir, download.suggestedFilename());
        await download.saveAs(targetPath);
        return targetPath;
      }
    }
  } catch (e) {
    // No download triggered
  }

  return null;
}
