import {PythonRunner} from './python-runner.mjs';
const results=[];
const report=value=>window.__mupadReport(value);
report({status:'checkpoint',phase:'app-initialized'});
async function check(name,action){report({status:'checkpoint',phase:'test-start',name});await action();results.push({name,status:'passed'});report({status:'checkpoint',phase:'test-passed',name});}
const require=(condition,message)=>{if(!condition)throw new Error(message);};
try{
 const runner=new PythonRunner({bootTimeoutMs:45000,onState:state=>report({status:'checkpoint',phase:'runtime-'+state})});
 await check('WKWebView local worker, modules, WASM, standard Python and workspace imports',async()=>{
  const result=await runner.run({filename:'main.py',files:[{name:'main.py',content:'import helper\nprint(__name__, __file__, helper.answer)\nprint(sum(i*i for i in range(5)))'},{name:'helper.py',content:'answer=42'}]});
  require(result.status==='success',result.error);require(result.stdout==='__main__ /workspace/main.py 42\n30\n',result.stdout);
 });
 await check('unchanged nested input() over native loopback worker stdin and native prompt',async()=>{
  const result=await runner.run({filename:'main.py',files:[{name:'main.py',content:'def ask():\n    return input("Name: ")\nprint("Hello", ask())'}],interactiveInput:true,nativeInput:window.__MUPAD_STDIN_URL__||true});
  require(result.status==='success',result.error);require(result.stdout==='Name: Hello Ada🙂\n',result.stdout);
 });
 await check('live output and hard Stop of infinite Python loop, then restart',async()=>{
  let output;const sawOutput=new Promise(resolve=>output=resolve);
  runner.onOutput=({text})=>{if(text.includes('spinning'))output();};
  const execution=runner.run({filename:'main.py',files:[{name:'main.py',content:'print("spinning")\nwhile True: pass'}]});
  await Promise.race([sawOutput,new Promise((_,reject)=>setTimeout(()=>reject(new Error('No live output')),45000))]);
  runner.stop();require((await execution).status==='stopped','Stop failed');
  const result=await runner.run({filename:'main.py',files:[{name:'main.py',content:'print("restarted")'}]});require(result.stdout==='restarted\n',result.error);
 });
 await check('bundled learning courses and real Python exercise grading reject empty answers',async()=>{
  const {courses}=await import('./learning-catalog.mjs');
  const {gradingProgram}=await import('./learning-ui.mjs');
  const lessons=courses.flatMap(course=>course.lessons);
  require(courses.length>=6 && lessons.length>=36,'Learning catalog was not bundled');
  const lesson=lessons[0],marker='NATIVE_LEARNING_CHECK_PASSED';
  const grade=async code=>runner.run({filename:'lesson.py',files:[{name:'lesson.py',content:gradingProgram(code,'lesson.py',lesson.task.checks,marker)}],stdin:lesson.task.stdin||[]});
  const empty=await grade('');require(!empty.stdout.includes(marker),'Empty answer was marked complete');
  const solved=await grade(lesson.task.solution);require(solved.status==='success'&&solved.stdout.includes(marker),solved.error||solved.stdout);
 });
 report({status:'passed',results});
}catch(error){report({status:'failed',results,error:String(error.message||error)+'\n'+String(error.stack||'')});}
