import { createServer } from 'http';
import { BrowserManager } from './browserManager';
import { handleLogin } from './portal';
import { checkSession } from './session';
import { navigateToAIS } from './ais';
import { navigateToTIS } from './tis';
import { searchGoogleUser } from './googleSearch';
import { logStatus, logSuccess, logError } from './helpers';

const PORT = 30100;

async function main() {
  logStatus("Initializing BrowserManager (idle)...");
  const browserManager = BrowserManager.getInstance();
  
  logStatus(`Starting HTTP automation daemon on port ${PORT}...`);
  
  const server = createServer(async (req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/action') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const { pan, password, target } = data;
          
          logStatus(`Received action request: target=${target}, PAN=${pan}`);
          
          // Re-launch browser context for this specific client to preserve their user profile cookies
          await browserManager.startBrowser(pan);
          
          const page = browserManager.getPage();
          const context = browserManager.getContext();
          
          if (!page || !context) {
            throw new Error("Failed to initialize Playwright browser workspace.");
          }

          logStatus("Navigating to Income Tax main portal entry point (https://eportal.incometax.gov.in)...");
          await page.goto('https://eportal.incometax.gov.in', {
            waitUntil: 'domcontentloaded'
          });
          await page.waitForTimeout(1500);

          // Check if session is already valid
          const isLoggedIn = await checkSession(page);

          if (!isLoggedIn) {
            logStatus("Unauthenticated session. Resetting storage, IndexedDB, and cookies before launching fresh login session...");
            try {
              // Clear local storage, session storage, and IndexedDB BEFORE navigating to fresh login route
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
              await context.clearCookies();
              await page.waitForTimeout(500);

              // Navigate directly to the base login route
              logStatus("Navigating to login URL (https://eportal.incometax.gov.in/iec/foservices/#/login)...");
              await page.goto('https://eportal.incometax.gov.in/iec/foservices/#/login', {
                waitUntil: 'domcontentloaded'
              });
              await page.waitForTimeout(1500);

              // Check if redirected to sessionExpire URL or banner is displayed
              if (page.url().includes('sessionExpire') || page.url().includes('session-expired') || (await page.locator('text=Session has Expired').count() > 0)) {
                logStatus("Detected 'Session has Expired' page (https://eportal.incometax.gov.in/iec/foservices/#/sessionExpire)");
                const loginLink = page.locator('a:has-text("Login"), a[href*="login"], p:has-text("Click here to") a').first();
                if (await loginLink.isVisible({ timeout: 5000 })) {
                  logStatus("Clicking 'Login' hyperlink on Session Expired page...");
                  await loginLink.click({ force: true });
                  await page.waitForTimeout(1500);
                } else {
                  logStatus("Navigating from sessionExpire back to login route...");
                  await page.goto('https://eportal.incometax.gov.in/iec/foservices/#/login', {
                    waitUntil: 'domcontentloaded'
                  });
                  await page.waitForTimeout(1500);
                }
              }
            } catch (e: any) {
              logStatus("Session reset note: " + (e.message || e));
            }

            // Execute automated login flow
            await handleLogin(page, pan, password);
          } else {
            logStatus("Active authenticated session detected. Skipping login entry.");
          }

          // Direct routing based on target parameter
          if (target === 'ais') {
            await navigateToAIS(context, page, pan);
          } else if (target === 'tis') {
            await navigateToTIS(context, page);
          } else if (target === '26as') {
            logStatus("Navigating to Form 26AS (TRACES)...");
            await page.waitForSelector('text=Services', { timeout: 30000 });
            await page.goto('https://eportal.incometax.gov.in/iec/foservices/#/dashboard/tax-credit-statement-26as', {
              waitUntil: 'domcontentloaded'
            });
            
            await Promise.race([
              page.waitForSelector('button:has-text("Confirm")', { timeout: 15000 }),
              page.waitForSelector('a:has-text("Confirm")', { timeout: 15000 }),
              page.waitForSelector('button:has-text("Proceed")', { timeout: 15000 })
            ]);
            
            const confirmBtn = page.locator('button:has-text("Confirm"), a:has-text("Confirm"), button:has-text("Proceed")').first();
            logStatus("Clicking Confirm to redirect to TRACES...");
            
            const [tracesPage] = await Promise.all([
              context.waitForEvent('page'),
              confirmBtn.click()
            ]);
            
            await tracesPage.waitForURL(url => url.href !== 'about:blank', { timeout: 30000 });
            await tracesPage.waitForLoadState('domcontentloaded');
            logSuccess("Form 26AS (TRACES) workspace opened successfully.");
          } else {
            logStatus("Navigating to target page (https://eportal.incometax.gov.in/iec/foservices/#/dashboard/fileIncomeTaxReturn)...");
            await page.goto('https://eportal.incometax.gov.in/iec/foservices/#/dashboard/fileIncomeTaxReturn', {
              waitUntil: 'domcontentloaded'
            });
            logSuccess("Income Tax Return file page loaded successfully.");
          }

          res.writeHead(200);
          res.end(JSON.stringify({ status: 'success', message: 'Action completed successfully' }));
        } catch (err: any) {
          logError(`Automation action failed: ${err.message || err}`);
          res.writeHead(500);
          res.end(JSON.stringify({ status: 'error', error: err.message || err }));
        }
      });
    } else if (req.method === 'POST' && req.url === '/check') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const { pan } = data;
          
          logStatus(`Received check session request for PAN: ${pan}`);
          await browserManager.startBrowser(pan);
          
          const page = browserManager.getPage();
          if (!page) {
            throw new Error("Failed to get page from BrowserManager");
          }
          
          await page.goto('https://eportal.incometax.gov.in/iec/foservices/#/dashboard', {
            waitUntil: 'domcontentloaded'
          });
          
          const isLoggedIn = await checkSession(page);
          
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'success', loggedIn: isLoggedIn }));
        } catch (err: any) {
          logError(`Check session failed: ${err.message || err}`);
          res.writeHead(500);
          res.end(JSON.stringify({ status: 'error', error: err.message || err }));
        }
      });
    } else if (req.method === 'POST' && req.url === '/search_google') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const { name, pan } = data;
          
          logStatus(`Received Google search request for user: "${name}"`);
          const results = await searchGoogleUser(name);
          
          const resBody = JSON.stringify({ status: 'success', results });
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Length', Buffer.byteLength(resBody));
          res.writeHead(200);
          res.end(resBody);
        } catch (err: any) {
          console.error(`Google search error: ${err.message || err}`);
          const errBody = JSON.stringify({ status: 'error', error: err.message || err });
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Length', Buffer.byteLength(errBody));
          res.writeHead(500);
          res.end(errBody);
        }
      });
    } else if (req.method === 'POST' && req.url === '/close') {
      logStatus("Shutdown request received. Terminating daemon...");
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'success', message: 'Daemon shutting down' }));
      
      // Close browser and terminate Node process
      await browserManager.closeBrowser();
      process.exit(0);
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    logStatus(`CAERP automation daemon listening at http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  logError(`Fatal automation daemon error: ${err}`);
});