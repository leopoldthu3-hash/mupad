class MuPadViewController: CAPBridgeViewController, WKScriptMessageHandler {
 private var stdinServer: MuPadStdinServer?
 private var inputAlert: UIAlertController?
 private var inputCompletion: ((String?)->Void)?
 override func capacitorDidLoad() {
  super.capacitorDidLoad()
  do {
   let server=try MuPadStdinServer();stdinServer=server
   server.onReady={ [weak self] url in
    let literal=String(data:try! JSONSerialization.data(withJSONObject:[url]),encoding:.utf8)!
    let script="window.__MUPAD_STDIN_URL__ = \(literal)[0];"
    self?.webView?.configuration.userContentController.addUserScript(WKUserScript(source:script,injectionTime:.atDocumentStart,forMainFrameOnly:true))
    self?.webView?.evaluateJavaScript(script)
   }
   server.onInput={ [weak self] prompt,completion in
    guard let self=self else{completion(nil);return}
    let alert=UIAlertController(title:"Python input",message:String(prompt.suffix(300)),preferredStyle:.alert)
    alert.addTextField{field in field.autocapitalizationType = .none;field.autocorrectionType = .no}
    self.inputAlert=alert;self.inputCompletion=completion
    let finish:(String?)->Void={ [weak self] value in
     self?.inputCompletion=nil;self?.inputAlert=nil;completion(value)
    }
    alert.addAction(UIAlertAction(title:"Send",style:.default){[weak alert] _ in finish(alert?.textFields?.first?.text ?? "")})
    alert.addAction(UIAlertAction(title:"EOF / Cancel",style:.cancel){_ in finish(nil)})
    self.present(alert,animated:true){
     if ProcessInfo.processInfo.arguments.contains("--mupad-selftest"){
      alert.textFields?.first?.text="Ada🙂"
      alert.dismiss(animated:false){finish(alert.textFields?.first?.text ?? "")}
     }
    }
   }
   server.onCancel={ [weak self] in
    self?.inputAlert?.dismiss(animated:false);self?.inputAlert=nil
    self?.inputCompletion?(nil);self?.inputCompletion=nil
   }
   server.start()
  }catch{NSLog("MUPAD stdin-server failure %@",String(describing:error))}
  if ProcessInfo.processInfo.arguments.contains("--mupad-selftest") {
   NSLog("MUPAD controller-ready")
   webView?.configuration.userContentController.add(self, name: "mupadDiagnostics")
   let file = Bundle.main.url(forResource: "native-diagnostics", withExtension: "js", subdirectory: "public")!
   let script = (try? String(contentsOf: file, encoding: .utf8)) ?? ""
   webView?.configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
  }
 }
 func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
  guard message.name == "mupadDiagnostics", let text = message.body as? String else { return }
  NSLog("MUPAD %@", text)
  let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
  try? (text+"\n").appendToMuPadFile(folder.appendingPathComponent("MuPad-checkpoints.jsonl"))
  try? text.write(to: folder.appendingPathComponent("MuPad-selftest.json"), atomically: true, encoding: .utf8)
 }
}
private extension String {
 func appendToMuPadFile(_ url: URL) throws {
  let data=Data(self.utf8)
  if !FileManager.default.fileExists(atPath: url.path) { try data.write(to: url); return }
  let file=try FileHandle(forWritingTo: url)
  defer {try? file.close()}
  try file.seekToEnd();try file.write(contentsOf: data)
 }
}
