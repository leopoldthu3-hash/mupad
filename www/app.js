import {EditorState} from '@codemirror/state';
import {EditorView,lineNumbers,highlightActiveLine,highlightActiveLineGutter,keymap,drawSelection} from '@codemirror/view';
import {history,historyKeymap,defaultKeymap,indentWithTab,indentMore,indentLess,undo,redo} from '@codemirror/commands';
import {python} from '@codemirror/lang-python';
import {indentUnit,indentOnInput,syntaxHighlighting,defaultHighlightStyle,bracketMatching} from '@codemirror/language';
import {searchKeymap,highlightSelectionMatches,openSearchPanel} from '@codemirror/search';
import {closeBrackets,closeBracketsKeymap,autocompletion,completionKeymap} from '@codemirror/autocomplete';
import {Capacitor} from '@capacitor/core';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {createWorkspace,restoreWorkspace,createFile,renameFile,saveFile,importFile} from './core.mjs';
import {PythonRunner} from './python-runner.mjs';
import {createLearningUI,gradingProgram,showErrorHelp} from './learning-ui.mjs';
let learning=null,checkMarker=null;
const $=selector=>document.querySelector(selector),STORAGE_KEY='mupad-workspace-v1';
let workspace=loadWorkspace(),inputRequest=null,transcript='',frame=null,dialogAction='new',messageTimer;
const editorStates=new Map();
function loadWorkspace(){try{return restoreWorkspace(JSON.parse(localStorage.getItem(STORAGE_KEY)));}catch{return createWorkspace();}}
function message(text){$('#message').textContent=text;$('#message').hidden=false;clearTimeout(messageTimer);messageTimer=setTimeout(()=>$('#message').hidden=true,7000);}
function persist(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(workspace));$('#saveStatus').textContent='Saved in app';return true;}
 catch{$('#saveStatus').textContent='NOT SAVED · export a backup';message('App storage is unavailable or full. Your current code is still in the editor. Use Export .py to keep a copy.');return false;}
}
const theme=EditorView.theme({
 '&':{color:'#e6edf7',backgroundColor:'#0c1320'},'.cm-gutters':{backgroundColor:'#111d2d',color:'#91a5bf',border:'none'},'.cm-activeLineGutter':{backgroundColor:'#243d55'},'.cm-activeLine':{backgroundColor:'#142439'},'.cm-cursor':{borderLeftColor:'#7be4b2'},'&.cm-focused .cm-selectionBackground,.cm-selectionBackground,::selection':{backgroundColor:'#294863'},'.cm-panels':{backgroundColor:'#142439',color:'#e6edf7'},'.cm-searchMatch':{backgroundColor:'#886c2388'},'.cm-searchMatch-selected':{backgroundColor:'#b58442'},'.cm-tooltip':{backgroundColor:'#192b40',borderColor:'#42607c'}
},{dark:true});
function makeState(content){return EditorState.create({doc:content,extensions:[
 lineNumbers(),highlightActiveLine(),highlightActiveLineGutter(),drawSelection(),history(),python(),indentUnit.of('    '),indentOnInput(),syntaxHighlighting(defaultHighlightStyle),bracketMatching(),closeBrackets(),autocompletion(),highlightSelectionMatches(),theme,
 EditorView.contentAttributes.of({'aria-label':'Python code',spellcheck:'false',autocorrect:'off',autocapitalize:'off'}),
 keymap.of([{key:'Mod-s',run:()=>{saveEditor();return true;}},{key:'F5',run:()=>{runCode();return true;}},{key:'Shift-F5',run:()=>runner.stop()} ,...closeBracketsKeymap,indentWithTab,...defaultKeymap,...historyKeymap,...searchKeymap,...completionKeymap]),
 EditorView.updateListener.of(update=>{if(update.docChanged)saveEditor();if(update.selectionSet||update.docChanged)updateCursor();})
]});}
const view=new EditorView({state:makeState(workspace.files.find(f=>f.name===workspace.activeFile).content),parent:$('#editorHost')});
function updateCursor(){const pos=view.state.selection.main.head,line=view.state.doc.lineAt(pos);$('#cursorStatus').textContent=`Ln ${line.number}, Col ${pos-line.from+1}`;}
function saveEditor(){workspace=saveFile(workspace,workspace.activeFile,view.state.doc.toString());persist();}
function renderFiles(){
 $('#fileList').replaceChildren(...workspace.files.map(file=>{
  const b=document.createElement('button');b.type='button';b.className='file'+(file.name===workspace.activeFile?' active':'');b.textContent=file.name;b.title=file.name;b.setAttribute('aria-current',file.name===workspace.activeFile?'page':'false');
  b.addEventListener('click',()=>{if(file.name===workspace.activeFile)return;saveEditor();editorStates.set(workspace.activeFile,view.state);workspace.activeFile=file.name;persist();showActive();});return b;
 }));
}
function showActive(){const f=workspace.files.find(f=>f.name===workspace.activeFile);$('#activeName').textContent=f.name;view.setState(editorStates.get(f.name)||makeState(f.content));updateCursor();renderFiles();learning?.sync();}
function showOutput(){frame=null;$('#output').textContent=transcript;$('#output').scrollTop=$('#output').scrollHeight;}
function append(text){transcript=(transcript+text).slice(-1000000);if(!frame)frame=requestAnimationFrame(showOutput);}
const runner=new PythonRunner({
 onState:state=>{
  learning?.setBusy(state!=='idle');
  $('#runButton').disabled=state!=='idle';$('#stopButton').disabled=state==='idle';
  $('#runtimeStatus').textContent=state==='loading'?'Loading local Python…':state==='running'?'Python running locally':'Local Python · ready';
  if(state==='idle'){$('#inputForm').hidden=true;inputRequest=null;if(window.__MUPAD_STDIN_URL__)fetch(window.__MUPAD_STDIN_URL__+'?cancel=1').catch(()=>{});}
 },
 onOutput:({text})=>append(checkMarker?text.replaceAll(checkMarker,''):text),
 onInput:request=>{inputRequest=request;$('#inputForm').hidden=false;$('#inputPrompt').textContent=request.prompt||'Python input';$('#stdinValue').value='';$('#stdinValue').focus();}
});
async function runCode(selected=null){
 if(runner.active)return;
 if(selected&&workspace.activeFile!==selected.filename)return;
 saveEditor();transcript='';showOutput();showErrorHelp();$('#output').classList.remove('error');$('#runMeta').textContent='Starting…';
 const lines=$('#inputLines').value,filename=workspace.activeFile,source=view.state.doc.toString();
 const files=workspace.files.map(f=>({...f}));let runFilename=filename;
 checkMarker=selected?`__MUPAD_PASS_${crypto.randomUUID()}__`:null;
 if(selected){
  learning.feedback('Checking your solution with Python…');
  runFilename=`__mupad_check_${crypto.randomUUID().replaceAll('-','')}.py`;
  files.push({name:runFilename,content:gradingProgram(source,filename,selected.lesson.task.checks,checkMarker)});
 }
 try{
  const result=await runner.run({files,filename:runFilename,stdin:selected?.lesson.task.stdin??(lines?lines.replace(/\r\n?/g,'\n').split('\n'):[]),interactiveInput:true,nativeInput:Capacitor.getPlatform()==='ios'?(window.__MUPAD_STDIN_URL__||true):false});
  showErrorHelp(result.error||'');
  if(result.error){if(transcript&&!transcript.endsWith('\n'))append('\n');append(result.error);$('#output').classList.add('error');}
  if(!transcript&&result.status==='success')append('Program finished with no output.');
  $('#runMeta').textContent=`${result.status==='stopped'?'Stopped':result.status==='error'?'Error':'Finished'} · ${Math.round(result.elapsedMs)} ms`;
  if(selected){
   const unchanged=workspace.activeFile===filename&&view.state.doc.toString()===source&&learning.current()?.filename===filename&&learning.current()?.lessonId===selected.lessonId;
   if(!unchanged)learning.feedback('The file or exercise changed while checking. Check the current exercise again; progress was not changed.');
   else if(result.status==='success'&&result.stdout.endsWith(checkMarker)){learning.complete(selected);learning.feedback('Passed! Your solution met every check. Progress saved. Keep experimenting or choose another lesson.');}
   else learning.feedback(result.status==='stopped'?'Check stopped. No progress was awarded. Try again when you are ready.':'Not passed yet. Read the console feedback, try a hint, and check again. Your code is safe.');
  }
 }catch(error){append(error.message);$('#output').classList.add('error');$('#runMeta').textContent='Could not run';if(selected)learning.feedback('Could not check this time. No progress was awarded. Try again.');}
 finally{checkMarker=null;}
}
$('#runButton').addEventListener('click',()=>runCode());$('#stopButton').addEventListener('click',()=>runner.stop());$('#saveButton').addEventListener('click',saveEditor);
$('#guideButton').addEventListener('click',()=>$('#guideDialog').showModal());
$('#closeGuide').addEventListener('click',()=>$('#guideDialog').close());
function focusConsole(expanded){
 $('.app-shell').classList.toggle('console-focus',expanded);
 $('#consoleExpand').setAttribute('aria-expanded',String(expanded));
 $('#consoleExpand').setAttribute('aria-label',expanded?'Collapse console':'Expand console');
 $('#consoleExpand').textContent=expanded?'Back to editor':'Full screen';
 view.requestMeasure();
 (expanded?$('#output'):$('#consoleExpand')).focus({preventScroll:true});
}
$('#consoleExpand').addEventListener('click',()=>focusConsole(!$('.app-shell').classList.contains('console-focus')));
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&$('.app-shell').classList.contains('console-focus')&&!document.querySelector('dialog[open]')){event.preventDefault();focusConsole(false);}
});
$('#clearOutput').addEventListener('click',()=>{transcript='';showOutput();$('#output').classList.remove('error');});
$('#inputForm').addEventListener('submit',e=>{e.preventDefault();if(!inputRequest)return;try{runner.respondInput(inputRequest.id,$('#stdinValue').value);$('#inputForm').hidden=true;inputRequest=null;}catch(error){message(error.message);}});
$('#eofButton').addEventListener('click',()=>{if(inputRequest)runner.respondInput(inputRequest.id,null);inputRequest=null;$('#inputForm').hidden=true;});
function nameDialog(action){dialogAction=action;$('#nameTitle').textContent=action==='new'?'New Python file':'Rename Python file';$('#nameValue').value=action==='new'?'untitled.py':workspace.activeFile;$('#nameError').textContent='';$('#nameDialog').showModal();$('#nameValue').select();}
$('#newFileButton').addEventListener('click',()=>nameDialog('new'));$('#renameButton').addEventListener('click',()=>nameDialog('rename'));$('#nameCancel').addEventListener('click',()=>$('#nameDialog').close());
$('#nameForm').addEventListener('submit',e=>{
 e.preventDefault();try{
  saveEditor();editorStates.set(workspace.activeFile,view.state);
  const old=workspace.activeFile;
  workspace=dialogAction==='new'?createFile(workspace,$('#nameValue').value):renameFile(workspace,old,$('#nameValue').value);
  if(dialogAction==='rename'&&editorStates.has(old)){editorStates.set(workspace.activeFile,editorStates.get(old));if(old!==workspace.activeFile)editorStates.delete(old);}
  persist();if(dialogAction==='rename')learning?.renameFile(old,workspace.activeFile);showActive();$('#nameDialog').close();view.focus();
 }catch(error){$('#nameError').textContent=error.message;}
});
$('#openButton').addEventListener('click',()=>$('#filePicker').click());
$('#filePicker').addEventListener('change',async e=>{
 for(const file of e.target.files){
  try{
   if(!file.name.toLowerCase().endsWith('.py'))throw new Error('Open a Python .py file.');
   if(file.size>2000000)throw new Error('That file is too large (maximum 2 MB).');
   const content=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()).replace(/^\uFEFF/,'');
   saveEditor();editorStates.set(workspace.activeFile,view.state);
   const exists=workspace.files.some(f=>f.name===file.name);
   if(exists&&!window.confirm(`Replace ${file.name} in this workspace?`))continue;
   workspace=importFile(workspace,file.name,content,{overwrite:exists});editorStates.delete(workspace.activeFile);persist();showActive();
  }catch(error){message(error.message);}
 }
 e.target.value='';
});
$('#exportButton').addEventListener('click',async()=>{
 saveEditor();const f=workspace.files.find(f=>f.name===workspace.activeFile);
 try{
  if(Capacitor.isNativePlatform()){
   const saved=await Filesystem.writeFile({path:f.name,data:f.content,directory:Directory.Cache,encoding:Encoding.UTF8});
   await Share.share({title:f.name,url:saved.uri,dialogTitle:'Save Python file'});
  }else{
   const url=URL.createObjectURL(new Blob([f.content],{type:'text/x-python;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=f.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
 }catch(error){message(`Could not export: ${error.message}`);}
});
$('#findButton').addEventListener('click',()=>openSearchPanel(view));
for(const [id,command] of [['indentButton',indentMore],['outdentButton',indentLess],['undoButton',undo],['redoButton',redo]]){$('#'+id).addEventListener('click',()=>{command(view);view.focus();});}
let fontSize=16;
function zoom(delta){fontSize=Math.max(12,Math.min(28,fontSize+delta));document.documentElement.style.setProperty('--editor-size',fontSize+'px');}
$('#zoomIn').addEventListener('click',()=>zoom(1));$('#zoomOut').addEventListener('click',()=>zoom(-1));
window.addEventListener('pagehide',()=>{saveEditor();runner.stop();});
if(window.visualViewport){const adjust=()=>{document.querySelector('.app-shell').style.height=window.visualViewport.height+'px';};window.visualViewport.addEventListener('resize',adjust);adjust();}
$('#activeName').textContent=workspace.activeFile;renderFiles();updateCursor();
learning=await createLearningUI({getWorkspace:()=>workspace,message,onCheck:selected=>runCode(selected),loadExercise:lesson=>{
 saveEditor();editorStates.set(workspace.activeFile,view.state);
 const base='exercise_'+lesson.id.replace(/[^A-Za-z0-9_]/g,'_');let name=base+'.py',suffix=2;
 while(workspace.files.some(f=>f.name===name))name=`${base}_${suffix++}.py`;
 workspace=saveFile(createFile(workspace,name),name,lesson.task.starter);persist();showActive();view.focus();return name;
}});
if(window.__MUPAD_SELFTEST__)import('./native-selftest.js');
