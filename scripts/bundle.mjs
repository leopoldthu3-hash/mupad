import {cp,mkdir,rm,readFile,readdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
await rm('www/pyodide',{recursive:true,force:true});
await mkdir('www/pyodide',{recursive:true});
for(const file of ['pyodide.mjs','pyodide.asm.mjs','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json'])await cp(`node_modules/pyodide/${file}`,`www/pyodide/${file}`);
await cp('core.mjs','www/core.mjs');
await build({entryPoints:['www/app.js'],outfile:'www/app.bundle.js',bundle:true,format:'esm',target:'safari17',minify:true,external:['./python-runner.mjs'],metafile:true}).then(async ({metafile})=>{
 const packages=new Set(['@capacitor/core']);
 for(const input of Object.keys(metafile.inputs)){
  const match=input.match(/^node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
  if(match)packages.add(match[1]);
 }
 let notices=await readFile('THIRD_PARTY_NOTICES.md','utf8');
 for(const name of [...packages].sort()){
  const root=`node_modules/${name}`;
  const info=JSON.parse(await readFile(`${root}/package.json`,'utf8'));
  const license=(await readdir(root)).find(file=>/^licen[cs]e(?:\..*)?$/i.test(file));
  if(!license)throw new Error(`No license text found for bundled dependency ${name}`);
  notices+=`\n\n--- ${name} ${info.version} (${info.license}) ---\n`+await readFile(`${root}/${license}`,'utf8');
 }
 for(const file of ['LICENSE','licenses/pyodide-MPL-2.0.txt','licenses/CPython-3.14.2.txt'])notices+=`\n\n--- ${file} ---\n`+await readFile(file,'utf8');
 await writeFile('www/third-party-notices.txt',notices);
});
console.log('Bundled offline editor and Python runtime.');
