import {cp,mkdir,rm} from 'node:fs/promises';
import {build} from 'esbuild';
await rm('www/pyodide',{recursive:true,force:true});
await mkdir('www/pyodide',{recursive:true});
for(const file of ['pyodide.mjs','pyodide.asm.mjs','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json'])await cp(`node_modules/pyodide/${file}`,`www/pyodide/${file}`);
await cp('core.mjs','www/core.mjs');
await build({entryPoints:['www/app.js'],outfile:'www/app.bundle.js',bundle:true,format:'esm',target:'safari17',minify:true,external:['./python-runner.mjs']});
console.log('Bundled offline editor and Python runtime.');
