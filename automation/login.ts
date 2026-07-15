import { chromium } from 'playwright';

async function main() {
  const pan = process.env.PAN || '';
  const password = process.env.PASSWORD || '';

  if (!pan || !password) {
    console.error("PAN or PASSWORD environment variables are missing.");
    return;
  }

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  // Use a context with default viewport to support standard layout
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`Navigating to Income Tax Portal and attempting login for PAN: ${pan}`);
  await page.goto('https://eportal.incometax.gov.in/iec/foservices/#/login', {
    waitUntil: 'domcontentloaded'
  });

  // Fill PAN/User ID
  try {
    await page.waitForSelector('#panAdhaarUserId', { timeout: 15000 });
    await page.locator('#panAdhaarUserId').fill(pan);
    // Click Continue
    await page.locator('button:has-text("Continue")').click();
  } catch (err) {
    console.error("Error entering PAN/User ID:", err);
  }

  // Confirm secure access checkbox
  try {
    await page.waitForSelector('mat-checkbox', { timeout: 10000 });
    // Angular Material checkbox wrapper click is reliable
    await page.locator('mat-checkbox').click();
  } catch (err) {
    console.warn("Secure access mat-checkbox not found or failed to click:", err);
  }

  // Fill Password and click Continue to login automatically
  try {
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.locator('input[type="password"]').fill(password);
    // Click Continue to log in automatically
    await page.locator('button:has-text("Continue")').click();
  } catch (err) {
    console.warn("Password input not found or failed to login:", err);
  }

  // Keep the browser open while user completes authentication (e.g. 5 minutes)
  await page.waitForTimeout(300000);

  await browser.close();
}

main().catch(console.error);