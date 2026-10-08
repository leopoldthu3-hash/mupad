window.__MUPAD_SELFTEST__=true;
window.__mupadTerminal=false;
window.__mupadReport=function(report){
 if(window.__mupadTerminal)return;
 if(report.status==='passed'||report.status==='failed')window.__mupadTerminal=true;
 window.webkit.messageHandlers.mupadDiagnostics.postMessage(JSON.stringify(report));
};
window.__mupadReport({status:'checkpoint',phase:'document-start',url:location.href});
addEventListener('error',function(e){window.__mupadReport({status:'diagnostic',phase:'javascript-error',message:e.message||'Resource load failed',url:e.filename||e.target?.src||e.target?.href});},true);
addEventListener('unhandledrejection',function(e){window.__mupadReport({status:'failed',phase:'unhandled-rejection',error:String(e.reason?.stack||e.reason)});});
addEventListener('DOMContentLoaded',function(){window.__mupadReport({status:'checkpoint',phase:'dom-ready',editor:!!document.querySelector('.cm-editor')});});
setTimeout(function(){window.__mupadReport({status:'failed',phase:'watchdog',error:'Native self-test did not complete',editor:!!document.querySelector('.cm-editor'),runtime:document.querySelector('#runtimeStatus')?.textContent});},90000);
