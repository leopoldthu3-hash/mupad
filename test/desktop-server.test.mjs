import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const assetModule = () => import('../desktop/assets.mjs');

test('renderer policy is sandboxed and only permits the fixed bundled application origin', async () => {
  const {WEB_PREFERENCES, isAppNavigation, isAllowedRequest} = await import('../desktop/security.mjs');
  assert.equal(WEB_PREFERENCES.nodeIntegration,false);
  assert.equal(WEB_PREFERENCES.nodeIntegrationInWorker,false);
  assert.equal(WEB_PREFERENCES.contextIsolation,true);
  assert.equal(WEB_PREFERENCES.sandbox,true);
  assert.equal(WEB_PREFERENCES.webSecurity,true);
  assert.equal(WEB_PREFERENCES.allowRunningInsecureContent,false);
  for (const url of ['mupad-desktop://app/','mupad-desktop://app/index.html','mupad-desktop://app/#files']) assert.equal(isAppNavigation(url),true,url);
  for (const url of ['https://example.com/','file:///etc/passwd','mupad-desktop://evil/','mupad-desktop://app/pyodide/pyodide.mjs','javascript:alert(1)']) assert.equal(isAppNavigation(url),false,url);
  assert.equal(isAllowedRequest('mupad-desktop://app/pyodide/pyodide.asm.wasm'),true);
  assert.equal(isAllowedRequest('blob:mupad-desktop://app/abc'),true);
  assert.equal(isAllowedRequest('https://cdn.jsdelivr.net/pyodide.js'),false);
  assert.equal(isAllowedRequest('http://127.0.0.1:8000/'),false);
  assert.equal(isAllowedRequest('file:///etc/passwd'),false);
});

test('stable desktop origin serves bundled files with cross-origin isolation and correct MIME', async () => {
  const {createAssetHandler, APP_URL} = await assetModule();
  const root = await mkdtemp(path.join(tmpdir(), 'mupad-assets-'));
  try {
    await writeFile(path.join(root, 'index.html'), '<h1>MuPad</h1>');
    await writeFile(path.join(root, 'worker.mjs'), 'export const ok = true;');
    await writeFile(path.join(root, 'python.wasm'), Buffer.from([0,97,115,109]));
    const serve = createAssetHandler(root);
    assert.equal(APP_URL, 'mupad-desktop://app/');
    const html = await serve({url:APP_URL, method:'GET'});
    assert.equal(html.status, 200);
    assert.equal(await html.text(), '<h1>MuPad</h1>');
    assert.equal(html.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
    assert.equal(html.headers.get('Cross-Origin-Embedder-Policy'), 'require-corp');
    assert.equal(html.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
    assert.equal(html.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.match(html.headers.get('Content-Security-Policy'), /connect-src 'self'/);
    assert.match((await serve({url:APP_URL+'worker.mjs',method:'GET'})).headers.get('content-type'), /javascript/);
    const wasm = await serve({url:APP_URL+'python.wasm',method:'GET'});
    assert.equal(wasm.headers.get('content-type'), 'application/wasm');
    assert.deepEqual(new Uint8Array(await wasm.arrayBuffer()), new Uint8Array([0,97,115,109]));
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('protocol rejects path traversal, foreign origins, invalid encoding and symlink escapes', async () => {
  const {createAssetHandler, APP_URL} = await assetModule();
  const root = await mkdtemp(path.join(tmpdir(), 'mupad-paths-'));
  try {
    const www = path.join(root,'www'); await mkdir(www);
    await writeFile(path.join(root,'secret.txt'),'MUST NOT LEAK');
    await writeFile(path.join(www,'index.html'),'safe');
    const serve = createAssetHandler(www);
    for (const url of [
      APP_URL+'../secret.txt', APP_URL+'%2e%2e/secret.txt',
      APP_URL+'%2e%2e%2fsecret.txt', APP_URL+'..%5csecret.txt',
      APP_URL+'%00', APP_URL+'%ZZ',
      'mupad-desktop://evil/index.html', 'mupad-desktop://app:99/index.html',
      'mupad-desktop://user@app/index.html', 'https://app/index.html',
    ]) {
      const response = await serve({url,method:'GET'});
      assert.equal(response.status,403,url);
      assert.doesNotMatch(await response.text(),/MUST NOT LEAK/);
    }
    // Windows developers may not have symlink privileges; CI still covers this on Linux.
    if (process.platform !== 'win32') {
      await symlink(path.join(root,'secret.txt'),path.join(www,'leak.txt'));
      assert.equal((await serve({url:APP_URL+'leak.txt',method:'GET'})).status,403);
    }
    assert.equal((await serve({url:APP_URL+'absent',method:'GET'})).status,404);
    assert.equal((await serve({url:APP_URL,method:'POST'})).status,405);
    const head = await serve({url:APP_URL,method:'HEAD'});
    assert.equal(head.status,200);
    assert.equal(await head.text(),'');
  } finally { await rm(root,{recursive:true,force:true}); }
});
