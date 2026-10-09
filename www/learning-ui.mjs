// Keep learner code in its own namespace and preserve its filename in tracebacks.
// A fresh marker is written only AFTER every assertion passes, never in finally.
export function gradingProgram(code,filename,checks,marker){
 const source=JSON.stringify(code),name=JSON.stringify('/workspace/'+filename),tests=JSON.stringify(Array.isArray(checks)?checks.join('\n'):checks);
 return `import sys as _sys, io as _io, types as _types
_original = _sys.stdout
_original_main = _sys.modules['__main__']
_capture = _io.StringIO()
class _Tee:
    def write(self, text):
        _capture.write(text)
        return _original.write(text)
    def flush(self):
        _original.flush()
    def __getattr__(self, name):
        return getattr(_original, name)
_student_main = _types.ModuleType('__main__')
_student_main.__file__ = ${name}
_student_main.__package__ = None
_namespace = _student_main.__dict__
try:
    _sys.modules['__main__'] = _student_main
    _sys.stdout = _Tee()
    try:
        exec(compile(${source}, ${name}, 'exec'), _namespace)
    finally:
        _sys.stdout = _original
    _namespace["__mupad_output"] = _capture.getvalue()
    exec(compile(${tests}, '<exercise checks>', 'exec'), _namespace)
    _original.write(${JSON.stringify(marker)})
    _original.flush()
finally:
    _sys.modules['__main__'] = _original_main
`;
}
export function showErrorHelp(error=''){
 const tips={SyntaxError:'Check punctuation: matching quotes and brackets, and a colon after if, for, while or def. Start with the line number in the traceback.',IndentationError:'Check indentation. Use four spaces inside a block; Indent and Outdent can help. Do not mix tabs and spaces.',NameError:'Check spelling and capitalization. Create a variable before using it, and put literal text in quotes.',TypeError:'Check the types of your values. Text and numbers behave differently; use str(number) or int(text) when appropriate.',ValueError:'Check the value before conversion. For example, int("hello") cannot make a number. input() always returns text.',ZeroDivisionError:'The divisor is zero. Check its value or use an if statement before dividing.',ModuleNotFoundError:'That module is not available. Check its spelling, use an included Python standard-library module, or open the matching .py helper file in your workspace.'};
 const matches=[...String(error).matchAll(/^(SyntaxError|IndentationError|NameError|TypeError|ValueError|ZeroDivisionError|ModuleNotFoundError)(?::|$)/gm)];
 const name=matches.at(-1)?.[1],el=$('#errorHelp');el.hidden=!name;el.textContent=name?`${name} · ${tips[name]} The full Python traceback is kept above.`:'';
}
const KEY='mupad-learning-v1';
const $=s=>document.querySelector(s);
function node(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
export async function createLearningUI({getWorkspace,loadExercise,onCheck,message}){
 let catalog;
 try{catalog=await import(new URL('./learning-catalog.mjs',import.meta.url).href);}catch{message('Learning courses could not load. Your editor still works; try reopening the app.');return null;}
 const {courses,findLesson}=catalog;
 let saved;try{saved=JSON.parse(localStorage.getItem(KEY));}catch{}
 const state={completed:Array.isArray(saved?.completed)?saved.completed.filter(id=>findLesson(id)):[],selected:saved?.selected||null};
 let preview=null,busy=false,hintCount=0,dockKey=null;
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{message('Learning progress could not be saved. Export your code to keep a backup.');}}
 function current(){const s=state.selected;return s&&findLesson(s.lessonId)?{...s,lesson:findLesson(s.lessonId)}:null;}
 function sync(){
  const selected=current(),dock=$('#exerciseDock');dock.hidden=!selected;
  if(!selected)return;
  const key=selected.lessonId+':'+selected.filename;
  if(key!==dockKey){dockKey=key;hintCount=0;$('#exerciseHints').replaceChildren();$('#exerciseSolution').hidden=true;$('#solutionConfirmation').hidden=true;$('#exerciseDock details').open=true;}
  $('#nextHint').disabled=hintCount>=selected.lesson.task.hints.length;
  $('#exerciseTitle').textContent=selected.lesson.title;
  $('#exercisePrompt').textContent=selected.lesson.task.prompt;
  const bound=getWorkspace().activeFile===selected.filename;
  $('#exerciseBinding').textContent=bound?`Exercise file: ${selected.filename}`:`Switch to ${selected.filename} to check this exercise.`;
  $('#checkSolution').disabled=!bound||busy;
 }
 function renderCourses(){
  $('#courseList').replaceChildren();
  for(const course of courses){
   const section=node('section',undefined,'course-card');section.append(node('h3',`${course.title} · ${course.level}`),node('p',course.description));
   for(const lesson of course.lessons){const b=node('button',`${state.completed.includes(lesson.id)?'✓ ':''}${lesson.title}`);b.type='button';b.dataset.lesson=lesson.id;b.addEventListener('click',()=>showLesson(lesson));section.append(b);}
   $('#courseList').append(section);
  }
  $('#learningProgress').textContent=`${state.completed.length} of ${courses.reduce((n,c)=>n+c.lessons.length,0)} exercises completed`;
 }
 function showLesson(lesson){preview=lesson;$('#lessonPreview').hidden=false;$('#lessonTitle').textContent=lesson.title;$('#lessonExplanation').textContent=lesson.explanation;$('#lessonExample').textContent=lesson.example;$('#lessonTask').textContent=lesson.task.prompt;$('#lessonPreview').scrollIntoView({block:'nearest'});}
 $('#learnButton').addEventListener('click',()=>{renderCourses();$('#learningDialog').showModal();});
 $('#closeLearning').addEventListener('click',()=>$('#learningDialog').close());
 $('#loadExercise').addEventListener('click',()=>{
  if(!preview)return;
  const filename=loadExercise(preview);
  state.selected={lessonId:preview.id,filename};persist();$('#exerciseFeedback').textContent='Try the task, then check your solution. Run is always available for experimenting.';sync();$('#learningDialog').close();
 });
 $('#nextHint').addEventListener('click',()=>{const hint=current()?.lesson.task.hints[hintCount];if(hint!==undefined){hintCount++;$('#exerciseHints').append(node('li',hint));sync();}});
 $('#revealSolution').addEventListener('click',()=>{$('#solutionConfirmation').hidden=false;$('#confirmSolution').focus();});
 $('#cancelSolution').addEventListener('click',()=>{$('#solutionConfirmation').hidden=true;$('#revealSolution').focus();});
 $('#confirmSolution').addEventListener('click',()=>{$('#exerciseSolution').textContent=current()?.lesson.task.solution||'';$('#exerciseSolution').hidden=false;$('#solutionConfirmation').hidden=true;$('#exerciseSolution').focus();});
 $('#resetProgress').addEventListener('click',()=>{if(window.confirm('Reset all completed exercises? Your Python files and current exercise will not be deleted.')){state.completed=[];persist();renderCourses();}});
 $('#checkSolution').addEventListener('click',()=>{const selected=current();if(selected&&getWorkspace().activeFile===selected.filename)onCheck(selected);});
 if(state.selected&&!getWorkspace().files.some(f=>f.name===state.selected.filename)){state.selected=null;persist();}
 sync();
 return {sync,current,state,persist,renameFile:(oldName,newName)=>{
  if(state.selected?.filename===oldName&&oldName!==newName){state.selected={...state.selected,filename:newName};persist();}
 },setBusy:value=>{busy=value;sync();},feedback:text=>{$('#exerciseFeedback').textContent=text;},complete:selected=>{
  if(!state.completed.includes(selected.lessonId))state.completed.push(selected.lessonId);persist();
 }};
}
