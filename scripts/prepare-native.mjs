import {readFile,writeFile} from 'node:fs/promises';
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
let delegate=await readFile(app+'AppDelegate.swift','utf8');
if(!delegate.includes('class MuPadViewController')){
 delegate=delegate.replace('import Capacitor','import Capacitor\nimport WebKit');
 delegate+='\nclass MuPadViewController: CAPBridgeViewController {\n override func capacitorDidLoad() {\n  super.capacitorDidLoad()\n  if ProcessInfo.processInfo.arguments.contains("--mupad-selftest") {\n   webView?.configuration.userContentController.addUserScript(WKUserScript(source: "window.__MUPAD_SELFTEST__ = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))\n  }\n }\n}\n';
 await writeFile(app+'AppDelegate.swift',delegate);
}
try{
 let scene=await readFile(app+'SceneDelegate.swift','utf8');
 await writeFile(app+'SceneDelegate.swift',scene.replaceAll('CAPBridgeViewController()','MuPadViewController()'));
}catch(e){if(e.code!=='ENOENT')throw e;}
const storyboard=app+'Base.lproj/Main.storyboard';
let xml=await readFile(storyboard,'utf8');
xml=xml.replace('customClass="CAPBridgeViewController" customModule="Capacitor"','customClass="MuPadViewController" customModule="App"');
await writeFile(storyboard,xml);
const project='ios/App/App.xcodeproj/project.pbxproj';
let pbx=await readFile(project,'utf8');
await writeFile(project,pbx.replaceAll('IPHONEOS_DEPLOYMENT_TARGET = 15.0;','IPHONEOS_DEPLOYMENT_TARGET = 17.0;').replaceAll('MARKETING_VERSION = 1.0;','MARKETING_VERSION = 0.2.0;').replaceAll('CURRENT_PROJECT_VERSION = 1;','CURRENT_PROJECT_VERSION = 2;'));
console.log('Prepared reproducible native stdin bridge, module MIME fix, and iOS 17 minimum.');
