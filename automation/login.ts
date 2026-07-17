import { createServer } from 'http';
import { BrowserManager } from './browserManager';
import { handleLogin } from './portal';
import { checkSession } from './session';
import { navigateToAIS } from './ais';
import { navigateToTIS } from './tis';
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

          // Go to login page
          await page.goto('https://eportal.incometax.gov.in/iec/foservices/#/login', {
            waitUntil: 'domcontentloaded'
          });

          // Check if session is already valid
          const isLoggedIn = await checkSession(page);

          if (!isLoggedIn) {
            // Execute automated login flow
            await handleLogin(page, pan, password);
          } else {
            logStatus("Active authenticated session detected. Skipping login entry.");
          }

          // Direct routing based on target parameter
          if (target === 'ais') {
            await navigateToAIS(context, page);
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
            logSuccess("Income Tax Portal dashboard loaded.");
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
          
          await page.goto('https://eportal.incometax.gov.in/iec/foservices/#/login', {
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