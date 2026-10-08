// Python and its filesystem live in a dedicated worker, never on the UI thread.
export class PythonRunner {
  constructor({workerURL=new URL('./python-worker.js',import.meta.url),workerFactory=url=>new Worker(url,{type:'module'}),onState=()=>{},onOutput=()=>{},onInput=null,bootTimeoutMs=30000}={}) {
    Object.assign(this,{workerURL,workerFactory,onState,onOutput,onInput,bootTimeoutMs});
    this.worker=null;this.active=null;this.sequence=0;this.pendingInputs=new Map();
  }
  run({files,filename,activeFile,stdin=[],interactiveInput=false,nativeInput=false}) {
    if(this.active)return Promise.reject(new Error('Python is already running'));
    if(!Array.isArray(files))return Promise.reject(new Error('Workspace files must be an array'));
    const seen=new Set();
    for(const f of files){
      if(typeof f.name!=='string'||!f.name||f.name.startsWith('/')||f.name.includes('\\')||f.name.split('/').some(p=>!p||p==='.'||p==='..')||typeof f.content!=='string')return Promise.reject(new Error('Use a valid relative workspace path'));
      if(seen.has(f.name))return Promise.reject(new Error('Duplicate workspace path'));seen.add(f.name);
    }
    const name=filename||activeFile,file=files.find(f=>f.name===name);
    if(!file)return Promise.reject(new Error('Active Python file not found'));
    return new Promise(resolve=>{
      const started=performance.now(),runId=++this.sequence;
      this.active={resolve,started,stdout:'',stderr:''};
      this.notify('loading');
      try{
        const worker=this.workerFactory(this.workerURL);this.worker=worker;
        this.bootTimer=setTimeout(()=>this.fail('Python load timed out. Stop and try again.'),this.bootTimeoutMs);
        worker.onmessage=({data})=>{
          if(this.worker!==worker||!this.active)return;
          try{
            if(data.type==='ready'){
              clearTimeout(this.bootTimer);this.notify('running');
              worker.postMessage({type:'run',runId,code:file.content,files,filename:name,stdin,interactiveInput,nativeInput});
            }
            if(data.type==='output'){
              if(!['stdout','stderr'].includes(data.stream))return;
              this.active[data.stream]+=data.text;
              this.onOutput({stream:data.stream,text:data.text});
            }
            if(data.type==='input'){
              this.pendingInputs.set(data.id,data.buffer||null);
              if(this.onInput)this.onInput({id:data.id,prompt:data.prompt});else this.respondInput(data.id,null);
            }
            if(data.type==='done')this.finish({...data,elapsedMs:performance.now()-started});
          }catch(error){this.fail(error.message);}
        };
        worker.onerror=error=>this.fail(error.message||'Python worker failed to start');
        worker.onmessageerror=()=>this.fail('Python worker message could not be read');
      }catch(error){this.fail(error.message);}
    });
  }
  notify(state){try{this.onState(state);}catch(error){console.error('Runtime state callback',error);}}
  respondInput(id,value){
    if(!this.worker||!this.pendingInputs.has(id))return false;
    const buffer=this.pendingInputs.get(id);
    if(buffer){
      const control=new Int32Array(buffer,0,2),bytes=new Uint8Array(buffer,8);
      const encoded=new TextEncoder().encode(value??'');
      if(encoded.length>bytes.length)throw new Error('Input line is too long (maximum 64 KiB)');
      bytes.set(encoded);Atomics.store(control,1,encoded.length);Atomics.store(control,0,value===null?2:1);Atomics.notify(control,0);
    }else this.worker.postMessage({type:'input-response',id,value});
    this.pendingInputs.delete(id);return true;
  }
  fail(error){if(!this.active)return;this.finish({status:'error',stdout:this.active.stdout,stderr:this.active.stderr,error,elapsedMs:performance.now()-this.active.started});}
  finish(result){
    const active=this.active;this.active=null;clearTimeout(this.bootTimer);this.pendingInputs.clear();
    this.worker?.terminate();this.worker=null;this.notify('idle');active?.resolve(result);
  }
  stop(){if(!this.active)return false;this.finish({status:'stopped',stdout:this.active.stdout,stderr:this.active.stderr,error:null,elapsedMs:performance.now()-this.active.started});return true;}
  dispose(){this.stop();}
}
