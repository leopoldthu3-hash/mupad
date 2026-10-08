import {cp, mkdir, rm} from "node:fs/promises";

await rm("www/pyodide", {recursive: true, force: true});
await mkdir("www/pyodide", {recursive: true});
for (const file of ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  await cp(`node_modules/pyodide/${file}`, `www/pyodide/${file}`);
}
await cp("core.mjs", "www/core.mjs");
console.log("Bundled the local Python runtime into www/pyodide.");
