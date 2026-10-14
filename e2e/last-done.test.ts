import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

// Last done (#218): when you last did things, and how often you usually do them.
test.use({ viewport: { width: 390, height: 844 } });

const things = (page: Page) => page.getByTestId('thing');
const thing = (page: Page, name: string) => things(page).filter({ hasText: name });

async function add(page: Page, name: string, every?: { n: string; unit: string }) {
	await page.getByRole('button', { name: 'Add something' }).click();
	await page.getByLabel('Name').fill(name);
	if (every) {
		await page.getByLabel('Target number').fill(every.n);
		await page.getByLabel('Target unit').selectOption(every.unit);
	}
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page.getByTestId('toast').filter({ hasText: `Added ${name}.` })).toBeVisible();
}

/** A date `days` before today, as a date input wants it. */
const daysAgo = (days: number) => {
	const d = new Date();
	d.setDate(d.getDate() - days);
	return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
		.map((n) => String(n).padStart(2, '0'))
		.join('-');
};

async function doneEarlier(page: Page, name: string, days: number) {
	await page.getByRole('button', { name: `Done earlier: ${name}` }).click();
	await page.getByLabel('Date').fill(daysAgo(days));
	await page.getByRole('button', { name: 'Log it' }).click();
	await expect(page.getByTestId('undo-row')).toContainText(`Logged ${name}.`);
}

test('add a thing, log it done and undo it', async ({ page }) => {
	await gotoHydrated(page, '/utils/last-done');
	await add(page, 'Clean the bathroom');
	await expect(thing(page, 'Clean the bathroom').getByTestId('since')).toHaveText('Not done yet');
	await page.getByRole('button', { name: 'Done: Clean the bathroom' }).click();
	await expect(thing(page, 'Clean the bathroom').getByTestId('since')).toHaveText('today');
	const undo = page.getByTestId('undo-row');
	await expect(undo).toContainText('Logged Clean the bathroom.');
	await expect(undo.getByRole('button', { name: 'Undo' })).toBeFocused();
	await undo.getByRole('button', { name: 'Undo' }).click();
	await expect(thing(page, 'Clean the bathroom').getByTestId('since')).toHaveText('Not done yet');
	await expect(undo).toHaveCount(0);
});

test('a thing’s page shows how often it is done, and edits its history', async ({ page }) => {
	await gotoHydrated(page, '/utils/last-done');
	await add(page, 'Dog food');
	await doneEarlier(page, 'Dog food', 30);
	await doneEarlier(page, 'Dog food', 20);
	await doneEarlier(page, 'Dog food', 8);
	const card = thing(page, 'Dog food');
	await expect(card.getByTestId('since')).toContainText('8 days ago');
	await expect(card.getByTestId('since')).toContainText('usually every 11 days');
	await expect(card).toContainText('Due in 3 days');

	await card.getByRole('link', { name: 'Dog food' }).click();
	await expect(page).toHaveURL(/\/utils\/last-done#.+/);
	await expect(page.getByTestId('stats')).toContainText('Times done 3');
	await expect(page.getByTestId('median')).toHaveText('11 days');
	await expect(page.getByTestId('gap-chart').locator('rect')).toHaveCount(2);
	const history = page.getByTestId('history').getByRole('listitem');
	await expect(history).toHaveCount(3);

	// Remove the oldest, then put it back.
	await history
		.last()
		.getByRole('button', { name: /^Remove / })
		.click();
	await expect(history).toHaveCount(2);
	await expect(page.getByTestId('gap-chart').locator('rect')).toHaveCount(1);
	await page.getByTestId('undo-row').getByRole('button', { name: 'Undo' }).click();
	await expect(history).toHaveCount(3);

	// Move the newest back a day.
	await history
		.first()
		.getByRole('button', { name: /^Change / })
		.click();
	await page.getByLabel('Date').fill(daysAgo(9));
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByTestId('since')).toContainText('Last done 9 days ago');

	// Back to the list with the browser's Back button.
	await page.goBack();
	await expect(thing(page, 'Dog food')).toBeVisible();
});

test('overdue things come first; edit and delete a thing', async ({ page }) => {
	page.on('dialog', (dialog) => dialog.accept());
	await gotoHydrated(page, '/utils/last-done');
	await add(page, 'Water the plants');
	await doneEarlier(page, 'Water the plants', 1);
	await add(page, 'Vacuum the basement', { n: '1', unit: 'weeks' });
	await doneEarlier(page, 'Vacuum the basement', 10);
	await add(page, 'Descale the kettle');
	await expect(things(page).first()).toContainText('Vacuum the basement');
	await expect(things(page).first().getByTestId('overdue')).toHaveText('Overdue');
	await expect(things(page).first()).toContainText('Due 3 days ago');
	await expect(things(page).last()).toContainText('Descale the kettle');

	await thing(page, 'Vacuum the basement').getByRole('link').click();
	await page.getByRole('button', { name: 'Edit' }).click();
	await page.getByLabel('Name').fill('');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('alert')).toHaveText('Give it a name.');
	await page.getByLabel('Name').fill('Vacuum downstairs');
	await page.getByLabel('Target number').fill('2');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('heading', { name: 'Vacuum downstairs' })).toBeVisible();
	await expect(page.getByTestId('since')).toContainText('target every 2 weeks');

	await page.getByRole('button', { name: 'Edit' }).click();
	await page.getByRole('button', { name: 'Delete…' }).click();
	await expect(
		page.getByTestId('toast').filter({ hasText: 'Deleted Vacuum downstairs.' })
	).toBeVisible();
	await expect(things(page)).toHaveCount(2);
	const log = await page.evaluate(() => JSON.parse(localStorage.getItem('app:last-done:log')!));
	expect(log).toHaveLength(1);
});

test('things survive a reload and go into backups', async ({ page }) => {
	await gotoHydrated(page, '/utils/last-done');
	await add(page, 'Change the furnace filter', { n: '3', unit: 'months' });
	await page.getByRole('button', { name: 'Done: Change the furnace filter' }).click();
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(thing(page, 'Change the furnace filter').getByTestId('since')).toHaveText('today');

	await gotoHydrated(page, '/settings');
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download backup' }).click();
	const backup = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
	expect(backup.data['app:last-done:items']).toEqual([
		expect.objectContaining({
			name: 'Change the furnace filter',
			every: { n: 3, unit: 'months' }
		})
	]);
	expect(backup.data['app:last-done:log']).toHaveLength(1);
	await expect(page.getByRole('button', { name: 'Clear Last done' })).toBeEnabled();
});
