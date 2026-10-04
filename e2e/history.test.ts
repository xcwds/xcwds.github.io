import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

async function logExercise(page: Page, name: string, weight: string, reps: string) {
	await page.getByRole('button', { name: '+ Add exercise' }).click();
	const n = await page.getByTestId('exercise').count();
	await page.getByLabel(`Exercise ${n} name`).fill(name);
	await page.getByLabel(`${name} set 1 weight`).fill(weight);
	await page.getByLabel(`${name} set 1 reps`).fill(reps);
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const entries = (page: Page) => page.getByTestId('history-entry');

test('finished workouts are kept in the history', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await gotoHydrated(page, '/utils/weightlifting');
	await tab(page, 'History').click();
	await expect(page.getByTestId('history-empty')).toBeVisible();

	await tab(page, 'Workout').click();
	const finish = page.getByRole('button', { name: 'Finish workout' });
	await expect(finish).toBeDisabled();
	await page.getByLabel('Date').fill('Fri, Oct 2, 2026');
	await logExercise(page, 'Squat', '225', '5');
	await finish.click();
	await expect(page.getByTestId('toast')).toHaveText('Workout saved to history.');
	await expect(page.getByTestId('exercise')).toHaveCount(0);

	await page.getByLabel('Date').fill('Sat, Oct 3, 2026');
	await logExercise(page, 'Bench Press', '135', '8');
	await finish.click();

	await tab(page, 'History').click();
	await expect(entries(page)).toHaveCount(2);
	// Newest first.
	await expect(entries(page).first()).toContainText('Sat, Oct 3, 2026');
	await expect(entries(page).nth(1)).toContainText('Squat · 1 set');

	// Survives a reload (and the History tab is remembered).
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(tab(page, 'History')).toHaveAttribute('aria-selected', 'true');
	await expect(entries(page)).toHaveCount(2);

	const squat = entries(page).nth(1);
	await squat.locator('summary').click();
	await expect(squat.getByTestId('history-text')).toContainText('1 set × 5 reps @ 225 lb');
	await squat.getByRole('button', { name: 'Copy' }).click();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Squat');

	await page.getByRole('button', { name: 'Copy all' }).click();
	const all = await page.evaluate(() => navigator.clipboard.readText());
	expect(all.indexOf('Bench Press')).toBeLessThan(all.indexOf('Squat'));

	for (const name of ['Copy', 'Repeat', 'Delete workout from Fri, Oct 2, 2026']) {
		const box = (await squat.getByRole('button', { name }).boundingBox())!;
		expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
	}
});

test('repeat starts a workout from a past one, saving the current one first', async ({ page }) => {
	await gotoHydrated(page, '/utils/weightlifting');
	await tab(page, 'Workout').click();
	await logExercise(page, 'Deadlift', '315', '3');
	await page.getByRole('button', { name: 'Finish workout' }).click();

	await logExercise(page, 'Row', '95', '10');
	await tab(page, 'History').click();
	await entries(page).first().getByRole('button', { name: 'Repeat' }).click();

	await expect(tab(page, 'Workout')).toHaveAttribute('aria-selected', 'true');
	await expect(
		page.getByTestId('toast').filter({ hasText: 'Your current workout was saved to history.' })
	).toBeVisible();
	await expect(page.getByLabel('Exercise 1 name')).toHaveValue('Deadlift');
	await expect(page.getByLabel('Deadlift set 1 weight')).toHaveValue('315');

	await tab(page, 'History').click();
	await expect(entries(page)).toHaveCount(2);
	await expect(entries(page).first()).toContainText('Row');
});

test('deleting, clearing and backing up the history', async ({ page }) => {
	page.on('dialog', (dialog) => dialog.accept());
	await gotoHydrated(page, '/utils/weightlifting');
	await tab(page, 'Workout').click();
	await logExercise(page, 'Squat', '225', '5');
	await page.getByRole('button', { name: 'Finish workout' }).click();
	await logExercise(page, 'Squat', '235', '5');
	await page.getByRole('button', { name: 'Finish workout' }).click();

	await tab(page, 'History').click();
	await entries(page)
		.first()
		.getByRole('button', { name: /^Delete workout/ })
		.click();
	await expect(entries(page)).toHaveCount(1);

	// Backups include the history.
	await gotoHydrated(page, '/settings');
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download backup' }).click();
	const backup = JSON.parse(
		await (await import('node:fs/promises')).readFile((await (await download).path())!, 'utf8')
	);
	expect(backup.data['app:workout-history']).toHaveLength(1);

	// Clearing the calculator's data keeps the history; clearing the history removes it.
	await page.getByRole('button', { name: 'Clear Weightlifting Calculator' }).click();
	await gotoHydrated(page, '/utils/weightlifting');
	await tab(page, 'History').click();
	await expect(entries(page)).toHaveCount(1);

	await gotoHydrated(page, '/settings');
	await page.getByRole('button', { name: 'Clear Workout History' }).click();
	await gotoHydrated(page, '/utils/weightlifting');
	await tab(page, 'History').click();
	await expect(page.getByTestId('history-empty')).toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem('app:workout-history'))).toBeNull();
});
