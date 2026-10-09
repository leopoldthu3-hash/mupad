import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const SENTINEL = 'print("MuPad restart storage ✓")';

export async function runRuntimeSelftest(window, {phase, app}) {
  const wc = window.webContents;
  const evaluate = script => wc.executeJavaScript(script, true);
  async function wait(script, label, timeout = 90000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(script)) return;
      await delay(50);
    }
    throw new Error(`Timed out: ${label}. UI: ${await evaluate('document.body.innerText')}`);
  }
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  async function code(text) {
    const before = await editorText();
    window.focus();
    wc.focus();
    await evaluate(`document.querySelector('[aria-label="Python code"]').focus()`);
    const modifiers = [process.platform === 'darwin' ? 'meta' : 'control'];
    // CodeMirror owns the selection. Native menu selectAll() can race its
    // selectionchange observer; use its actual keyboard command and read back.
    wc.sendInputEvent({type:'keyDown',keyCode:'A',modifiers});
    wc.sendInputEvent({type:'keyUp',keyCode:'A',modifiers});
    await wait(`document.getSelection().toString() === ${JSON.stringify(before)}`, 'editor selected all existing code before replacement', 10000);
    await wc.insertText(text);
    await wait(`(()=>{const workspace=JSON.parse(localStorage.getItem('mupad-workspace-v1'));return workspace.files.find(file=>file.name===workspace.activeFile)?.content===${JSON.stringify(text)};})()`, 'active editor file saved actual text', 10000);
    assert.equal(await editorText(), text, 'native text insertion changed the real CodeMirror document');
  }
  async function run(text) { await code(text); await click('#runButton'); }
  const editorText = () => evaluate(`Array.from(document.querySelectorAll('[aria-label="Python code"] .cm-line'),line=>line.textContent).join('\\n')`);
  const progress = () => evaluate(`JSON.parse(localStorage.getItem('mupad-learning-v1'))`);
  async function openCourses(catalog, completed) {
    await click('#learnButton');
    await wait(`document.querySelector('#learningDialog').open`, 'real courses dialog opened', 10000);
    const visible = await evaluate(`({
      ids:Array.from(document.querySelectorAll('#courseList button[data-lesson]'),button=>button.dataset.lesson),
      courses:document.querySelectorAll('#courseList .course-card').length,
      progress:document.querySelector('#learningProgress').textContent,
      completed:Array.from(document.querySelectorAll('#courseList button[data-lesson]')).filter(button=>button.textContent.startsWith('✓ ')).map(button=>button.dataset.lesson)
    })`);
    assert.equal(visible.courses, 6, 'all six production courses are rendered');
    assert.deepEqual(visible.ids, catalog.ids, 'all 36 production lesson buttons are rendered in order');
    assert.equal(visible.progress, `${completed.length} of 36 exercises completed`);
    assert.deepEqual(visible.completed, completed, 'only verified lessons have completion ticks');
  }
  async function previewFirst(catalog) {
    await click(`#courseList button[data-lesson="${catalog.first.id}"]`);
    assert.deepEqual(await evaluate(`({title:document.querySelector('#lessonTitle').textContent,prompt:document.querySelector('#lessonTask').textContent,hidden:document.querySelector('#lessonPreview').hidden})`),
      {title:catalog.first.title,prompt:catalog.first.task.prompt,hidden:false}, 'preview contains the actual production lesson');
  }
  async function checkAnswer(expected) {
    assert.equal(await evaluate(`document.querySelector('#checkSolution').disabled`), false, 'exercise is bound to the active file and ready to check');
    await click('#checkSolution');
    await wait(`document.querySelector('#exerciseFeedback').textContent.startsWith(${JSON.stringify(expected)}) && !document.querySelector('#checkSolution').disabled`, `real Python grading: ${expected}`);
  }
  async function consoleSnapshot() {
    return {code:await editorText(),output:await evaluate(`document.querySelector('#output').textContent`),workspace:await evaluate(`localStorage.getItem('mupad-workspace-v1')`)};
  }
  async function expandConsole() {
    const before = await consoleSnapshot();
    await click('#consoleExpand');
    await wait(`document.querySelector('.app-shell').classList.contains('console-focus') && document.querySelector('.console').getBoundingClientRect().height >= innerHeight * 0.8`, 'expanded console occupies at least 80% of the viewport', 10000);
    const geometry = await evaluate(`(()=>{
      const box=document.querySelector('.console').getBoundingClientRect();
      return {width:box.width,height:box.height,viewportWidth:innerWidth,viewportHeight:innerHeight,top:box.top,bottom:box.bottom,nativeFullscreen:!!document.fullscreenElement};
    })()`);
    assert.ok(geometry.height >= geometry.viewportHeight * 0.8, 'expanded console is not just a renamed button');
    assert.ok(geometry.width >= geometry.viewportWidth * 0.8, 'expanded console spans the app');
    assert.ok(geometry.top >= -1 && geometry.bottom <= geometry.viewportHeight + 1, 'console remains inside the viewport');
    assert.equal(geometry.nativeFullscreen, false, 'console focus does not depend on the native fullscreen API');
    assert.equal(window.isFullScreen(), false, 'Electron window stays out of native fullscreen');
    assert.equal(await evaluate(`document.querySelector('#consoleExpand').getAttribute('aria-expanded')`), 'true');
    assert.equal(await evaluate(`document.querySelector('.workspace').getBoundingClientRect().height`), 0, 'editor is hidden while console is expanded');
    for (const selector of ['#runButton','#stopButton','#consoleExpand']) {
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().height > 0`), true, `${selector} remains visible in console focus`);
    }
    assert.deepEqual(await consoleSnapshot(), before, 'expansion preserves code, output and saved workspace');
    return geometry;
  }
  async function collapseConsole() {
    const before = await consoleSnapshot();
    await click('#consoleExpand');
    await wait(`!document.querySelector('.app-shell').classList.contains('console-focus') && document.querySelector('.workspace').getBoundingClientRect().height > 0`, 'console collapses back to the editor', 10000);
    assert.equal(await evaluate(`document.querySelector('#consoleExpand').getAttribute('aria-expanded')`), 'false');
    assert.deepEqual(await consoleSnapshot(), before, 'collapse preserves code, output and saved workspace');
  }
  await wait(`!!document.querySelector('[aria-label="Python code"]')`, 'bundled editor loaded');
  const environment = await evaluate(`({origin:location.origin,isolated:crossOriginIsolated,secure:isSecureContext,sab:typeof SharedArrayBuffer,node:typeof process,require:typeof require})`);
  assert.deepEqual(environment, {origin:'mupad-desktop://app',isolated:true,secure:true,sab:'function',node:'undefined',require:'undefined'});
  const preferences = wc.getLastWebPreferences();
  assert.equal(preferences.sandbox,true);
  assert.equal(preferences.contextIsolation,true);
  assert.equal(preferences.nodeIntegration,false);
  assert.equal(preferences.webSecurity,true);
  assert.ok(!app.commandLine.hasSwitch('no-sandbox'), 'Chromium sandbox must be enabled');
  assert.equal(await evaluate(`window.open('https://example.com/') === null`), true);
  assert.equal(await evaluate(`fetch('https://example.com/').then(()=>false,()=>true)`),true);
  assert.equal(await evaluate(`new Promise(resolve=>navigator.geolocation.getCurrentPosition(()=>resolve(false),error=>resolve(error.code===1),{timeout:10000}))`),true);
  await evaluate(`location.href='https://example.com/'`);
  await delay(150);
  assert.equal(wc.getURL(),'mupad-desktop://app/','remote navigation must not replace the editor');
  const workerIsolation = await evaluate(`new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob(['postMessage({isolated:crossOriginIsolated,sab:typeof SharedArrayBuffer})'],{type:'text/javascript'}));const worker=new Worker(url);worker.onmessage=e=>{worker.terminate();URL.revokeObjectURL(url);resolve(e.data)};worker.onerror=e=>reject(new Error(e.message))})`);
  assert.deepEqual(workerIsolation,{isolated:true,sab:'function'});
  // Import the shipped asset through the renderer's real custom protocol, not a
  // Node fixture or a replacement catalog/runner. Missing packaging fails here.
  const catalog = await evaluate(`import(new URL('./learning-catalog.mjs',location.href).href).then(({courses})=>({courseSizes:courses.map(course=>course.lessons.length),ids:courses.flatMap(course=>course.lessons.map(lesson=>lesson.id)),first:courses[0].lessons[0]}))`);
  assert.deepEqual(catalog.courseSizes, [6,6,6,6,6,6], 'production curriculum has six courses of six lessons');
  assert.equal(new Set(catalog.ids).size, 36, 'lesson identities are unique');
  assert.equal(catalog.first.id, 'hello-output', 'use the production introductory exercise');
  for (const selector of ['#guideButton','#guideDialog','#closeGuide','#consoleExpand','#errorHelp']) {
    assert.equal(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), true, `packaged UI includes ${selector}`);
  }
  const guideBefore = await consoleSnapshot();
  await click('#guideButton');
  await wait(`document.querySelector('#guideDialog').open`, 'help guide opened', 10000);
  const guideTopics = ['print("Hello, MuPad!")','Run','input()','Stop','Export .py'];
  const guideText = await evaluate(`document.querySelector('#guideDialog').textContent`);
  for (const topic of guideTopics) assert.ok(guideText.includes(topic), `guide explains ${topic}`);
  await click('#closeGuide');
  assert.equal(await evaluate(`document.querySelector('#guideDialog').open`), false, 'guide can be closed');
  assert.deepEqual(await consoleSnapshot(), guideBefore, 'guide preserves the learner workspace and output');
  const guide = {topics:guideTopics,closed:true,preservedWorkspace:true};
  if (phase === 'restore') {
    assert.equal(await editorText(), SENTINEL, 'saved program restored after a full process restart');
    const restored = await progress();
    assert.deepEqual(restored.completed, [catalog.first.id], 'only the verified lesson survives restart');
    assert.equal(restored.selected.lessonId, catalog.first.id);
    assert.equal(await evaluate(`document.querySelector('#activeName').textContent`), restored.selected.filename);
    assert.equal(await evaluate(`document.querySelector('#exerciseDock').hidden`), false, 'exercise selection is restored');
    assert.equal(await evaluate(`document.querySelector('#exerciseTitle').textContent`), catalog.first.title);
    await click('#runButton');
    await wait(`document.querySelector('#output').textContent === 'MuPad restart storage ✓\\n' && document.querySelector('#runMeta').textContent.startsWith('Finished')`, 'saved program after full process restart');
    assert.deepEqual((await progress()).completed, [catalog.first.id], 'ordinary Run does not change verified progress');
    await openCourses(catalog, [catalog.first.id]);
    await previewFirst(catalog);
    await click('#closeLearning');
    assert.equal(await editorText(), SENTINEL, 'reopening a completed lesson does not overwrite restored code');
    assert.deepEqual(await progress(), restored, 'reopening the lesson preserves saved selection and completion');
    return {phase,environment,workerIsolation,guide,persistence:true,learning:{courseCount:6,lessonCount:36,lessonId:catalog.first.id,completed:restored.completed,progressPersisted:true,reopened:true,sentinelPreserved:true},packaged:app.isPackaged,version:app.getVersion(),electron:process.versions.electron};
  }
  await run('import sys, json\nprint(json.dumps([i*i for i in range(4)]))\nprint("Python", sys.version)\nprint("Hello", input("Name: "))\nprint("Blank", repr(input("Blank: ")))');
  await wait(`!document.querySelector('#inputForm').hidden && document.querySelector('#output').textContent.includes('Name: ')`, 'real synchronous Python input() prompt');
  const consoleFocus = await expandConsole();
  assert.equal(await evaluate(`document.querySelector('#inputForm').getBoundingClientRect().height > 0`), true, 'live stdin remains visible in expanded console');
  await evaluate(`document.querySelector('#stdinValue').value='Ada🙂';document.querySelector('#inputForm').requestSubmit()`);
  await wait(`!document.querySelector('#inputForm').hidden && document.querySelector('#inputPrompt').textContent==='Blank: '`, 'second input prompt');
  await evaluate(`document.querySelector('#stdinValue').value='';document.querySelector('#inputForm').requestSubmit()`);
  await wait(`document.querySelector('#runMeta').textContent.startsWith('Finished') && document.querySelector('#output').textContent.includes("Blank: Blank ''")`, 'Python input program finished and final stdout rendered');
  const pythonOutput = await evaluate(`document.querySelector('#output').textContent`);
  assert.match(pythonOutput,/\[0, 1, 4, 9\]/);
  assert.match(pythonOutput,/Python 3\./);
  assert.match(pythonOutput,/Hello Ada🙂/);
  assert.match(pythonOutput,/Blank: Blank ''/);
  await collapseConsole();
  await run('try:\n    input("EOF: ")\nexcept EOFError:\n    print("EOF handled")');
  await wait(`!document.querySelector('#inputForm').hidden && document.querySelector('#output').textContent.includes('EOF: ')`, 'EOF input prompt');
  await expandConsole();
  await click('#eofButton');
  await wait(`document.querySelector('#runMeta').textContent.startsWith('Finished') && document.querySelector('#output').textContent.includes('EOF handled')`, 'Python EOF in expanded console');
  await collapseConsole();
  await run('print("spinning")\nwhile True: pass');
  await wait(`document.querySelector('#output').textContent.includes('spinning')`, 'real infinite Python loop');
  await expandConsole();
  await click('#stopButton');
  await wait(`document.querySelector('#runMeta').textContent.startsWith('Stopped')`, 'Stop terminates Python worker in expanded console', 10000);
  await collapseConsole();
  await run('print("restarted")');
  await wait(`document.querySelector('#runMeta').textContent.startsWith('Finished') && document.querySelector('#output').textContent==='restarted\\n'`, 'Python works after stop');
  await run('print("unfinished"');
  await wait(`document.querySelector('#runMeta').textContent.startsWith('Error') && document.querySelector('#output').textContent.includes('SyntaxError') && !document.querySelector('#errorHelp').hidden`, 'real Python traceback with beginner error help');
  assert.match(await evaluate(`document.querySelector('#output').textContent`), /Traceback|File .*\.py/);
  assert.match(await evaluate(`document.querySelector('#errorHelp').textContent`), /SyntaxError.*punctuation/);

  await openCourses(catalog, []);
  await previewFirst(catalog);
  const draft = await consoleSnapshot();
  await click('#loadExercise');
  await wait(`!document.querySelector('#learningDialog').open && !document.querySelector('#exerciseDock').hidden && !document.querySelector('#checkSolution').disabled`, 'production exercise loaded in its own file', 10000);
  const selected = await progress();
  assert.deepEqual(selected.completed, [], 'loading an exercise awards no progress');
  assert.equal(selected.selected.lessonId, catalog.first.id);
  assert.equal(await editorText(), catalog.first.task.starter, 'loaded starter is the production lesson, not a stub');
  const workspace = await evaluate(`JSON.parse(localStorage.getItem('mupad-workspace-v1'))`);
  assert.equal(workspace.activeFile, selected.selected.filename);
  assert.notEqual(workspace.activeFile, JSON.parse(draft.workspace).activeFile, 'lesson opens a separate Python file');
  assert.ok(workspace.files.some(file=>file.name===JSON.parse(draft.workspace).activeFile && file.content===draft.code), 'loading a lesson keeps the previous draft');

  // A newline is executable blank Python and exercises native CodeMirror editing
  // without depending on whether Chromium treats insertText('') as a deletion.
  await code('\n');
  await checkAnswer('Not passed');
  await wait(`document.querySelector('#runMeta').textContent.startsWith('Error') && document.querySelector('#output').textContent.includes('AssertionError')`, 'blank answer rejected by actual Python assertions');
  assert.deepEqual((await progress()).completed, [], 'blank answers never complete lessons');
  await code('print("not the required greeting")');
  await checkAnswer('Not passed');
  await wait(`document.querySelector('#output').textContent.includes('not the required greeting') && document.querySelector('#output').textContent.includes('AssertionError')`, 'failed grading preserves stdout and the real assertion traceback');
  assert.deepEqual((await progress()).completed, [], 'incorrect executable answers never complete lessons');
  await code(catalog.first.task.solution);
  await checkAnswer('Passed!');
  await wait(`document.querySelector('#runMeta').textContent.startsWith('Finished') && document.querySelector('#output').textContent === 'Hello, Python!\\nI can write code.\\n'`, 'production solution runs and keeps its exact stdout without a private grading marker');
  assert.equal(await evaluate(`document.querySelector('#errorHelp').hidden`), true, 'a successful check clears old beginner error help');
  assert.deepEqual((await progress()).completed, [catalog.first.id], 'only real passing checks award progress');
  await checkAnswer('Passed!');
  assert.deepEqual((await progress()).completed, [catalog.first.id], 'rechecking a passed lesson cannot duplicate progress');
  await openCourses(catalog, [catalog.first.id]);
  await click('#closeLearning');
  await code(SENTINEL);
  assert.deepEqual((await progress()).completed, [catalog.first.id], 'editing the restart sentinel preserves verified progress');
  const learning = {courseCount:6,lessonCount:36,lessonId:catalog.first.id,emptyRejected:true,wrongRejected:true,passed:true,idempotent:true,completed:[catalog.first.id]};
  return {phase,environment,workerIsolation,guide,consoleFocus:{...consoleFocus,preservedCodeAndOutput:true,input:true,eof:true,stop:true,collapsed:true},learning,errorHelp:true,pythonOutput,input:true,blankInput:true,eof:true,stop:true,rerun:true,packaged:app.isPackaged,version:app.getVersion(),electron:process.versions.electron};
}
