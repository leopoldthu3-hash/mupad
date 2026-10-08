import Network

final class MuPadStdinServer {
 private let listener: NWListener
 private let queue=DispatchQueue(label: "MuPad.local-stdin")
 private let nonce=UUID().uuidString
 var onReady: ((String)->Void)?
 var onInput: ((String, @escaping (String?)->Void)->Void)?
 var onCancel: (()->Void)?
 init() throws {
  let parameters=NWParameters.tcp
  parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
  listener=try NWListener(using: parameters)
  listener.stateUpdateHandler={ [weak self] state in
   guard let self=self else{return}
   if case .ready = state, let port=self.listener.port {
    DispatchQueue.main.async {self.onReady?("http://127.0.0.1:\(port.rawValue)/\(self.nonce)")}
   }
  }
  listener.newConnectionHandler={ [weak self] connection in
   guard let self=self else{return}
   connection.start(queue:self.queue);self.read(connection, buffer:Data())
  }
 }
 func start(){listener.start(queue:queue)}
 private func read(_ connection:NWConnection, buffer:Data){
  connection.receive(minimumIncompleteLength:1,maximumLength:8192){[weak self] data,_,ended,error in
   guard let self=self else{connection.cancel();return}
   var buffer=buffer;if let data=data{buffer.append(data)}
   guard buffer.count<=8192,error==nil else{connection.cancel();return}
   if let text=String(data:buffer,encoding:.utf8),text.contains("\r\n\r\n"){
    let parts=text.components(separatedBy:"\r\n")[0].split(separator:" ")
    guard parts.count>=2,let url=URLComponents(string:"http://localhost"+String(parts[1])),url.path=="/"+self.nonce else{connection.cancel();return}
    if parts[0]=="OPTIONS"{self.reply(connection,value:nil);return}
    let prompt=url.queryItems?.first(where:{$0.name=="prompt"})?.value ?? "Python input"
    if url.queryItems?.contains(where:{$0.name=="cancel"})==true{
     DispatchQueue.main.async {self.onCancel?();self.reply(connection,value:nil)};return
    }
    DispatchQueue.main.async {self.onInput?(prompt,{value in self.reply(connection,value:value)})}
   }else if ended{connection.cancel()}else{self.read(connection,buffer:buffer)}
  }
 }
 private func reply(_ connection:NWConnection,value:String?){
  let payload=(try? JSONSerialization.data(withJSONObject:["value":value as Any? ?? NSNull()])) ?? Data()
  var response=Data("HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, OPTIONS\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: \(payload.count)\r\n\r\n".utf8)
  response.append(payload)
  connection.send(content:response,completion:.contentProcessed({_ in connection.cancel()}))
 }
}
