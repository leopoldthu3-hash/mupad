import {app, BrowserWindow, protocol, session, dialog} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';
import {APP_URL, SCHEME, createAssetHandler} from './assets.mjs';
import {WEB_PREFERENCES, isAppNavigation, isAllowedRequest} from './security.mjs';

// Register before app.ready. Stable standard origin retains localStorage across runs.
protocol.registerSchemesAsPrivileged([{
  scheme:SCHEME,
  privileges:{standard:true,secure:true,corsEnabled:true,supportFetchAPI:true,stream:true,codeCache:true},
}]);
// Never fall back to --no-sandbox: a broken host sandbox is an installation error.
app.enableSandbox();
app.setName('MuPad');
const selftest = process.argv.includes('--mupad-selftest');
const argument = name => process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3);
if (selftest) {
  const profile = argument('mupad-selftest-profile');
  if (!profile || !path.isAbsolute(profile)) throw new Error('Selftest requires an absolute isolated profile');
  app.setPath('userData',profile);
}
let window;

function createWindow() {
  window = new BrowserWindow({
    title:'MuPad',width:1180,height:820,minWidth:720,minHeight:520,
    backgroundColor:'#0c1320',show:false,
    icon:fileURLToPath(new URL('../docs/images/mupad-logo.png',import.meta.url)),
    webPreferences:{...WEB_PREFERENCES},
  });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  for (const event of ['will-navigate','will-frame-navigate','will-redirect']) {
    window.webContents.on(event,(navigation,url)=>{
      if (!isAppNavigation(url ?? navigation.url)) navigation.preventDefault();
    });
  }
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  window.once('ready-to-show',()=>window.show());
  window.on('closed',()=>{window=null;});
  return window;
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.setDevicePermissionHandler(()=>false);
  // Defense in depth: the entire Python runtime is bundled, so no remote network is needed.
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!isAllowedRequest(details.url)}));
  protocol.handle(SCHEME,createAssetHandler(fileURLToPath(new URL('../www/',import.meta.url))));
  const current = createWindow();
  await current.loadURL(APP_URL);
  if (selftest) {
    const report = argument('mupad-selftest-report');
    if (!report || !path.isAbsolute(report)) throw new Error('Selftest requires an absolute report path');
    try {
      const {runRuntimeSelftest} = await import('./runtime-selftest.mjs');
      const result = await runRuntimeSelftest(current,{phase:argument('mupad-selftest-phase'),app});
      // Flush Chromium's DOM storage before testing a complete process restart.
      await session.defaultSession.flushStorageData();
      await mkdir(path.dirname(report),{recursive:true});
      await writeFile(report,JSON.stringify({ok:true,...result},null,2)+'\n');
      console.log('MuPad desktop selftest passed:',JSON.stringify(result));
      app.exit(0);
    } catch (error) {
      await writeFile(report,JSON.stringify({ok:false,error:error.stack},null,2)+'\n');
      console.error(error);
      app.exit(1);
    }
  }
}).catch(error=>{
  console.error(error);
  if (!selftest) dialog.showErrorBox('MuPad could not start',error.message);
  app.exit(1);
});
app.on('window-all-closed',()=>app.quit());
