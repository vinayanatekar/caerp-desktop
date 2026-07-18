import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.resolve(process.cwd(), 'automation', 'automation.log');

function appendLog(prefix: string, msg: string) {
  const line = `[${new Date().toISOString()}] [${prefix}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {}
}

export function logStatus(msg: string) {
  console.log(`[STATUS] ${msg}`);
  appendLog('STATUS', msg);
}

export function logSuccess(msg: string) {
  console.log(`[SUCCESS] ${msg}`);
  appendLog('SUCCESS', msg);
}

export function logError(msg: string) {
  console.error(`[ERROR] ${msg}`);
  appendLog('ERROR', msg);
}

export function logSessionStatus(status: 'Logged In' | 'Not Logged In') {
  console.log(`[SESSION_STATUS] ${status}`);
  appendLog('SESSION_STATUS', status);
}

export function logWaitingLogin(msg: string) {
  console.log(`[WAITING_LOGIN] ${msg}`);
  appendLog('WAITING_LOGIN', msg);
}

export function logLoginSuccess(msg: string) {
  console.log(`[LOGIN_SUCCESS] ${msg}`);
  appendLog('LOGIN_SUCCESS', msg);
}
