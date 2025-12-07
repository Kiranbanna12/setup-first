// Console Filter to Hide GoTrue Logs
// This will filter out annoying GoTrue debug logs

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Filter function to hide GoTrue logs and excessive XrozenAI logs
const shouldHideLog = (message: any) => {
  const messageStr = String(message);
  return (
    messageStr.includes('GoTrueClient') ||
    messageStr.includes('#_acquireLock') ||
    messageStr.includes('#_useSession') ||
    messageStr.includes('#__loadSession') ||
    messageStr.includes('#_autoRefreshTokenTick') ||
    messageStr.includes('#getSession()') ||
    messageStr.includes('session from storage') ||
    messageStr.includes('no session') ||
    messageStr.includes('lock acquired') ||
    messageStr.includes('lock released') ||
    messageStr.includes('INITIAL_SESSION callback') ||
    messageStr.includes('XrozenAI - Render check') ||
    messageStr.includes('XrozenAI - Component mounted') ||
    messageStr.includes('XrozenAI - Auth check result') ||
    messageStr.includes('XrozenAI - Realtime subscriptions disabled')
  );
};

// Override console.log
console.log = (...args: any[]) => {
  if (!shouldHideLog(args[0])) {
    originalConsoleLog.apply(console, args);
  }
};

// Override console.warn
console.warn = (...args: any[]) => {
  if (!shouldHideLog(args[0])) {
    originalConsoleWarn.apply(console, args);
  }
};

// Override console.error
console.error = (...args: any[]) => {
  if (!shouldHideLog(args[0])) {
    originalConsoleError.apply(console, args);
  }
};

console.log('🔇 GoTrue logs have been silenced');
