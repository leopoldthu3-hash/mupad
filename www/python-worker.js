import {loadPyodide} from './pyodide/pyodide.mjs';
import {pyodideIndexURL} from './runtime-path.mjs';
const directory = new URL('./pyodide/', import.meta.url);
const python = loadPyodide({indexURL:pyodideIndexURL(directory)});
const pendingInputs = new Map();
let inputSequence = 0;
self.onmessage = async ({data}) => {
  if (data.type === 'input-response') {
    const resolve = pendingInputs.get(data.id);
    pendingInputs.delete(data.id);
    resolve?.({eof:data.value === null, value:data.value ?? ''});
    return;
  }
  if (data.type !== 'run') return;
  const py = await python;
  let stdout = '', stderr = '';
  const inputLines = [...data.stdin];
  py.setStdin({stdin:() => {
    if(inputLines.length)return inputLines.shift();
    if(!data.interactiveInput)return null;
    const prompt=stdout.slice(stdout.lastIndexOf('\n')+1);
    if(data.nativeInput){
      const request=new XMLHttpRequest();
      request.open('GET',typeof data.nativeInput==='string'?data.nativeInput+'?prompt='+encodeURIComponent(prompt):new URL('/__mupad_input__?prompt='+encodeURIComponent(prompt),self.location.href).href,false);
      request.send();
      if(request.status!==200)throw new Error('Native Python input bridge failed');
      return JSON.parse(request.responseText).value;
    }
    if(typeof SharedArrayBuffer==='undefined')throw new Error('Interactive input needs the native iPad bridge. Supply lines in Program input instead.');
    const buffer=new SharedArrayBuffer(65544),control=new Int32Array(buffer,0,2);
    const id=`${data.runId}:${++inputSequence}`;
    self.postMessage({type:'input',id,prompt,buffer});
    Atomics.wait(control,0,0);
    if(Atomics.load(control,0)===2)return null;
    return new TextDecoder().decode(new Uint8Array(buffer,8,Atomics.load(control,1)).slice());
  }, isatty:false});
  const emit = (stream, text) => {
    if (!text) return;
    const prior = stream === 'stdout' ? stdout : stderr;
    if(prior.length >= 1000000)return;
    text=text.slice(0,1000000-prior.length);
    if (stream === 'stdout') stdout += text; else stderr += text;
    self.postMessage({type:'output',stream,text});
  };
  const decoders = {stdout:new TextDecoder(),stderr:new TextDecoder()};
  for (const stream of ['stdout', 'stderr']) {
    py[stream === 'stdout' ? 'setStdout' : 'setStderr']({write:buffer => {
      emit(stream, decoders[stream].decode(buffer, {stream:true})); return buffer.length;
    }});
  }
  const requestInput = prompt => new Promise(resolve => {
    const id = `${data.runId}:${++inputSequence}`;
    pendingInputs.set(id, resolve);
    self.postMessage({type:'input',id,prompt});
  });
  py.registerJsModule('_mupad_host', {emit, requestInput});
  py.runPython(`
import sys, io, _mupad_host
class _MuPadOutput(io.TextIOBase):
    def __init__(self, stream, original):
        self._stream = stream
        self._original = original
        self.buffer = original.buffer
    @property
    def encoding(self): return 'utf-8'
    @property
    def errors(self): return 'strict'
    def writable(self): return True
    def write(self, text):
        if not isinstance(text, str): raise TypeError('write() argument must be str')
        _mupad_host.emit(self._stream, text)
        return len(text)
    def flush(self): self._original.flush()
    def fileno(self): return self._original.fileno()
sys.stdout = _MuPadOutput('stdout', sys.stdout)
sys.stderr = _MuPadOutput('stderr', sys.stderr)
`);
  try {
    py.FS.mkdirTree('/workspace');
    for (const file of data.files) {
      const path = `/workspace/${file.name}`;
      py.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
      py.FS.writeFile(path, file.content, {encoding:'utf8'});
    }
    const filename = `/workspace/${data.filename}`;
    py.FS.chdir('/workspace');
    const namespace = py.runPython(`
import sys, types, ast, inspect, traceback
async def _mupad_async_input(prompt=''):
    prompt = str(prompt)
    sys.stdout.write(prompt)
    result = await _mupad_host.requestInput(prompt)
    if result.eof: raise EOFError('EOF when reading a line')
    return str(result.value).removesuffix('\\n').removesuffix('\\r')
_mupad_api = types.ModuleType('mupad')
_mupad_api.async_input = _mupad_async_input
sys.modules['mupad'] = _mupad_api
async def _mupad_execute(source, filename, namespace):
    try:
        code = compile(source, filename, 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
        value = eval(code, namespace)
        if inspect.isawaitable(value): await value
        return None
    except BaseException as error:
        return ''.join(traceback.format_exception(type(error), error, error.__traceback__.tb_next))
sys.path.insert(0, '/workspace')
sys.path.insert(0, ${JSON.stringify(filename.slice(0, filename.lastIndexOf('/')))})
_mupad_main = types.ModuleType('__main__')
_mupad_main.__file__ = ${JSON.stringify(filename)}
_mupad_main.__package__ = None
sys.modules['__main__'] = _mupad_main
_mupad_main.__dict__
`);
    let error;
    try { error = await py.runPythonAsync(`await _mupad_execute(${JSON.stringify(data.code)}, ${JSON.stringify(filename)}, _mupad_main.__dict__)`); }
    finally { namespace.destroy(); }
    self.postMessage({type:'done',status:error ? 'error' : 'success',stdout,stderr,error});
  } catch(error) {
    self.postMessage({type:'done',status:'error',stdout,stderr,error:error.message});
  }
};
python.then(() => self.postMessage({type:'ready'})).catch(error => self.postMessage({type:'done',status:'error',stdout:'',stderr:'',error:error.message}));
