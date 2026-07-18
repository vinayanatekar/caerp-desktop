import { Page } from 'playwright';
import { logStatus, logWaitingLogin, logLoginSuccess, logError } from './helpers';

async function typeHumanLike(locator: any, text: string): Promise<void> {
  for (const char of text) {
    await locator.pressSequentially(char);
    const delay = Math.floor(Math.random() * 70) + 40; // Random delay between 40ms and 110ms per character
    await locator.page().waitForTimeout(delay);
  }
}

async function checkAndHandleSessionExpire(page: Page): Promise<void> {
  const currentUrl = page.url();
  const isExpired = currentUrl.includes('sessionExpire') || currentUrl.includes('session-expired') || (await page.locator('text=Session has Expired').count() > 0);
  if (isExpired) {
    logStatus("Redirected to sessionExpire URL. Resetting storage and recovering session back to login page...");
    try {
      await page.evaluate(async () => {
        try {
          localStorage.clear();
          sessionStorage.clear();
          if (window.indexedDB && window.indexedDB.databases) {
            const dbs = await window.indexedDB.databases();
            for (const db of dbs) {
              if (db.name) window.indexedDB.deleteDatabase(db.name);
            }
          }
        } catch (e) {}
      });
      await page.context().clearCookies();
      await page.waitForTimeout(300);

      const loginLink = page.locator('a:has-text("Login"), a[href*="login"], p:has-text("Click here to") a').first();
      if (await loginLink.isVisible({ timeout: 5000 })) {
        logStatus("Clicking 'Login' hyperlink on Session Expired page...");
        await loginLink.click({ force: true });
        await page.waitForTimeout(1500);
      } else {
        await page.goto('https://eportal.incometax.gov.in/iec/foservices/#/login', {
          waitUntil: 'domcontentloaded'
        });
        await page.waitForTimeout(1000);
      }
    } catch (e: any) {
      logStatus("Session recovery navigation error: " + (e.message || e));
      await page.goto('https://eportal.incometax.gov.in/iec/foservices/#/login', {
        waitUntil: 'domcontentloaded'
      });
    }
  }
}

export async function handleLogin(page: Page, pan: string, password: string): Promise<void> {
  logWaitingLogin("No active session. Please authenticate in the opened browser window.");
  logStatus("Attempting automated credentials entry...");

  // Check if current URL is redirected to sessionExpire
  await checkAndHandleSessionExpire(page);

  // Fill PAN slowly with random keystroke delay
  try {
    logStatus(`Typing PAN (${pan}) slowly with random keystroke delays...`);
    // Re-check sessionExpire before waiting for selector
    await checkAndHandleSessionExpire(page);
    await page.waitForSelector('#panAdhaarUserId', { timeout: 15000 });
    const panInput = page.locator('#panAdhaarUserId');
    await panInput.click();
    await panInput.press('Control+A');
    await panInput.press('Backspace');
    await panInput.fill('');
    await page.waitForTimeout(300);
    await typeHumanLike(panInput, pan);
    await panInput.dispatchEvent('input');
    await panInput.dispatchEvent('change');
    await panInput.dispatchEvent('blur');
    await page.waitForTimeout(600);

    // Click Continue
    logStatus("Clicking Continue button...");
    const continueBtn = page.locator('button:has-text("Continue"), button.large-button-primary').first();
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
    } else {
      await panInput.press('Enter');
    }

    // Backup: press Enter if still on PAN page after 1.5 seconds
    await page.waitForTimeout(1500);
    if (await page.locator('#panAdhaarUserId').isVisible()) {
      logStatus("Pressing Enter to submit PAN form...");
      await page.keyboard.press('Enter');
    }
  } catch (err: any) {
    logError(`Error entering PAN: ${err.message || err}`);
  }

  // Wait a second and confirm secure access message checkbox
  try {
    logStatus("Waiting 1 second before checking secure access checkbox...");
    await page.waitForTimeout(1000);
    await page.waitForSelector('mat-checkbox, input[type="checkbox"], label:has-text("Please confirm")', { timeout: 15000 });
    
    const matCheckbox = page.locator('mat-checkbox, .mat-checkbox-input, label:has-text("Please confirm your secure access message"), label:has-text("Please confirm")').first();
    if (await matCheckbox.isVisible({ timeout: 5000 })) {
      logStatus("Checking secure access message checkbox...");
      await matCheckbox.click();
      await page.waitForTimeout(500);
    }
  } catch (err: any) {
    logStatus("Secure access mat-checkbox bypassed or not found.");
  }

  // Clear autocomplete password and type password slowly with random delay
  try {
    const pwdSelector = 'input[type="password"], #loginPassword';
    await page.waitForSelector(pwdSelector, { timeout: 15000 });
    const pwdInput = page.locator(pwdSelector).first();
    
    logStatus("Clearing autofilled/existing password if present...");
    await pwdInput.click();
    await pwdInput.press('Control+A');
    await pwdInput.press('Backspace');
    await pwdInput.fill('');
    await page.waitForTimeout(400);

    logStatus("Typing password slowly with random delay (mimicking human)...");
    await typeHumanLike(pwdInput, password);
    await pwdInput.dispatchEvent('input');
    await pwdInput.dispatchEvent('change');
    await pwdInput.dispatchEvent('blur');
    await page.waitForTimeout(1200);

    logStatus("Submitting password (clicking Continue)...");
    const pwdContinueBtn = page.locator('button:has-text("Continue"), button:has-text("Submit"), button.large-button-primary').first();
    if (await pwdContinueBtn.isVisible()) {
      await pwdContinueBtn.click();
    } else {
      await pwdInput.press('Enter');
    }
  } catch (err: any) {
    logError(`Error entering password: ${err.message || err}`);
  }

  // Check for "Error : Request is not authenticated" banner
  try {
    const errorBox = page.locator('text=Request is not authenticated, text=Error :').first();
    if (await errorBox.isVisible({ timeout: 2500 })) {
      logStatus("Portal showed 'Request is not authenticated'. Clearing password and re-trying with human keystrokes...");
      const pwdInput = page.locator('input[type="password"], #loginPassword').first();
      await pwdInput.click();
      await pwdInput.press('Control+A');
      await pwdInput.press('Backspace');
      await pwdInput.fill('');
      await page.waitForTimeout(1000);
      await typeHumanLike(pwdInput, password);
      await pwdInput.dispatchEvent('input');
      await pwdInput.dispatchEvent('change');
      await pwdInput.dispatchEvent('blur');
      await page.waitForTimeout(1500);

      const pwdContinueBtn = page.locator('button:has-text("Continue"), button:has-text("Submit"), button.large-button-primary').first();
      if (await pwdContinueBtn.isVisible()) {
        await pwdContinueBtn.click();
      } else {
        await pwdInput.press('Enter');
      }
    }
  } catch (e) {
    // No auth error box
  }

  // Handle Dual Login Detected popup modal if present
  try {
    logStatus("Checking for 'Dual Login Detected' modal...");
    const dualLoginBtn = page.locator('button:has-text("Login Here"), button:has-text("LOGIN HERE")').first();
    if (await dualLoginBtn.isVisible({ timeout: 6000 })) {
      logStatus("Dual Login Detected modal found. Clicking 'Login Here' to override previous active session...");
      await dualLoginBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    // Modal did not appear
  }

  // Wait for user to complete manual OTP / Captcha checks if prompted
  logStatus("Waiting for user to complete dashboard authentication...");
  try {
    await page.waitForSelector('text=Services', { timeout: 120000 });
    logLoginSuccess("Dashboard logged in successfully.");
  } catch (err: any) {
    // Check again for Dual Login Detected if page took time
    try {
      const dualLoginBtn = page.locator('button:has-text("Login Here"), button:has-text("LOGIN HERE")').first();
      if (await dualLoginBtn.isVisible({ timeout: 2000 })) {
        logStatus("Late Dual Login Detected modal found. Clicking 'Login Here'...");
        await dualLoginBtn.click();
        await page.waitForSelector('text=Services', { timeout: 60000 });
        logLoginSuccess("Dashboard logged in successfully.");
        return;
      }
    } catch (e) {}

    throw new Error(`Authentication validation timed out: ${err.message || err}`);
  }
}

export async function logoutPortal(page: Page): Promise<void> {
  logStatus("Gracefully logging out of Income Tax Portal...");
  try {
    const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Log Out"), [aria-label*="Logout"]').first();
    if (await logoutBtn.isVisible({ timeout: 3000 })) {
      await logoutBtn.click();
      logStatus("Logout button clicked successfully.");
    } else {
      const profileIcon = page.locator('.user-profile-icon, mat-icon:has-text("account_circle"), .profile-img, [title*="Profile"]').first();
      if (await profileIcon.isVisible({ timeout: 2000 })) {
        await profileIcon.click();
        await page.waitForTimeout(500);
        const menuLogout = page.locator('text=Logout, text=Log Out').first();
        if (await menuLogout.isVisible({ timeout: 2000 })) {
          await menuLogout.click();
          logStatus("Logged out from profile menu.");
        }
      }
    }
  } catch (err: any) {
    logStatus(`Logout note: ${err.message || err}`);
  }
}
