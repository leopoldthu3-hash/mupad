import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('original app icon is a real opaque RGB 1024 PNG, wired into native preparation',async()=>{
 const icon=await readFile(new URL('../docs/images/mupad-app-icon.png',import.meta.url));
 assert.equal(icon.subarray(1,4).toString(),'PNG');
 assert.equal(icon.readUInt32BE(16),1024);assert.equal(icon.readUInt32BE(20),1024);
 assert.equal(icon[25],2,'App Store-style icons must not contain an alpha channel');
 const prepare=await readFile(new URL('../scripts/prepare-native.mjs',import.meta.url),'utf8');
 assert.match(prepare,/mupad-app-icon\.png/);assert.match(prepare,/AppIcon-512@2x\.png/);
});
