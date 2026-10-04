import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

const SAVE_FAILED =
	"Couldn't save on this device: storage is full or blocked. Download a backup from Settings.";

const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const entries = (page: Page) => page.getByTestId('history-entry');

async function finishWorkout(page: Page, name: string) {
	await tab(page, 'Workout').click();
	await page.getByRole('button', { name: '+ Add exercise' }).click();
	const n = await page.getByTestId('exercise').count();
	await page.getByLabel(`Exercise ${n} name`).fill(name);
	await page.getByLabel(`${name} set 1 weight`).fill('100');
	await page.getByLabel(`${name} set 1 reps`).fill('5');
	await page.getByRole('button', { name: 'Finish workout' }).click();
}

test('two open tabs never overwrite each other’s workout history (#42)', async ({ context }) => {
	const a = await context.newPage();
	const b = await context.newPage();
	b.on('dialog', (dialog) => dialog.accept());
	await gotoHydrated(a, '/utils/weightlifting');
	await gotoHydrated(b, '/utils/weightlifting');

	// A workout finished in tab A shows up in tab B without a reload.
	await finishWorkout(a, 'Squat');
	await tab(b, 'History').click();
	await expect(entries(b)).toHaveCount(1);
	await expect(entries(b).first()).toContainText('Squat');

	// Finishing one in tab B keeps tab A's, and tab A sees both.
	await finishWorkout(b, 'Bench Press');
	await tab(b, 'History').click();
	await expect(entries(b)).toHaveCount(2);
	await tab(a, 'History').click();
	await expect(entries(a)).toHaveCount(2);

	// Another one in tab A, then a delete in tab B: only the deleted workout goes.
	await finishWorkout(a, 'Deadlift');
	await expect(entries(b)).toHaveCount(3);
	await entries(b)
		.filter({ hasText: 'Bench Press' })
		.getByRole('button', { name: /^Delete workout/ })
		.click();
	await a.reload();
	await a.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await tab(a, 'History').click();
	await expect(entries(a)).toHaveCount(2);
	await expect(entries(a).nth(0)).toContainText('Deadlift');
	await expect(entries(a).nth(1)).toContainText('Squat');
});

test('the open weightlifting tab is per window, but settings follow other tabs', async ({
	context
}) => {
	const a = await context.newPage();
	const b = await context.newPage();
	await gotoHydrated(a, '/utils/weightlifting');
	await gotoHydrated(b, '/settings');

	await tab(a, 'History').click();
	await gotoHydrated(b, '/utils/weightlifting');
	await tab(b, 'Workout').click();
	await expect(tab(a, 'History')).toHaveAttribute('aria-selected', 'true');

	// A theme picked in one tab applies in the other, and isn't undone by it.
	await gotoHydrated(b, '/settings');
	await b.getByRole('radio', { name: 'Dark' }).click();
	await expect(a.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
	await b.getByRole('radio', { name: 'Light' }).click();
	await expect(a.locator('html')).toHaveAttribute('data-color-scheme', 'light');
});

test.describe('when storage is full (#43)', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			Storage.prototype.setItem = () => {
				throw new DOMException('full', 'QuotaExceededError');
			};
		});
	});

	test('Finish workout says it could not save, not that it saved', async ({ page }) => {
		await gotoHydrated(page, '/utils/weightlifting');
		await finishWorkout(page, 'Squat');
		const toasts = page.getByTestId('toast');
		// One error, however many entries failed to save along the way.
		await expect(toasts).toHaveText([SAVE_FAILED]);
		await expect(page.getByText('Workout saved to history.')).toHaveCount(0);
		// The workout is still kept in this tab's history until the app closes.
		await tab(page, 'History').click();
		await expect(entries(page)).toHaveCount(1);
	});

	test('Save as my defaults says it could not save', async ({ page }) => {
		await gotoHydrated(page, '/utils/pizza-dough');
		await page.getByLabel('Dough balls').fill('6');
		await page.getByRole('button', { name: 'Save as my defaults' }).click();
		await expect(page.getByTestId('toast')).toHaveText([SAVE_FAILED]);
		await expect(page.getByText('Saved as your pizza dough defaults.')).toHaveCount(0);
	});

	test('Settings warns that nothing can be saved', async ({ page }) => {
		await gotoHydrated(page, '/settings');
		await expect(page.getByTestId('storage-warning')).toContainText(
			"This browser isn't letting xcwds save anything right now"
		);
	});
});

test('Settings shows no storage warning normally', async ({ page }) => {
	await gotoHydrated(page, '/settings');
	await expect(page.getByRole('heading', { name: 'Your data' })).toBeVisible();
	await expect(page.getByTestId('storage-warning')).toHaveCount(0);
});
