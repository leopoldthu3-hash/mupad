import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const args = process.argv.slice(2);
const supplied = args.indexOf('--executable');
const packaged = supplied !== -1;
const executable = packaged ? path.resolve(args[supplied+1]) : (await import('electron')).default;
const reportIndex = args.indexOf('--report');
const reportPath = path.resolve(reportIndex === -1 ? 'desktop-selftest.json' : args[reportIndex+1]);
const requirePackaged = args.includes('--require-packaged');
const root = await mkdtemp(path.join(tmpdir(), 'mupad-desktop-test-'));
const profile = path.join(root,'profile');
const results = [];
try {
  for (const phase of ['exercise','restore']) {
    const report = path.join(root, phase+'.json');
    const launchArgs = [
      ...(packaged ? [] : [fileURLToPath(new URL('./main.mjs',import.meta.url))]),
      '--mupad-selftest', `--mupad-selftest-phase=${phase}`,
      `--mupad-selftest-profile=${profile}`, `--mupad-selftest-report=${report}`,
    ];
    const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
    await new Promise((resolve,reject) => {
      const child = spawn(executable, launchArgs, {env,stdio:'inherit'});
      const timer = setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Electron selftest timeout'));},180000);
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',(code,signal)=>{clearTimeout(timer);code===0 ? resolve() : reject(new Error(`Electron selftest failed: exit ${code}, signal ${signal}`));});
    });
    const result = JSON.parse(await readFile(report,'utf8'));
    assert.equal(result.ok,true);
    assert.equal(result.phase,phase);
    if (requirePackaged) assert.equal(result.packaged,true,'Run the built application, not the development Electron binary');
    results.push(result);
  }
  const evidence = {ok:true,platform:process.platform,arch:process.arch,executable,results};
  await mkdir(path.dirname(reportPath),{recursive:true});
  await writeFile(reportPath,JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
} finally {
  await rm(root,{recursive:true,force:true});
}
