import {test,expect} from '@playwright/test';
import {courses,findLesson} from '../../www/learning-catalog.mjs';
const editor=page=>page.getByRole('textbox',{name:'Python code',exact:true});
async function open(page,id){
 await page.locator('#learnButton').click();
 await page.locator(`[data-lesson="${id}"]`).click();
 await page.locator('#loadExercise').click();
}
test('production bundle includes all 36 lessons and grades a real curriculum answer without route fixtures',async({page})=>{
 await page.goto('/');await expect(editor(page)).toBeVisible();
 await page.locator('#learnButton').click();await expect(page.locator('.course-card')).toHaveCount(6);await expect(page.locator('[data-lesson]')).toHaveCount(36);
 const first=courses[0].lessons[0];await page.locator(`[data-lesson="${first.id}"]`).click();await expect(page.locator('#lessonExplanation')).toHaveText(first.explanation);await page.locator('#loadExercise').click();
 await page.locator('#checkSolution').click();await expect(page.locator('#exerciseFeedback')).toContainText('Not passed');
 await editor(page).fill(first.task.solution);await page.locator('#checkSolution').click();await expect(page.locator('#exerciseFeedback')).toContainText('Passed');
 await page.reload();await page.locator('#learnButton').click();await expect(page.locator('#learningProgress')).toHaveText('1 of 36 exercises completed');
});
test('actual input and advanced curriculum tasks pass in the production browser worker',async({page})=>{
 await page.goto('/');await expect(editor(page)).toBeVisible();
 for(const lesson of [findLesson('typed-input'),courses.at(-1).lessons.at(-1)]){
  await open(page,lesson.id);await editor(page).fill(lesson.task.solution);await page.locator('#checkSolution').click();await expect(page.locator('#exerciseFeedback')).toContainText('Passed');
 }
 await page.locator('#learnButton').click();await expect(page.locator('#learningProgress')).toHaveText('2 of 36 exercises completed');
});
