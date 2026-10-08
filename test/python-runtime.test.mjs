import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
const runnerURL = new URL('../www/python-runner.mjs', import.meta.url);
const workerURL = new URL('../www/python-worker.js', import.meta.url);
function workerFactory(url) {
  const worker = new Worker(new URL('./python-worker-node.mjs', import.meta.url), {workerData: {url: url.href}});
  const adapter = {postMessage: value => worker.postMessage(value), terminate: () => worker.terminate()};
  worker.on('message', data => adapter.onmessage?.({data}));
  worker.on('error', error => adapter.onerror?.(error));
  return adapter;
}
async function runner(options = {}) {
  assert.ok(existsSync(runnerURL), 'Dedicated PythonRunner runtime module must exist');
  const {PythonRunner} = await import(runnerURL);
  return new PythonRunner({workerURL, workerFactory, ...options});
}
const workspace = code => ({filename:'main.py', files:[{name:'main.py',content:code}]});
test('workspace files are importable/readable with real main metadata and a clean namespace', {timeout:30000}, async t => {
  const r = await runner(); t.after(() => r.dispose());
  let result = await r.run({filename:'main.py', files:[
    {name:'main.py', content:'import helper, __main__\nprint(__name__, __file__, __main__.__file__)\nprint(helper.answer, open("helper.py").read())\nleaked = 123'},
    {name:'helper.py',content:'answer = 42'},
  ]});
  assert.equal(result.status, 'success', result.error);
  assert.equal(result.stdout, '__main__ /workspace/main.py /workspace/main.py\n42 answer = 42\n');
  result = await r.run(workspace('print("leaked" in globals())\nimport helper'));
  assert.equal(result.stdout, 'False\n');
  assert.match(result.error, /ModuleNotFoundError/);
});
test('streams exact stdout/stderr fragments and preserves partial stdout on Python errors', {timeout:30000}, async t => {
  const events = [];
  const r = await runner({onOutput:event => events.push(event)}); t.after(() => r.dispose());
  const result = await r.run(workspace('import sys\nprint("hé🙂", end="")\nsys.stderr.write("warn")\nraise ValueError("boom")'));
  assert.equal(result.stdout, 'hé🙂');
  assert.equal(result.stderr, 'warn');
  assert.equal(result.status, 'error');
  assert.match(result.error, /File "\/workspace\/main.py", line 4/);
  assert.match(result.error, /ValueError: boom/);
  assert.equal(events.filter(e => e.stream === 'stdout').map(e => e.text).join(''), result.stdout);
  assert.equal(events.filter(e => e.stream === 'stderr').map(e => e.text).join(''), result.stderr);
});
test('live output arrives while an infinite loop runs; main thread can stop and restart', {timeout:30000}, async t => {
  let sawOutput;
  const output = new Promise(resolve => { sawOutput = resolve; });
  const r = await runner({onOutput:({text}) => { if (text.includes('spinning')) sawOutput(); }});
  t.after(() => r.dispose());
  const execution = r.run(workspace('print("spinning", end="")\nwhile True: pass'));
  await output;
  await new Promise(resolve => setTimeout(resolve, 30)); // Main thread must still respond.
  const started = performance.now();
  assert.equal(r.stop(), true);
  const result = await execution;
  assert.equal(result.status, 'stopped');
  assert.equal(result.stdout, 'spinning');
  assert.ok(performance.now() - started < 1000, 'Stop must not wait for Python to yield');
  assert.equal(r.stop(), false);
  const restarted = await r.run(workspace('print("restarted")'));
  assert.equal(restarted.status, 'success');
  assert.equal(restarted.stdout, 'restarted\n');
});
test('standard input() consumes supplied lines and reaches honest EOF', {timeout:30000}, async t => {
  const r = await runner(); t.after(() => r.dispose());
  const result = await r.run({...workspace('print(input("Name? "))\nprint(repr(input()))\ninput("Again? ")'), stdin:['Ada🙂', '']});
  assert.equal(result.stdout, "Name? Ada🙂\n''\nAgain? ");
  assert.equal(result.status, 'error');
  assert.match(result.error, /EOFError/);
});
test('async_input awaits real UI responses without blocking, including blank/Unicode/EOF', {timeout:30000}, async t => {
  const requests = [];
  const answers = ['Ada🙂', '', null];
  const r = await runner({onInput:request => {
    requests.push(request);
    setTimeout(() => { assert.equal(r.respondInput(request.id, answers.shift()), true); }, 20);
  }}); t.after(() => r.dispose());
  const result = await r.run(workspace('from mupad import async_input\nprint(await async_input("Name? "))\nprint(repr(await async_input("Empty? ")))\nawait async_input("EOF? ")'));
  assert.equal(result.stdout, "Name? Ada🙂\nEmpty? ''\nEOF? ");
  assert.equal(result.status, 'error');
  assert.match(result.error, /EOFError/);
  assert.deepEqual(requests.map(r => r.prompt), ['Name? ', 'Empty? ', 'EOF? ']);
  assert.equal(r.respondInput(requests[0].id, 'stale'), false);
});
test('rejects workspace path traversal and duplicate paths before starting Python', async t => {
  const r = await runner(); t.after(() => r.dispose());
  await assert.rejects(r.run({filename:'../outside.py',files:[{name:'../outside.py',content:'print(1)'}]}), /relative workspace path/);
  await assert.rejects(r.run({filename:'main.py',files:[{name:'main.py',content:''},{name:'main.py',content:''}]}), /Duplicate/);
});
test('standard input() accepts interactive UI replies in ordinary nested Python functions', {timeout:30000}, async t => {
  const prompts=[];
  const r=await runner({onInput:request=>{prompts.push(request.prompt);setTimeout(()=>r.respondInput(request.id,'Ada🙂'),15);}});
  t.after(()=>r.dispose());
  const result=await r.run({...workspace('def ask():\n    return input("Your name: ")\nprint("Hello", ask())'), interactiveInput:true});
  assert.equal(result.status,'success',result.error);
  assert.equal(result.stdout,'Your name: Hello Ada🙂\n');
  assert.deepEqual(prompts,['Your name: ']);
});

test('executes real local Python in a worker', {timeout:30000}, async t => {
  const r = await runner(); t.after(() => r.dispose());
  const result = await r.run(workspace('import sys\nprint(sys.version_info.major, sys.version_info.minor)\nprint(sum(i*i for i in range(10)))'));
  assert.equal(result.status, 'success');
  assert.equal(result.stdout, '3 14\n285\n');
});
