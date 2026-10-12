import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

const habits = (page: Page) => page.getByTestId('habit');

test('add, rename, archive, restore and delete habits, kept across reloads (#148)', async ({
	page
}) => {
	page.on('dialog', (dialog) => dialog.accept());
	await gotoHydrated(page, '/utils/self-control');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Self-Control$/);

	// From a starter.
	await page.getByRole('button', { name: 'Add a habit' }).click();
	await page.getByRole('button', { name: '📱 Doomscrolling' }).click();
	await expect(page.getByLabel('Habit', { exact: true })).toHaveValue('Doomscrolling');
	// The button that opened the form is gone; focus is on the form, not lost.
	await expect(page.getByLabel('Habit', { exact: true })).toBeFocused();
	await page.getByRole('button', { name: 'Add habit' }).click();
	await expect(page.getByText('Habit added.')).toBeVisible();

	// From scratch: the name is checked inline.
	await page.getByRole('button', { name: 'Add a habit' }).click();
	await page.getByRole('button', { name: 'Something else' }).click();
	await page.getByRole('button', { name: 'Add habit' }).click();
	await expect(page.getByRole('alert')).toHaveText('Give the habit a name.');
	await page.getByLabel('Habit', { exact: true }).fill('Morning walk');
	await page.getByLabel('Emoji').fill('🚶');
	await page.getByText('Start', { exact: true }).click();
	await page.getByRole('button', { name: 'Add habit' }).click();
	await expect(habits(page)).toHaveCount(2);
	await expect(habits(page).nth(1)).toContainText('🚶');
	await expect(habits(page).nth(1)).toContainText('Start');

	// Rename.
	await page.getByRole('button', { name: 'Edit Doomscrolling' }).click();
	await page.getByLabel('Habit', { exact: true }).fill('Phone in bed');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Habit saved.')).toBeVisible();
	await expect(habits(page).first()).toContainText('Phone in bed');

	// Archive and restore.
	await page.getByRole('button', { name: 'Archive Morning walk' }).click();
	await expect(habits(page)).toHaveCount(1);
	await page.getByText('Archived (1)').click();
	await expect(page.getByTestId('archived-habit')).toContainText('Morning walk');

	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(habits(page)).toHaveCount(1);
	await expect(habits(page)).toContainText('Phone in bed');
	await page.getByText('Archived (1)').click();
	await page.getByRole('button', { name: 'Restore Morning walk' }).click();
	await expect(habits(page)).toHaveCount(2);
	await expect(page.getByTestId('archived')).toHaveCount(0);

	// Delete asks first.
	let asked = '';
	page.removeAllListeners('dialog');
	page.once('dialog', (dialog) => {
		asked = dialog.message();
		void dialog.accept();
	});
	await page.getByRole('button', { name: 'Edit Phone in bed' }).click();
	await page.getByRole('button', { name: 'Delete habit' }).click();
	expect(asked).toMatch(/Delete Phone in bed\?/);
	await expect(page.getByText('Phone in bed deleted.')).toBeVisible();
	await expect(habits(page)).toHaveCount(1);

	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(habits(page)).toHaveText([/Morning walk/]);
});

test('the note opens on the first visit only (#148)', async ({ page }) => {
	await gotoHydrated(page, '/utils/self-control');
	const note = page.getByTestId('self-control-note');
	await expect(note).toHaveJSProperty('open', true);
	await expect(note.getByRole('link', { name: '988' })).toHaveAttribute('href', 'tel:988');
	await gotoHydrated(page, '/utils/self-control');
	await expect(note).toHaveJSProperty('open', false);
});

test('Self-Control stays private: never under Recently used (#148)', async ({ page }) => {
	await gotoHydrated(page, '/utils/coffee-timer');
	await gotoHydrated(page, '/utils/self-control');
	await gotoHydrated(page, '/');
	await expect(page.getByTestId('recent').getByRole('link')).toHaveText([/Coffee Timer$/]);

	// It can still be pinned for one-tap access.
	await gotoHydrated(page, '/utils');
	await page.getByRole('button', { name: 'Pin Self-Control to Home' }).click();
	await gotoHydrated(page, '/');
	await expect(page.getByTestId('pinned').getByRole('link')).toHaveText([/Self-Control$/]);
});

const log = (page: Page) =>
	page.evaluate(() => JSON.parse(localStorage.getItem('app:self-control:log') ?? 'null'));

test('Urge SOS: surf an urge with a timer that survives a reload, then log it (#149)', async ({
	page
}) => {
	await page.clock.install({ time: new Date('2026-01-01T20:00:00') });
	await gotoHydrated(page, '/utils/self-control');
	await page.getByTestId('sos-button').click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Urge SOS$/);

	await page.getByLabel(/How strong is it\?/).fill('6');
	await page.getByRole('button', { name: '5 min', exact: true }).click();
	await page.getByRole('button', { name: 'Start surfing' }).click();
	await expect(page.getByTestId('surf-time')).toHaveText('5:00');
	await expect(page.getByTestId('surf-prompt')).toHaveText(
		'Notice where you feel it in your body.'
	);

	await page.clock.runFor(61_000);
	await expect(page.getByTestId('surf-prompt')).toHaveText(/^Breathe out slowly/);
	await page.getByRole('button', { name: 'Rate it now' }).click();
	await page.getByLabel(/How strong is it now\?/).fill('8');
	await page.getByRole('button', { name: 'Save rating' }).click();

	// A reload mid-surf picks up where it was.
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(page.getByTestId('surf')).toBeVisible();
	await expect(page.getByTestId('surf-time')).toHaveText(/^3:5\d$/);

	// The timer runs out on its own.
	await page.clock.runFor(4 * 60_000);
	await expect(page.getByRole('heading', { name: 'Did you ride it out?' })).toBeVisible();
	await page.getByLabel(/How strong is it now\?/).fill('2');
	await page.getByRole('button', { name: 'Yes' }).click();
	await expect(page.getByTestId('sos-done')).toContainText('You rode it out.');
	await expect(page.getByText('Saved to your log.')).toBeVisible();

	const [saved] = await log(page);
	expect(saved).toMatchObject({
		start: 6,
		peak: 8,
		end: 2,
		technique: 'surf',
		outcome: 'rode-out'
	});
	expect(saved).not.toHaveProperty('habit');
	expect(await page.evaluate(() => localStorage.getItem('app:self-control:sos'))).toBeNull();
});

test('Urge SOS: a slip is logged kindly with a note, against the chosen habit (#149)', async ({
	page
}) => {
	await gotoHydrated(page, '/utils/self-control');
	await page.getByRole('button', { name: 'Add a habit' }).click();
	await page.getByRole('button', { name: '🍪 Snacking' }).click();
	await page.getByRole('button', { name: 'Add habit' }).click();
	await page.getByTestId('sos-button').click();

	await page.getByRole('button', { name: '🍪 Snacking' }).click();
	await page.getByRole('button', { name: 'Start surfing' }).click();
	await page.getByRole('button', { name: 'It passed' }).click();
	await page.getByRole('button', { name: 'Gave in' }).click();
	await expect(page.getByTestId('gave-in')).toContainText("That's okay.");
	await page.getByLabel('What might help next time? (optional)').fill('Fruit on the counter');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByTestId('sos-done')).toContainText('Next time is a fresh start.');

	const habitId = await page.evaluate(
		() => JSON.parse(localStorage.getItem('app:self-control:habits')!)[0].id
	);
	const [saved] = await log(page);
	expect(saved).toMatchObject({
		habit: habitId,
		outcome: 'gave-in',
		note: 'Fruit on the counter'
	});

	// Deleting the habit deletes its log entries too.
	page.on('dialog', (dialog) => dialog.accept());
	await page.getByTestId('sos-done').getByRole('link', { name: 'Done' }).click();
	await page.getByRole('button', { name: 'Edit Snacking' }).click();
	await page.getByRole('button', { name: 'Delete habit' }).click();
	await expect(page.getByText('Snacking deleted.')).toBeVisible();
	expect(await log(page)).toBeNull();
});
