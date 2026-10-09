import {test,expect} from '@playwright/test';
import {courses} from '../../www/learning-catalog.mjs';

const first=courses[0].lessons[0];
const editor=page=>page.getByRole('textbox',{name:'Python code',exact:true});
const code=page=>editor(page).evaluate(element=>Array.from(element.querySelectorAll('.cm-line'),line=>line.textContent).join('\n'));
const progress=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('mupad-learning-v1')));
async function loadFirst(page){
 await page.goto('/');await expect(editor(page)).toBeVisible();
 await page.locator('#learnButton').click();
 await page.locator(`[data-lesson="${first.id}"]`).click();
 await page.locator('#loadExercise').click();
}
async function rename(page,name){
 await page.locator('#renameButton').click();
 await page.locator('#nameValue').fill(name);
 await page.locator('#nameForm button[type="submit"]').click();
 await expect(page.locator('#nameDialog')).not.toBeVisible();
}

test('normal Rename preserves the active exercise binding, code and progress after reload',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/');await expect(editor(page)).toBeVisible();
 const draft='print("keep my unrelated draft")';
 await editor(page).fill(draft);
 await page.locator('#learnButton').click();
 await page.locator(`[data-lesson="${first.id}"]`).click();
 await page.locator('#loadExercise').click();
 const original=await page.locator('#activeName').textContent();
 const answer=first.task.solution.trimEnd()+'\n# Keep my exercise edits';
 await editor(page).fill(answer);
 // A rejected collision must leave the exercise and both files untouched.
 await page.locator('#renameButton').click();await page.locator('#nameValue').fill('main.py');
 await page.locator('#nameForm button[type="submit"]').click();
 await expect(page.locator('#nameError')).not.toBeEmpty();
 await page.locator('#nameCancel').click();
 expect((await progress(page)).selected.filename).toBe(original);
 await rename(page,'my_greeting.py');
 await expect(page.locator('#activeName')).toHaveText('my_greeting.py');
 await expect(page.locator('#exerciseBinding')).toHaveText('Exercise file: my_greeting.py');
 await expect(page.locator('#checkSolution')).toBeEnabled();
 await expect.poll(()=>code(page)).toBe(answer);
 expect((await progress(page)).selected).toEqual({lessonId:first.id,filename:'my_greeting.py'});
 expect((await progress(page)).completed).toEqual([]);
 // Renaming a different file must not steal the exercise binding.
 await page.getByRole('button',{name:'main.py',exact:true}).click();
 await expect.poll(()=>code(page)).toBe(draft);
 await rename(page,'my_draft.py');
 await expect(page.locator('#checkSolution')).toBeDisabled();
 expect((await progress(page)).selected.filename).toBe('my_greeting.py');
 await page.getByRole('button',{name:'my_greeting.py',exact:true}).click();
 await page.reload();
 await expect(page.locator('#exerciseDock')).toBeVisible();
 await expect(page.locator('#exerciseTitle')).toHaveText(first.title);
 await expect(page.locator('#exerciseBinding')).toHaveText('Exercise file: my_greeting.py');
 await expect(page.locator('#checkSolution')).toBeEnabled();
 await expect.poll(()=>code(page)).toBe(answer);
 await editor(page).fill('print("wrong greeting")');await page.locator('#checkSolution').click();
 await expect(page.locator('#exerciseFeedback')).toContainText('Not passed');
 expect((await progress(page)).completed).toEqual([]);
 await editor(page).fill(answer);await page.locator('#checkSolution').click();
 await expect(page.locator('#exerciseFeedback')).toContainText('Passed');
 expect((await progress(page)).completed).toEqual([first.id]);
 await page.reload();await expect(page.locator('#exerciseBinding')).toHaveText('Exercise file: my_greeting.py');
 await expect.poll(()=>code(page)).toBe(answer);
 await page.locator('#learnButton').click();await expect(page.locator('#learningProgress')).toHaveText('1 of 36 exercises completed');
 await page.locator('#closeLearning').click();
 await page.getByRole('button',{name:'my_draft.py',exact:true}).click();await expect.poll(()=>code(page)).toBe(draft);
});

test('Check uses the same genuine student __main__ module as Run and persists only verified progress',async({page})=>{
 test.setTimeout(90000);await loadFirst(page);
 const filename=await page.locator('#activeName').textContent();
 const answer=`import __main__\n__main__.message = 'Hello, Python!'\nprint(message)\nprint('I can write code.')\nimport types\nassert isinstance(__main__, types.ModuleType)\nassert __main__.__dict__ is globals()\nassert __main__.__file__ == ${JSON.stringify('/workspace/'+filename)}\nassert not hasattr(__main__, '_namespace')\nassert not hasattr(__main__, '_capture')`;
 await editor(page).fill(answer);await page.locator('#runButton').click();
 await expect(page.locator('#output')).toHaveText('Hello, Python!\nI can write code.\n');
 await expect(page.locator('#runMeta')).toContainText('Finished');
 expect((await progress(page)).completed).toEqual([]);
 await page.locator('#checkSolution').click();
 await expect(page.locator('#exerciseFeedback')).toContainText('Passed');
 await expect(page.locator('#output')).toHaveText('Hello, Python!\nI can write code.\n');
 expect((await progress(page)).completed).toEqual([first.id]);
 await page.reload();await expect.poll(()=>code(page)).toBe(answer);
 await page.locator('#learnButton').click();await expect(page.locator('#learningProgress')).toHaveText('1 of 36 exercises completed');
 await page.locator('#closeLearning').click();
 // A successful import must not bypass Python checks or award a false pass.
 await editor(page).fill(answer.replace("'Hello, Python!'","'Wrong greeting'"));
 await page.locator('#checkSolution').click();await expect(page.locator('#exerciseFeedback')).toContainText('Not passed');
 await expect(page.locator('#output')).toContainText('AssertionError');
 await expect(page.locator('#output')).toContainText('Wrong greeting');
 expect((await progress(page)).completed).toEqual([first.id]);
 // Errors after correct output must not satisfy the completion marker either.
 await editor(page).fill(answer+'\nraise RuntimeError("still broken")');
 await page.locator('#checkSolution').click();await expect(page.locator('#exerciseFeedback')).toContainText('Not passed');
 await expect(page.locator('#output')).toContainText('RuntimeError: still broken');
 expect((await progress(page)).completed).toEqual([first.id]);
});
