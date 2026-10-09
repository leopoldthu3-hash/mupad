import test from 'node:test';
import assert from 'node:assert/strict';
import {pyodideIndexURL} from '../www/runtime-path.mjs';

test('browser and native asset URLs retain their real protocol',()=>{
 for(const base of ['https://example.test/pyodide/','mupad-desktop://app/pyodide/','capacitor://localhost/pyodide/'])assert.equal(pyodideIndexURL(new URL(base)),base);
});
test('Node file URLs become decoded POSIX paths',()=>{
 assert.equal(pyodideIndexURL(new URL('file:///home/user/My%20Python/pyodide/')),'/home/user/My Python/pyodide/');
});
test('Windows Node file URLs do not duplicate the drive letter',()=>{
 assert.equal(pyodideIndexURL(new URL('file:///D:/a/mupad/pyodide/')),'D:/a/mupad/pyodide/');
 assert.equal(pyodideIndexURL(new URL('file:///C:/Caf%C3%A9/pyodide/')),'C:/Café/pyodide/');
});
