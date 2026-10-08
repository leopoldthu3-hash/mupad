// Diagnostic, not a passing regression suite: executes the original app's runtime seam.
import {loadPyodide} from '../www/pyodide/pyodide.mjs';
const py = await loadPyodide({indexURL: new URL('../www/pyodide/', import.meta.url).pathname});
let stdout = '', stderr = '';
py.setStdout({batched: text => stdout += `${text}\n`});
py.setStderr({batched: text => stderr += `${text}\n`});
py.setStdin({stdin: () => null});
async function probe(label, code) {
  stdout = ''; stderr = '';
  try { await py.runPythonAsync(code); console.log(JSON.stringify({label,stdout,stderr})); }
  catch (e) { console.log(JSON.stringify({label,stdout,stderr,error:e.message})); }
}
await probe('main metadata', 'print(__name__); print(__file__)');
await probe('workspace import absent', 'import helper');
await probe('state leaks', 'leaked = 123');
await probe('next run sees leaked globals', 'print(leaked)');
await probe('partial output before exception', 'print("before", end=""); raise ValueError("boom")');
await probe('stdin unavailable', 'input("Name? ")');
let ticked = false;
py.registerJsModule('timer_probe', {schedule: () => { setTimeout(() => { ticked = true; }, 0); }, didTick: () => ticked});
await py.runPythonAsync('import time, timer_probe; timer_probe.schedule(); t = time.monotonic()\nwhile time.monotonic() - t < 0.25: pass\nprint(timer_probe.didTick())');
console.log(JSON.stringify({label:'runPythonAsync blocks timer during CPU-bound code',stdout,ticked}));
