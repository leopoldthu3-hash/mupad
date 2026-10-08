class MuPadViewController: CAPBridgeViewController, WKScriptMessageHandler {
 override func capacitorDidLoad() {
  super.capacitorDidLoad()
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
