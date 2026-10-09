import {test,expect} from '@playwright/test';
test('native self-test reports real interpreter phases independently of custom-scheme fetch',async({page})=>{
 await page.addInitScript(()=>{window.__MUPAD_SELFTEST__=true;window.__nativeReports=[];window.__mupadReport=report=>window.__nativeReports.push(report);});
 await page.route('**/__mupad_input__?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({value:'Ada🙂'})}));
 await page.goto('/');
 await expect.poll(()=>page.evaluate(()=>window.__nativeReports.some(r=>r.status==='passed')),{timeout:30000}).toBe(true);
 const final=await page.evaluate(()=>window.__nativeReports.find(r=>r.status==='passed'));
 expect(final.results).toHaveLength(4);
 expect(final.results).toEqual(expect.arrayContaining([expect.objectContaining({name:'bundled learning courses and real Python exercise grading reject empty answers',status:'passed'})]));
 await expect.poll(()=>page.evaluate(()=>window.__nativeReports.some(r=>r.phase==='app-initialized'))).toBe(true);
});
