import {APP_URL} from './assets.mjs';

export const WEB_PREFERENCES = Object.freeze({
  nodeIntegration:false,
  nodeIntegrationInWorker:false,
  contextIsolation:true,
  sandbox:true,
  webSecurity:true,
  allowRunningInsecureContent:false,
  webviewTag:false,
  devTools:false,
});

export function isAppNavigation(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'mupad-desktop:' && parsed.host === 'app' &&
      !parsed.username && !parsed.password && !parsed.search &&
      ['/', '/index.html'].includes(parsed.pathname);
  } catch { return false; }
}

export function isAllowedRequest(url) {
  return url.startsWith(APP_URL) || url.startsWith('blob:' + APP_URL);
}
