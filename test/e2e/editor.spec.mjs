import {test, expect} from '@playwright/test';
const url='http://127.0.0.1:4192/';
const editor=p=>p.getByRole('textbox',{name:'Python code',exact:true});
const code=p=>editor(p).evaluate(e=>e.value??Array.from(e.querySelectorAll('.cm-line'),l=>l.textContent).join('\n'));
async function typeCode(page,text){await editor(page).fill(text);}
test.beforeEach(async({page})=>{await page.goto(url);});
test('edits survive a reload without pressing Save',async({page})=>{await typeCode(page,'print("persistent draft")');await page.waitForTimeout(300);await page.reload();await expect.poll(()=>code(page)).toBe('print("persistent draft")');});
test('editor provides Python syntax highlighting, four-space autoindent and undo',async({page})=>{
 await typeCode(page,'if True:');await editor(page).press('End');await editor(page).press('Enter');await page.keyboard.type('print(42)');
 await expect.poll(()=>code(page)).toBe('if True:\n    print(42)');
 await expect(page.locator('.cm-gutter.cm-lineNumbers')).toBeVisible();
 await expect(page.locator('.cm-line span').first()).toBeVisible();
 await editor(page).press('ControlOrMeta+z');await expect.poll(()=>code(page)).not.toBe('if True:\n    print(42)');
});
test('open and export real UTF-8 Python files without changing their code',async({page})=>{
 await page.locator('#filePicker').setInputFiles({name:'lesson.py',mimeType:'text/x-python',buffer:Buffer.from('print("æøå🙂")\n')});
 await expect(page.locator('#activeName')).toHaveText('lesson.py');await expect.poll(()=>code(page)).toBe('print("æøå🙂")\n');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export .py',exact:true}).click();
 const file=await download;expect(file.suggestedFilename()).toBe('lesson.py');
 const {readFile}=await import('node:fs/promises');expect(await readFile(await file.path(),'utf8')).toBe('print("æøå🙂")\n');
});
