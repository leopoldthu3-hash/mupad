// Same-origin synchronous worker stdin. The UI thread stays responsive while Python waits.
extension WebViewAssetHandler {
    private func muPadReply(_ task: WKURLSchemeTask, object: [String: Any]) {
        guard !task.stopped, let url = task.request.url,
              let data = try? JSONSerialization.data(withJSONObject: object),
              let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json", "Cache-Control": "no-store"]) else { return }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }
    private func muPadHandleRequest(_ webView: WKWebView, task: WKURLSchemeTask) -> Bool {
        guard let url = task.request.url else { return false }
        if url.path == "/__mupad_test_result__", ProcessInfo.processInfo.arguments.contains("--mupad-selftest") {
            let result = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "result" })?.value ?? "{}"
            let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            try? result.write(to: folder.appendingPathComponent("MuPad-selftest.json"), atomically: true, encoding: .utf8)
            muPadReply(task, object: ["saved": true])
            return true
        }
        guard url.path == "/__mupad_input__" else { return false }
        NSLog("MUPAD native-stdin request %@", url.absoluteString)
        let prompt = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "prompt" })?.value ?? "Python input"
        if ProcessInfo.processInfo.arguments.contains("--mupad-selftest") {
            muPadReply(task, object: ["value": "Ada🙂"])
            return true
        }
        DispatchQueue.main.async { [weak self, weak webView] in
            guard let self = self, !task.stopped else { return }
            guard var presenter = webView?.window?.rootViewController else {
                self.muPadReply(task, object: ["value": NSNull()])
                return
            }
            while let presented = presenter.presentedViewController { presenter = presented }
            let key = ObjectIdentifier(task as AnyObject)
            let alert = UIAlertController(title: "Python input", message: String(prompt.suffix(300)), preferredStyle: .alert)
            alert.addTextField { field in
                field.autocapitalizationType = .none
                field.autocorrectionType = .no
                field.placeholder = "Enter a value"
            }
            alert.addAction(UIAlertAction(title: "Send", style: .default) { [weak self, weak alert] _ in
                self?.muPadInputAlerts.removeValue(forKey: key)
                self?.muPadReply(task, object: ["value": alert?.textFields?.first?.text ?? ""])
            })
            alert.addAction(UIAlertAction(title: "EOF / Cancel", style: .cancel) { [weak self] _ in
                self?.muPadInputAlerts.removeValue(forKey: key)
                self?.muPadReply(task, object: ["value": NSNull()])
            })
            self.muPadInputAlerts[key] = alert
            presenter.present(alert, animated: true)
        }
        return true
    }
}
