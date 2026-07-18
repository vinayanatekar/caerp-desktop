import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';
import { logStatus } from './helpers';

export interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
}

const LOG_FILE = path.resolve(process.cwd(), 'automation', 'google_search.log');

function writeLog(msg: string) {
  const timestamp = new Date().toISOString();
  const formattedMsg = `[${timestamp}] ${msg}\n`;
  logStatus(msg);
  try {
    fs.appendFileSync(LOG_FILE, formattedMsg, 'utf-8');
  } catch (e) {
    // Ignore file write error
  }
}

export async function searchGoogleUser(userName: string): Promise<GoogleSearchResult[]> {
  writeLog(`=== START Web Search for User: "${userName}" ===`);

  try {
    writeLog(`Querying web search engine for "${userName}"...`);

    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `q=${encodeURIComponent(userName)}`
    });

    const html = await res.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const results: GoogleSearchResult[] = [];
    const items = Array.from(document.querySelectorAll('.result'));

    for (const item of items) {
      if (results.length >= 10) break;
      const a = item.querySelector('.result__a') as HTMLAnchorElement;
      if (!a) continue;

      let title = a.textContent?.trim() || '';
      let link = a.getAttribute('href') || '';

      // Unescape common HTML entities in titles
      title = title.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");

      // Extract direct target URL from redirect wrapper
      if (link.includes('uddg=')) {
        const match = link.match(/uddg=([^&]+)/);
        if (match) link = decodeURIComponent(match[1]);
      }

      if (!title || !link || !link.startsWith('http')) continue;

      const snippetEl = item.querySelector('.result__snippet');
      let snippet = snippetEl ? (snippetEl.textContent?.trim() || '') : '';
      snippet = snippet.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");

      if (!results.some(r => r.link === link)) {
        results.push({ title, link, snippet });
      }
    }

    writeLog(`Successfully retrieved ${results.length} organic search results for "${userName}".`);
    results.forEach((r, idx) => {
      writeLog(`  [${idx + 1}] "${r.title}" -> ${r.link}`);
    });

    writeLog(`=== END Search for User: "${userName}" (SUCCESS) ===`);
    return results;

  } catch (err: any) {
    writeLog(`[ERROR] Search failed: ${err.stack || err.message || err}`);
    throw err;
  }
}
