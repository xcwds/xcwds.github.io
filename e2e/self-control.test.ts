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
	// Passing 10 on the way down to 2 doesn't make 10 the peak.
	await page.getByLabel(/How strong is it now\?/).fill('10');
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

test('Urge SOS: the writing techniques, with answers kept through a reload and a name for self-talk (#149)', async ({
	page
}) => {
	await gotoHydrated(page, '/utils/self-control/sos');
	await page.getByRole('button', { name: 'Zoom out' }).click();
	// No timer to choose for a writing technique.
	await expect(page.getByRole('button', { name: '5 min', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Zoom out' })).toBeVisible();
	await page.getByLabel(/What is it, in plain words\?/).fill('sugar and fat');

	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(page.getByLabel(/What is it, in plain words\?/)).toHaveValue('sugar and fat');
	await page.getByRole('button', { name: 'Done' }).click();
	await page.getByRole('button', { name: 'Partly' }).click();
	const [saved] = await log(page);
	expect(saved).toMatchObject({ technique: 'zoom-out', outcome: 'partly' });
	expect(JSON.stringify(saved)).not.toContain('sugar');

	// Self-talk asks for your name once and uses it.
	await gotoHydrated(page, '/utils/self-control/sos');
	await page.getByRole('button', { name: 'Talk to yourself like a friend' }).click();
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await page.getByRole('button', { name: 'Use my name' }).click();
	await expect(page.getByRole('alert')).toHaveText('Type your name first.');
	await page.getByLabel(/Your name, for these prompts/).fill('Alex');
	await page.getByRole('button', { name: 'Use my name' }).click();
	await expect(page.getByText('Name saved.')).toBeVisible();
	await expect(page.getByTestId('your-name')).toHaveText(/Using your name, Alex\./);
	await expect(page.getByText('"Alex wants to…, but Alex knows…"')).toBeVisible();
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('app:self-control:prefs')!).name)
	).toBe('Alex');
});

test('Urge SOS: sprint, then wait out a 5-minute delay that survives a reload (#149)', async ({
	page
}) => {
	await page.clock.install({ time: new Date('2026-01-01T21:00:00') });
	await gotoHydrated(page, '/utils/self-control/sos');
	await page.getByRole('button', { name: 'Sprint' }).click();
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await page.getByRole('button', { name: 'Drink a glass of water' }).click();
	await expect(page.getByTestId('delay')).toContainText('Drink a glass of water: done.');
	await expect(page.getByTestId('delay-time')).toHaveText('5:00');

	await page.clock.runFor(60_000);
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(page.getByTestId('delay-time')).toHaveText(/^3:5\d|4:00$/);

	await page.clock.runFor(4 * 60_000);
	await expect(page.getByRole('heading', { name: 'Did you ride it out?' })).toBeVisible();
	await page.getByRole('button', { name: 'Yes' }).click();
	const [saved] = await log(page);
	expect(saved).toMatchObject({ technique: 'sprint', outcome: 'rode-out' });
	expect(saved).not.toHaveProperty('action');
});

test('Urge SOS: the timer rings and says so discreetly on other pages (#149)', async ({ page }) => {
	await page.clock.install({ time: new Date('2026-01-01T22:00:00') });
	await gotoHydrated(page, '/utils/self-control/sos');
	await page.getByRole('button', { name: '5 min', exact: true }).click();
	await page.getByRole('button', { name: 'Start surfing' }).click();
	await expect(page.getByTestId('surf-time')).toHaveText('5:00');

	const alert = page.getByTestId('sos-alert');
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click();
	await expect(page).toHaveURL(/\/$/);
	await page.clock.runFor(4 * 60_000);
	await expect(alert).toHaveCount(0);
	await page.clock.runFor(61_000);
	await expect(alert).toHaveText(/Your timer is done/);
	// Private: it names neither the tool nor the urge.
	await expect(alert).not.toContainText(/Self-Control|urge|SOS/i);

	// Dismissed, it stays gone; the session waits on its page.
	await alert.getByRole('button', { name: 'Dismiss' }).click();
	await expect(alert).toHaveCount(0);
	await page.clock.runFor(2_000);
	await expect(alert).toHaveCount(0);
	await gotoHydrated(page, '/utils/self-control/sos');
	await expect(page.getByRole('heading', { name: 'Did you ride it out?' })).toBeVisible();

	// Open takes you there.
	await page.getByRole('button', { name: 'Yes' }).click();
	await expect(page.getByTestId('sos-done')).toBeVisible();
	await gotoHydrated(page, '/utils/self-control/sos');
	await page.getByRole('button', { name: 'Sprint' }).click();
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await page.getByRole('button', { name: 'Drink a glass of water' }).click();
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Utils' }).click();
	await page.clock.runFor(5 * 60_000 + 1_000);
	await alert.getByRole('link', { name: 'Open timer' }).click();
	await expect(page.getByRole('heading', { name: 'Did you ride it out?' })).toBeVisible();
	await expect(alert).toHaveCount(0);
});

test('Urge SOS: change or forget the name self-talk uses (#149)', async ({ page }) => {
	await page.addInitScript(() => {
		if (!localStorage.getItem('app:self-control:prefs'))
			localStorage.setItem('app:self-control:prefs', JSON.stringify({ name: 'Alex' }));
	});
	await gotoHydrated(page, '/utils/self-control/sos');
	await page.getByRole('button', { name: 'Talk to yourself like a friend' }).click();
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await expect(page.getByTestId('your-name')).toHaveText(/Using your name, Alex\./);

	await page.getByRole('button', { name: 'Change' }).click();
	await expect(page.getByLabel(/Your name, for these prompts/)).toHaveValue('Alex');
	await page.getByLabel(/Your name, for these prompts/).fill('Sam');
	await page.getByRole('button', { name: 'Use my name' }).click();
	await expect(page.getByText('"Sam wants to…, but Sam knows…"')).toBeVisible();

	await page.getByRole('button', { name: 'Change' }).click();
	await page.getByRole('button', { name: 'Forget my name' }).click();
	await expect(page.getByText('Name forgotten.')).toBeVisible();
	await expect(page.getByText(/using your name: "Sam wants to/)).toBeVisible();
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('app:self-control:prefs')!))
	).not.toHaveProperty('name');
});
