import {test,expect} from '@playwright/test';
const e=p=>p.getByRole('textbox',{name:'Python code',exact:true});
async function run(p,code){await e(p).fill(code);await p.getByRole('button',{name:'▶ Run',exact:true}).click();}
test.beforeEach(async({page})=>{await page.goto('/');});
test('ordinary Python functions, imports, file IO, Unicode and main guard execute locally',async({page})=>{
 await page.locator('#filePicker').setInputFiles({name:'helper.py',mimeType:'text/x-python',buffer:Buffer.from('answer=42\n')});
 await page.getByRole('button',{name:'main.py',exact:true}).click();
 await run(page,'import helper, json\nif __name__ == "__main__":\n    print(helper.answer)\n    print(json.dumps([i*i for i in range(4)]))\n    print("æøå🙂", __file__)\n    print(open("helper.py").read())');
 await expect(page.locator('#output')).toContainText('42\n[0, 1, 4, 9]\næøå🙂 /workspace/main.py\nanswer=42');
 await expect(page.locator('#runMeta')).toContainText('Finished');
});
test('streams output before exceptions, shows real filename and stderr',async({page})=>{
 await run(page,'import sys\nprint("before error")\nsys.stderr.write("warning\\n")\nraise ValueError("failure")');
 await expect(page.locator('#output')).toContainText('before error\nwarning\n');
 await expect(page.locator('#output')).toContainText('File "/workspace/main.py", line 4');
 await expect(page.locator('#output')).toContainText('ValueError: failure');
});
test('normal input() works unchanged inside functions and handles blank input',async({page})=>{
 await run(page,'def ask():\n    return input("Name: ")\nprint("Hello", ask())\nprint(repr(input("Blank: ")))');
 await expect(page.locator('#inputForm')).toBeVisible();await page.locator('#stdinValue').fill('Ada🙂');await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('#inputPrompt')).toHaveText('Blank: ');await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('#output')).toContainText("Name: Hello Ada🙂\nBlank: ''");await expect(page.locator('#runMeta')).toContainText('Finished');
});
test('infinite Python loop stays stoppable and a second program runs',async({page})=>{
 await run(page,'print("spinning")\nwhile True: pass');await expect(page.locator('#output')).toContainText('spinning');
 await page.getByRole('button',{name:'■ Stop',exact:true}).click();await expect(page.locator('#runMeta')).toContainText('Stopped');
 await run(page,'print("restarted")');await expect(page.locator('#output')).toHaveText('restarted\n');
});
test('malformed saved active file does not crash editor',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('mupad-workspace-v1',JSON.stringify({activeFile:'missing.py',files:[{name:'kept.py',content:'print(7)'}]})));
 await page.reload();await expect(page.locator('#activeName')).toHaveText('kept.py');await expect(e(page)).toBeVisible();
});
test('no horizontal layout overflow or hidden main actions on iPad viewport',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await expect(page.getByRole('button',{name:'▶ Run',exact:true})).toBeInViewport();await expect(page.getByRole('button',{name:'■ Stop',exact:true})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();expect(errors).toEqual([]);
});
