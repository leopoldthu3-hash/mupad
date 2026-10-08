import test from 'node:test';
import assert from 'node:assert/strict';
import {PythonRunner} from '../www/python-runner.mjs';
const files=[{name:'main.py',content:'print(1)'}];
test('worker creation failure returns a visible error and does not leave running state',async()=>{
 const r=new PythonRunner({workerFactory:()=>{throw new Error('Worker unavailable')}});
 const result=await r.run({files,filename:'main.py'});
 assert.equal(result.status,'error');assert.match(result.error,/Worker unavailable/);assert.equal(r.active,null);
});
test('hung interpreter initialization times out and releases worker',async()=>{
 let terminated=false;
 const r=new PythonRunner({bootTimeoutMs:30,workerFactory:()=>({postMessage(){},terminate(){terminated=true;}})});
 const result=await r.run({files,filename:'main.py'});
 assert.equal(result.status,'error');assert.match(result.error,/load.*timed out/i);assert.equal(terminated,true);
});
