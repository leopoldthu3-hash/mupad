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
 await check('unchanged nested input() over native same-origin worker stdin',async()=>{
  const result=await runner.run({filename:'main.py',files:[{name:'main.py',content:'def ask():\n    return input("Name: ")\nprint("Hello", ask())'}],interactiveInput:true,nativeInput:true});
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
 report({status:'passed',results});
}catch(error){report({status:'failed',results,error:String(error.stack||error)});}
