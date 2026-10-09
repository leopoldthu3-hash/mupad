import {readFile,writeFile,copyFile} from 'node:fs/promises';
const root='node_modules/@capacitor/ios/Capacitor/Capacitor/';
const path=root+'WebViewAssetHandler.swift';
let source=await readFile(path,'utf8');
if(!source.includes('muPadHandleRequest')){
 source=source.replace('import WebKit','import WebKit\nimport UIKit');
 source=source.replace('private var router: Router','private var muPadInputAlerts: [ObjectIdentifier: UIAlertController] = [:]\n    private var router: Router');
 source=source.replace('open func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {','open func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {\n        if muPadHandleRequest(webView, task: urlSchemeTask) { return }');
 source=source.replace('urlSchemeTask.stopped = true','urlSchemeTask.stopped = true\n        muPadInputAlerts.removeValue(forKey: ObjectIdentifier(urlSchemeTask as AnyObject))?.dismiss(animated: true)');
 source=source.replace('open func mimeTypeForExtension(pathExtension: String) -> String {','open func mimeTypeForExtension(pathExtension: String) -> String {\n        if pathExtension == "mjs" { return "text/javascript" }');
 source+='\n'+await readFile('native/input-handler.swift','utf8');
 await writeFile(path,source);
}
const app='ios/App/App/';
await copyFile('docs/images/mupad-app-icon.png',app+'Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
let delegate=await readFile(app+'AppDelegate.swift','utf8');
delegate=delegate.split('\nimport Network')[0].split('\nclass MuPadViewController:')[0];
if(!delegate.includes('import WebKit'))delegate=delegate.replace('import Capacitor','import Capacitor\nimport WebKit');
delegate+='\n'+await readFile('native/http-stdin.swift','utf8')+'\n'+await readFile('native/controller.swift','utf8');
await writeFile(app+'AppDelegate.swift',delegate);
await writeFile('www/native-diagnostics.js',await readFile('native/diagnostics.js','utf8'));
await writeFile(app+'public/native-diagnostics.js',await readFile('native/diagnostics.js','utf8'));
try{
 let scene=await readFile(app+'SceneDelegate.swift','utf8');
 await writeFile(app+'SceneDelegate.swift',scene.replaceAll('CAPBridgeViewController()','MuPadViewController()'));
}catch(e){if(e.code!=='ENOENT')throw e;}
const storyboard=app+'Base.lproj/Main.storyboard';
let xml=await readFile(storyboard,'utf8');
xml=xml.replace('customClass="CAPBridgeViewController" customModule="Capacitor"','customClass="MuPadViewController" customModule="App"');
await writeFile(storyboard,xml);
const infoPath=app+'Info.plist';
let info=await readFile(infoPath,'utf8');
if(!info.includes('NSAllowsLocalNetworking'))info=info.replace('<key>LSRequiresIPhoneOS</key>','<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>\n\t<key>LSRequiresIPhoneOS</key>');
await writeFile(infoPath,info);
const project='ios/App/App.xcodeproj/project.pbxproj';
let pbx=await readFile(project,'utf8');
const version=JSON.parse(await readFile('package.json','utf8')).version;
await writeFile(project,pbx.replaceAll('IPHONEOS_DEPLOYMENT_TARGET = 15.0;','IPHONEOS_DEPLOYMENT_TARGET = 17.0;').replace(/MARKETING_VERSION = [^;]+;/g,`MARKETING_VERSION = ${version};`).replace(/CURRENT_PROJECT_VERSION = [^;]+;/g,'CURRENT_PROJECT_VERSION = 3;'));
console.log('Prepared reproducible native stdin bridge, module MIME fix, and iOS 17 minimum.');
