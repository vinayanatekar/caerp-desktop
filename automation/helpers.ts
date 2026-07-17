export function logStatus(msg: string) {
  console.log(`[STATUS] ${msg}`);
}

export function logSuccess(msg: string) {
  console.log(`[SUCCESS] ${msg}`);
}

export function logError(msg: string) {
  console.error(`[ERROR] ${msg}`);
}

export function logSessionStatus(status: 'Logged In' | 'Not Logged In') {
  console.log(`[SESSION_STATUS] ${status}`);
}

export function logWaitingLogin(msg: string) {
  console.log(`[WAITING_LOGIN] ${msg}`);
}

export function logLoginSuccess(msg: string) {
  console.log(`[LOGIN_SUCCESS] ${msg}`);
}
