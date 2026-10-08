import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('bundled app carries its open-source dependency notices and interpreter licenses',async()=>{
 const notices=await readFile(new URL('../www/third-party-notices.txt',import.meta.url),'utf8');
 for(const marker of ['@codemirror/view','@capacitor/core','Mozilla Public License','PYTHON SOFTWARE FOUNDATION LICENSE','Permission is hereby granted'])assert.ok(notices.includes(marker),'Missing notice: '+marker);
});
