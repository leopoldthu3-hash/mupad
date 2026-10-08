import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.mjs';
test('stored workspace repairs missing active file and rejects malformed records without crashing',()=>{
 const restored=core.restoreWorkspace({activeFile:'missing.py',files:[{name:'useful.py',content:'print(7)'},{name:'../bad.py',content:'bad'},{name:'wrong.py',content:99}]});
 assert.equal(restored.activeFile,'useful.py');
 assert.deepEqual(restored.files,[{name:'useful.py',content:'print(7)'}]);
 assert.equal(core.restoreWorkspace(null).activeFile,'main.py');
});

test('import preserves Unicode code and refuses accidental overwrite',()=>{
 let w=core.importFile(core.createWorkspace(),'hello.py','print("æøå")');
 assert.equal(w.activeFile,'hello.py');
 assert.equal(w.files[1].content,'print("æøå")');
 assert.throws(()=>core.importFile(w,'hello.py','new'),/already exists/i);
 w=core.importFile(w,'hello.py','new',{overwrite:true});
 assert.equal(w.files[1].content,'new');
});
