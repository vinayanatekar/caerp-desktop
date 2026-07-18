import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import { logStatus } from './helpers';

export class BrowserManager {
  private static instance: BrowserManager | null = null;
  
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isPersistent = false;
  private currentPan = '';

  private constructor() {}

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  public async startBrowser(pan: string = ''): Promise<void> {
    // If browser is active and it is the same client PAN, reuse it
    if ((this.browser || this.context) && this.currentPan === pan) {
      logStatus(`Reusing active browser context for PAN: ${pan || 'default'}`);
      try {
        if (this.page) {
          try {
            if (this.page.isClosed()) {
              logStatus('Active page was closed. Opening a new page in the same context...');
              this.page = await this.context!.newPage();
            }
          } catch (e) {
            this.page = await this.context!.newPage();
          }
        } else if (this.context) {
          this.page = await this.context.newPage();
        }
        return;
      } catch (err: any) {
        logStatus(`Stale browser context detected (${err.message || err}). Cleaning up and opening fresh browser...`);
        await this.closeBrowser();
      }
    }

    // If browser is active but it is for a different PAN, close it first
    if (this.browser || this.context) {
      logStatus(`Closing active browser context for PAN: ${this.currentPan || 'default'} to switch to ${pan || 'default'}...`);
      await this.closeBrowser();
    }

    const args = [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--disable-session-crashed-bubble',
      '--disable-infobars',
      '--no-default-browser-check',
      '--restore-last-session=false'
    ];

    if (pan) {
      const userDataDir = path.resolve(process.cwd(), 'automation', '.user_data', pan);
      logStatus(`Launching persistent browser context (maximized): ${userDataDir}`);
      
      this.context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        viewport: null,
        args
      });
      
      this.context.on('close', () => {
        logStatus(`Persistent browser context for PAN ${pan} closed.`);
        this.browser = null;
        this.context = null;
        this.page = null;
        this.isPersistent = false;
        this.currentPan = '';
      });

      this.browser = this.context.browser();
      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
      this.isPersistent = true;
      this.currentPan = pan;
    } else {
      logStatus('Launching default browser context (maximized)...');
      this.browser = await chromium.launch({
        headless: false,
        args
      });
      this.context = await this.browser.newContext({
        viewport: null
      });
      
      this.context.on('close', () => {
        logStatus('Default browser context closed.');
        this.browser = null;
        this.context = null;
        this.page = null;
        this.isPersistent = false;
        this.currentPan = '';
      });

      this.page = await this.context.newPage();
      this.isPersistent = false;
      this.currentPan = '';
    }
  }

  public getBrowser(): Browser | null {
    return this.browser;
  }

  public getContext(): BrowserContext | null {
    return this.context;
  }

  public getPage(): Page | null {
    return this.page;
  }

  public async closeBrowser(): Promise<void> {
    logStatus('Closing browser...');
    try {
      if (this.isPersistent && this.context) {
        await this.context.close();
      } else {
        if (this.page) await this.page.close();
        if (this.context) await this.context.close();
        if (this.browser) await this.browser.close();
      }
    } catch (err: any) {
      logStatus(`Note: Browser closed with message: ${err.message || err}`);
    } finally {
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isPersistent = false;
      this.currentPan = '';
    }
  }
}
