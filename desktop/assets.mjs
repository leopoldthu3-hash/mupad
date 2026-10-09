import {readFile, realpath, stat} from 'node:fs/promises';
import path from 'node:path';

export const SCHEME = 'mupad-desktop';
export const APP_URL = `${SCHEME}://app/`;
const mime = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.wasm':'application/wasm', '.json':'application/json; charset=utf-8',
  '.zip':'application/zip', '.png':'image/png', '.svg':'image/svg+xml',
  '.txt':'text/plain; charset=utf-8',
};
export const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy':'same-origin',
  'Cross-Origin-Embedder-Policy':'require-corp',
  'Cross-Origin-Resource-Policy':'same-origin',
  'X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
};

export function createAssetHandler(root) {
  const fail = status => new Response(status === 403 ? 'Forbidden' : status === 405 ? 'Method not allowed' : 'Not found', {status, headers:ISOLATION_HEADERS});
  return async ({url, method = 'GET'}) => {
    if (!['GET','HEAD'].includes(method)) return fail(405);
    let filename;
    try {
      // Inspect raw segments before WHATWG URL parsing normalizes dot traversal.
      const match = /^mupad-desktop:\/\/app(\/[^?#]*)?(?:[?#].*)?$/.exec(url);
      if (!match) return fail(403);
      const pathname = decodeURIComponent(match[1] || '/');
      if (/[\\\\\u0000]/.test(pathname) || /%(?:2e|2f|5c|00)/i.test(pathname)) return fail(403);
      const segments = pathname.split('/');
      if (segments.some(part => part === '..' || part === '.')) return fail(403);
      filename = pathname === '/' ? 'index.html' : pathname.slice(1);
      // realpath additionally prevents symlinks from escaping the asset directory.
      const canonicalRoot = await realpath(root);
      const target = await realpath(path.resolve(canonicalRoot, filename));
      const relative = path.relative(canonicalRoot, target);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return fail(403);
      if (!(await stat(target)).isFile()) return fail(404);
      const bytes = method === 'HEAD' ? null : await readFile(target);
      return new Response(bytes, {headers:{...ISOLATION_HEADERS,'Content-Type':mime[path.extname(filename).toLowerCase()] || 'application/octet-stream'}});
    } catch (error) {
      return fail(error instanceof URIError ? 403 : 404);
    }
  };
}
