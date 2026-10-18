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
	// It keeps its time (noon, as logged without one).
	await expect(page.getByLabel('Time (optional)')).toHaveValue('12:00');
	await page.getByLabel('Date').fill(daysAgo(9));
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByTestId('since')).toContainText('Last done 9 days ago');

	// Back to the list with the browser's Back button.
	await page.goBack();
	await expect(thing(page, 'Dog food')).toBeVisible();
});

test('logging something earlier today with no time works before noon', async ({ page }) => {
	await page.clock.install({ time: new Date(2026, 9, 14, 8, 30) });
	await gotoHydrated(page, '/utils/last-done');
	await add(page, 'Feed the cat');
	await page.getByRole('button', { name: 'Done earlier: Feed the cat' }).click();
	await page.getByRole('button', { name: 'Log it' }).click();
	await expect(page.getByTestId('undo-row')).toContainText('Logged Feed the cat.');
	await expect(thing(page, 'Feed the cat').getByTestId('since')).toHaveText('today');
});

test('the search box stays while a search is active', async ({ page }) => {
	page.on('dialog', (dialog) => dialog.accept());
	await gotoHydrated(page, '/utils/last-done');
	await page.evaluate(() =>
		localStorage.setItem(
			'app:last-done:items',
			JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, name: `Thing ${i}` })))
		)
	);
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await page.getByRole('searchbox', { name: 'Search' }).fill('Thing 3');
	await expect(things(page)).toHaveCount(1);
	await things(page).getByRole('link').click();
	await page.getByRole('button', { name: 'Edit' }).click();
	await page.getByRole('button', { name: 'Delete…' }).click();
	await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('Thing 3');
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

test('adds the next due date to your calendar, and offers the new one after Done (#219)', async ({
	page
}) => {
	// The download path: no file sharing in this browser.
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'canShare', { value: () => false });
	});
	await gotoHydrated(page, '/utils/last-done');
	await add(page, 'Never done');
	await thing(page, 'Never done').getByRole('link', { name: 'Never done' }).click();
	// No due date yet: nothing to add.
	await expect(page.getByTestId('since')).toHaveText('Not done yet');
	await expect(page.getByTestId('add-to-calendar')).toHaveCount(0);

	await page.getByRole('link', { name: 'All things' }).click();
	await add(page, 'Vacuum, basement; stairs', { n: '2', unit: 'weeks' });
	await doneEarlier(page, 'Vacuum, basement; stairs', 4);
	await thing(page, 'Vacuum, basement; stairs')
		.getByRole('link', { name: 'Vacuum, basement; stairs' })
		.click();
	await expect(page.getByText('Due in 10 days')).toBeVisible();

	const due = new Date();
	due.setDate(due.getDate() + 10);
	const day = [due.getFullYear(), due.getMonth() + 1, due.getDate()]
		.map((n, i) => String(n).padStart(i ? 2 : 4, '0'))
		.join('');
	const download = page.waitForEvent('download');
	await page.getByTestId('add-to-calendar').click();
	const file = await download;
	expect(file.suggestedFilename()).toBe('Vacuum, basement; stairs.ics');
	const ics = await readFile((await file.path())!, 'utf8');
	const lines = ics.replace(/\r\n /g, '').split('\r\n');
	expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
	expect(lines).toContain(`DTSTART;VALUE=DATE:${day}`);
	expect(lines).toContain('SUMMARY:Vacuum\\, basement\\; stairs');
	expect(lines).toContain('TRIGGER:PT9H');
	expect(lines.find((l) => l.startsWith('UID:'))).toMatch(new RegExp(`-${day}@xcwds\\.com$`));
	await expect(page.getByTestId('toast').filter({ hasText: 'Downloaded' })).toBeVisible();

	// Done today moves the due date: the new one is offered, once.
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	const offer = page.getByTestId('calendar-offer');
	await expect(offer).toContainText('Next due in 14 days.');
	const again = page.waitForEvent('download');
	await offer.getByRole('button', { name: 'Add the new due date' }).click();
	await again;
	await expect(offer).toHaveCount(0);
	// Remembered across a reload: Done today again doesn't move it, so nothing is offered.
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(page.getByTestId('undo-row')).toBeVisible();
	await expect(offer).toHaveCount(0);
});
