import {test, expect} from '@playwright/test';
import {build} from 'esbuild';
let bundle;
test.beforeAll(async()=>{bundle=(await build({entryPoints:['www/app.js'],bundle:true,format:'esm',target:'safari17',external:['./python-runner.mjs'],write:false})).outputFiles[0].text;});
const editor=p=>p.getByRole('textbox',{name:'Python code',exact:true});
const code=p=>editor(p).evaluate(e=>Array.from(e.querySelectorAll('.cm-line'),l=>l.textContent).join('\n'));
async function loadFirst(page){
 await page.getByRole('button',{name:'Learn',exact:true}).click();
 await page.locator('[data-lesson]').first().click();
 await page.getByRole('button',{name:'Load exercise',exact:true}).click();
}
// A deterministic catalog fixture isolates UI behavior; Python still runs in the real worker.
const fixture=[{id:'basics',title:'First steps',level:'Beginner',description:'Test curriculum',lessons:[{id:'hello',title:'A friendly greeting',explanation:'print() writes a line to the console.',example:'print("Hello, MuPad!")',task:{prompt:'Print Hello, MuPad!',starter:'# Print your greeting\n',hints:['Use print().','Put the greeting in quotes.'],solution:'print("Hello, MuPad!")\n',checks:'assert __mupad_output.strip() == "Hello, MuPad!", "Print the requested greeting."'}}]}];
test.beforeEach(async({page})=>{
 await page.route('**/app.bundle.js',route=>route.fulfill({contentType:'text/javascript',body:bundle}));
 await page.route('**/learning-catalog.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export const courses=${JSON.stringify(fixture)}; export const findLesson=id=>courses.flatMap(c=>c.lessons).find(l=>l.id===id);`}));
 await page.goto('/');
});
test('learning opens a new file, keeps the draft and docks the task outside the dialog',async({page})=>{
 await editor(page).fill('print("my precious draft")');
 await loadFirst(page);
 await expect(page.locator('#learningDialog')).not.toBeVisible();
 await expect(page.locator('#exerciseDock')).toBeVisible();
 const exercise=await page.locator('#activeName').textContent();expect(exercise).not.toBe('main.py');
 await page.getByRole('button',{name:'main.py',exact:true}).click();
 await expect.poll(()=>code(page)).toBe('print("my precious draft")');
 await expect(page.getByRole('button',{name:'Check solution',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:exercise,exact:true}).click();
 await expect(page.getByRole('button',{name:'Check solution',exact:true})).toBeEnabled();
 await page.reload();await expect(page.locator('#exerciseDock')).toBeVisible();
 await loadFirst(page);expect(await page.locator('#activeName').textContent()).not.toBe(exercise);
});
test('real Python checks preserve stdout, reject errors and persist only a verified pass',async({page})=>{
 test.setTimeout(90000);await loadFirst(page);
 await editor(page).fill('print("not the greeting")');await page.locator('#checkSolution').click();
 await expect(page.locator('#exerciseFeedback')).toContainText('Not passed');
 await expect(page.locator('#output')).toContainText('not the greeting');await expect(page.locator('#output')).toContainText('AssertionError');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mupad-learning-v1')).completed)).toEqual([]);
 await editor(page).fill('import sys\nprint("Hello, MuPad!")\nsys.exit(0)');await page.locator('#checkSolution').click();
 await expect(page.locator('#exerciseFeedback')).toContainText('Not passed');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mupad-learning-v1')).completed)).toEqual([]);
 await editor(page).fill('print("Hello, MuPad!")');await page.locator('#checkSolution').click();
 await expect(page.locator('#exerciseFeedback')).toContainText('Passed');await expect(page.locator('#output')).toHaveText('Hello, MuPad!\n');
 await page.reload();await page.getByRole('button',{name:'Learn',exact:true}).click();await expect(page.locator('#learningProgress')).toContainText('1 of 1');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Reset progress',exact:true}).click();await expect(page.locator('#learningProgress')).toContainText('1 of 1');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Reset progress',exact:true}).click();await expect(page.locator('#learningProgress')).toContainText('0 of 1');
});
test('hints are progressive and revealing a solution never replaces code or awards progress',async({page})=>{
 await loadFirst(page);const draft=await code(page);
 await expect(page.locator('#exerciseHints')).toBeEmpty();await expect(page.locator('#exerciseSolution')).not.toBeVisible();
 await page.getByRole('button',{name:'Next hint',exact:true}).click();await expect(page.locator('#exerciseHints')).toContainText('Use print().');await expect(page.locator('#exerciseHints')).not.toContainText('Put the greeting');
 await page.getByRole('button',{name:'Next hint',exact:true}).click();await expect(page.locator('#exerciseHints')).toContainText('Put the greeting');
 await page.getByRole('button',{name:'Reveal solution',exact:true}).click();await expect(page.getByRole('button',{name:'Show solution now',exact:true})).toBeVisible();await expect(page.locator('#exerciseSolution')).not.toBeVisible();
 await page.getByRole('button',{name:'Show solution now',exact:true}).click();await expect(page.locator('#exerciseSolution')).toContainText('print("Hello, MuPad!")');await expect.poll(()=>code(page)).toBe(draft);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mupad-learning-v1')).completed)).toEqual([]);
});
const mistakes=[
 ['SyntaxError','print("hello"','punctuation'],['IndentationError','if True:\nprint(1)','indent'],['NameError','print(missing_name)','spelling'],['TypeError','print("age: " + 4)','types'],['ValueError','int("hello")','conversion'],['ZeroDivisionError','1 / 0','zero'],['ModuleNotFoundError','import nonexistent_mupad_module','available']
];
for(const [name,source,tip] of mistakes)test(`ordinary Run preserves ${name} traceback and adds targeted help`,async({page})=>{
 await editor(page).fill(source);await page.locator('#runButton').click();await expect(page.locator('#output')).toContainText(name);await expect(page.locator('#output')).toContainText('main.py');
 await expect(page.locator('#errorHelp')).toContainText(tip,{timeout:2000});
 await editor(page).fill('print("plain run")');await page.locator('#runButton').click();await expect(page.locator('#output')).toHaveText('plain run\n');await expect(page.locator('#errorHelp')).not.toBeVisible();
});
test('guide explains the first run, input, stop and safe backups',async({page})=>{
 await page.getByRole('button',{name:'Guide',exact:true}).click({timeout:3000});
 for(const text of ['print("Hello, MuPad!")','Run','input()','Stop','Export .py'])await expect(page.locator('#guideDialog')).toContainText(text);
 await page.getByRole('button',{name:'Close guide',exact:true}).click();await expect(editor(page)).toBeVisible();
});
test('console fills the app without native fullscreen and keeps live stdin, EOF, Run and Stop',async({page})=>{
 await page.evaluate(()=>{Element.prototype.requestFullscreen=undefined;});await editor(page).fill('name = input("Your name: ")\nprint("Hello", name)');
 await page.getByRole('button',{name:'Expand console',exact:true}).click({timeout:3000});await expect(page.locator('.app-shell')).toHaveClass(/console-focus/);await expect(editor(page)).not.toBeVisible();
 const shell=await page.locator('.app-shell').boundingBox(),consoleBox=await page.locator('.console').boundingBox();expect(consoleBox.height).toBeGreaterThan(shell.height*0.7);
 await page.locator('#runButton').click();await expect(page.locator('#inputForm')).toBeVisible();await page.locator('#stdinValue').fill('Ada');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('#output')).toContainText('Hello Ada');
 await page.locator('#output').press('Escape');await expect(editor(page)).toBeVisible();await expect.poll(()=>code(page)).toContain('name = input');await expect(page.locator('#output')).toContainText('Hello Ada');
 await page.getByRole('button',{name:'Expand console',exact:true}).click();await page.locator('#runButton').click();await expect(page.locator('#inputForm')).toBeVisible();await page.locator('#eofButton').click();await expect(page.locator('#output')).toContainText('EOFError');
 await page.getByRole('button',{name:'Collapse console',exact:true}).click();await editor(page).fill('while True:\n    pass');await page.getByRole('button',{name:'Expand console',exact:true}).click();await page.locator('#runButton').click();await expect(page.locator('#stopButton')).toBeEnabled();await page.locator('#stopButton').click();await expect(page.locator('#runMeta')).toContainText('Stopped');
});
