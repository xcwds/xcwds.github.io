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

test('Your why: reasons per habit and in general, starred first in Urge SOS (#150)', async ({
	page
}) => {
	await gotoHydrated(page, '/utils/self-control');
	await page.getByRole('button', { name: 'Add a habit' }).click();
	await page.getByRole('button', { name: '🍪 Snacking' }).click();
	await page.getByRole('button', { name: 'Add habit' }).click();
	await page.getByRole('link', { name: /Your why/ }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your why$/);

	// General reasons, with prompts until there's one.
	const reasons = page.getByTestId('reason');
	await expect(page.getByTestId('why-prompts')).toContainText('Who else benefits?');
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page.getByRole('alert')).toHaveText('Write a reason first.');
	await page.getByLabel('Add a reason').fill('I want to feel in charge of my day');
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(reasons).toHaveCount(1);
	await expect(page.getByTestId('why-prompts')).toHaveCount(0);

	// A habit's own reasons: add, reorder, edit, star.
	await page.getByRole('button', { name: '🍪 Snacking' }).click();
	await expect(reasons).toHaveCount(0);
	for (const text of ['Less sugar crash', 'Save money', 'Feel lighter']) {
		await page.getByLabel('Add a reason').fill(text);
		await page.getByRole('button', { name: 'Add', exact: true }).click();
	}
	await expect(reasons).toHaveCount(3);
	await page.getByRole('button', { name: 'Move up: Save money' }).click();
	await expect(reasons.first()).toContainText('Save money');
	await page.getByRole('button', { name: 'Edit: Less sugar crash' }).click();
	await page.getByLabel('Reason', { exact: true }).fill('No 3pm sugar crash');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await page.getByRole('button', { name: 'Star: Feel lighter' }).click();
	await expect(page.getByRole('button', { name: 'Star: Feel lighter' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// A note to your future self.
	const note = page.getByTestId('why-note');
	await note.getByRole('textbox').fill('You always feel better after the walk.');
	await note.getByRole('button', { name: 'Save note' }).click();
	await expect(page.getByText('Note saved.')).toBeVisible();

	// Kept across a reload; then delete one.
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await page.getByRole('button', { name: '🍪 Snacking' }).click();
	await expect(reasons).toHaveText([/Save money/, /No 3pm sugar crash/, /Feel lighter/]);
	await expect(note.getByRole('textbox')).toHaveValue('You always feel better after the walk.');
	await page.getByRole('button', { name: 'Edit: Save money' }).click();
	await page.getByRole('button', { name: 'Delete' }).click();
	await expect(reasons).toHaveCount(2);

	// Urge SOS shows them for the habit: its starred reason first, then the rest, then general.
	await gotoHydrated(page, '/utils/self-control/sos');
	await page.getByRole('button', { name: '🍪 Snacking' }).click();
	await page.getByRole('button', { name: 'Start surfing' }).click();
	const card = page.getByTestId('sos-why');
	await card.getByText('Your why').click();
	await expect(card).toContainText('A note from you');
	await expect(card).toContainText('You always feel better after the walk.');
	await expect(card.getByRole('listitem')).toHaveText([
		/Feel lighter/,
		/No 3pm sugar crash/,
		/I want to feel in charge of my day/
	]);
});

test('Decision Seesaw: weigh both sides per habit, see it tilt and show up in Urge SOS (#151)', async ({
	page
}) => {
	await gotoHydrated(page, '/utils/self-control/seesaw');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Decision Seesaw$/);
	await expect(page.getByRole('link', { name: 'Add a habit' })).toBeVisible();

	await gotoHydrated(page, '/utils/self-control');
	for (const starter of ['🍪 Snacking', '📱 Doomscrolling']) {
		await page.getByRole('button', { name: 'Add a habit' }).click();
		await page.getByRole('button', { name: starter }).click();
		await page.getByRole('button', { name: 'Add habit' }).click();
	}
	await page.getByRole('link', { name: /Decision Seesaw/ }).click();
	const lean = page.getByTestId('lean');
	await expect(lean).toHaveText(/^Empty/);

	const side = (id: string) => page.getByTestId(`side-${id}`);
	const add = async (id: string, text: string, weight?: string) => {
		await side(id).getByRole('textbox').fill(text);
		if (weight)
			await side(id).getByRole('group').last().getByRole('button', { name: weight }).click();
		await side(id).getByRole('button', { name: 'Add' }).click();
	};

	// Snacking is the first habit, so it's shown.
	await add('give-now', 'Comfort', 'Hugely');
	await expect(lean).toHaveText('Leans toward giving in');
	await add('give-later', 'Sugar crash', 'Hugely');
	await expect(lean).toHaveText('Balanced');
	await add('hold-later', 'Energy all afternoon', 'Hugely');
	await expect(lean).toHaveText('Leans toward holding off');
	await add('hold-now', 'Boredom', 'A little');

	// Validation stays inline.
	await side('hold-now').getByRole('button', { name: 'Add' }).click();
	await expect(side('hold-now').getByRole('alert')).toHaveText('Write something first.');

	// Reweigh, edit and delete.
	await side('give-now')
		.getByRole('group', { name: 'How much: Comfort' })
		.getByRole('button', { name: 'A little' })
		.click();
	await page.getByRole('button', { name: 'Edit: Boredom' }).click();
	await side('hold-now').getByLabel('Edit').fill('Feeling left out');
	await side('hold-now').getByRole('button', { name: 'Save' }).click();
	await expect(side('hold-now')).toContainText('Feeling left out');
	await page.getByRole('button', { name: 'Edit: Feeling left out' }).click();
	await side('hold-now').getByRole('button', { name: 'Delete' }).click();
	await expect(side('hold-now').getByTestId('seesaw-item')).toHaveCount(0);
	await expect(page.getByText('Deleted.')).toBeVisible();

	// Each habit has its own seesaw, kept across a reload.
	await page.getByRole('button', { name: '📱 Doomscrolling' }).click();
	await expect(page.getByTestId('seesaw-item')).toHaveCount(0);
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(side('give-now')).toContainText('Comfort');
	await expect(
		side('give-now').getByRole('group', { name: 'How much: Comfort' }).getByRole('button', {
			name: 'A little'
		})
	).toHaveAttribute('aria-pressed', 'true');
	await expect(lean).toHaveText('Leans toward holding off');

	// Urge SOS shows the later side for the habit.
	await gotoHydrated(page, '/utils/self-control/sos');
	await page.getByRole('button', { name: '🍪 Snacking' }).click();
	await page.getByRole('button', { name: 'Start surfing' }).click();
	const card = page.getByTestId('sos-seesaw');
	await card.getByText('Your seesaw').click();
	await expect(card).toContainText('Giving in costs you later');
	await expect(card).toContainText('Sugar crash');
	await expect(card).toContainText('Energy all afternoon');
	await expect(card).not.toContainText('Comfort');
});

test('Cue Audit: log urges with what set them off, see patterns, edit and delete (#147)', async ({
	page
}) => {
	await page.clock.install({ time: new Date('2026-03-04T20:30:00') });
	await gotoHydrated(page, '/utils/self-control');
	await page.getByRole('button', { name: 'Add a habit' }).click();
	await page.getByRole('button', { name: '🍪 Snacking' }).click();
	await page.getByRole('button', { name: 'Add habit' }).click();
	await page.getByRole('link', { name: /Cue Audit/ }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Cue Audit$/);
	await expect(page.getByTestId('patterns-wait')).toHaveText(
		'Log a few more to see patterns (0 of 5).'
	);

	const form = page.getByRole('region', { name: 'Log an urge' });
	// Validation stays inline.
	await form.getByRole('button', { name: 'Log it' }).click();
	await expect(form.getByRole('alert')).toHaveText('Pick how it went.');

	const logUrge = async (outcome: string, cues: Record<string, string[]>, own?: string) => {
		await form.getByRole('button', { name: '🍪 Snacking' }).click();
		await form.getByRole('button', { name: outcome, exact: true }).click();
		const fields = form.getByTestId('cue-fields');
		if (!(await fields.evaluate((d) => (d as HTMLDetailsElement).open)))
			await form.getByText('What was going on? (optional)').click();
		for (const [field, chips] of Object.entries(cues))
			for (const chip of chips)
				await form
					.getByTestId(`cue-${field}`)
					.getByRole('button', { name: chip, exact: true })
					.click();
		if (own) {
			await form.getByRole('textbox', { name: 'Your own: Where' }).fill(own);
			await form.getByRole('button', { name: 'Add your own: Where' }).click();
		}
		await form.getByRole('button', { name: 'Log it' }).click();
		await expect(page.getByText('Logged.').last()).toBeVisible();
	};

	await logUrge('Gave in', { where: ['Kitchen'], feeling: ['Bored'] });
	await logUrge('Gave in', { where: ['Kitchen'], feeling: ['Bored', 'Tired'] });
	await logUrge('Rode it out', { feeling: ['Tired'] });
	await logUrge('Partly', { feeling: ['Bored'] }, 'Office');
	await expect(page.getByTestId('patterns-wait')).toHaveText(
		'Log a few more to see patterns (4 of 5).'
	);
	// Your own chip is offered first next time.
	await form.getByText('What was going on? (optional)').click();
	await expect(form.getByTestId('cue-where').getByRole('button').first()).toHaveText('Office');
	await logUrge('Gave in', { where: ['Office'] });

	const patterns = page.getByTestId('patterns');
	await expect(patterns.getByRole('listitem').filter({ hasText: '8pm–12am' })).toContainText(
		'5 urges'
	);
	await expect(patterns.getByRole('listitem').filter({ hasText: 'Wed' })).toContainText('5 urges');
	await expect(page.getByTestId('top-cues')).toContainText('Bored: 60% of urges, gave in 2 of 3');
	await expect(page.getByTestId('top-cues')).toContainText('Kitchen: 40% of urges, gave in 2 of 2');
	await expect(page.getByTestId('riskiest')).toContainText('Kitchen + Bored: gave in 2 times');

	// Edit the newest urge, then delete it; both stick across a reload.
	const urges = page.getByTestId('urge');
	await expect(urges).toHaveCount(5);
	await urges
		.first()
		.getByRole('button', { name: /^Edit the urge/ })
		.click();
	await urges.first().getByRole('button', { name: 'Rode it out' }).click();
	await urges.first().getByTestId('cue-feeling').getByRole('button', { name: 'Stressed' }).click();
	await urges.first().getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved.')).toBeVisible();
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(urges.first()).toContainText('Rode it out');
	await expect(urges.first().getByTestId('urge-cues')).toHaveText('Office · Stressed');
	await urges
		.first()
		.getByRole('button', { name: /^Edit the urge/ })
		.click();
	await urges.first().getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByText('Deleted.')).toBeVisible();
	await expect(urges).toHaveCount(4);
	expect(await log(page)).toHaveLength(4);
});

test('Urge SOS: add what set it off after an urge, in the Cue Audit (#147)', async ({ page }) => {
	await gotoHydrated(page, '/utils/self-control/sos');
	await page.getByRole('button', { name: 'Start surfing' }).click();
	await page.getByRole('button', { name: 'It passed' }).click();
	await page.getByRole('button', { name: 'Yes' }).click();
	await page.getByRole('link', { name: 'Add what set it off' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Cue Audit$/);
	await expect(page).toHaveURL(/\/utils\/self-control\/cues$/);

	const [before] = await log(page);
	const urge = page.getByTestId('urge');
	await expect(urge.getByTestId('cue-fields')).toHaveAttribute('open', '');
	await urge.getByTestId('cue-trigger').getByRole('button', { name: 'A notification' }).click();
	await urge.getByRole('button', { name: 'Save' }).click();
	await expect(urge.getByTestId('urge-cues')).toHaveText('A notification');
	await expect(urge).toContainText('Surf it');
	const [saved] = await log(page);
	// An untouched time keeps the session's exact start.
	expect(saved).toMatchObject({
		at: before.at,
		technique: 'surf',
		cues: { trigger: ['A notification'] }
	});
});

test('Environment Designer: a checklist per habit and if-then plans shown in Urge SOS (#152)', async ({
	page
}) => {
	await gotoHydrated(page, '/utils/self-control/environment');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Environment Designer$/);
	await expect(page.getByRole('link', { name: 'Add a habit' })).toBeVisible();

	await gotoHydrated(page, '/utils/self-control');
	for (const starter of ['🍪 Snacking', '📱 Doomscrolling']) {
		await page.getByRole('button', { name: 'Add a habit' }).click();
		await page.getByRole('button', { name: starter }).click();
		await page.getByRole('button', { name: 'Add habit' }).click();
	}
	await page.getByRole('link', { name: /Environment Designer/ }).click();

	// Snacking is the first habit: its starter list plus the generic one.
	const progress = page.getByTestId('checklist-progress');
	await expect(progress).toHaveText('0 of 12 done');
	await page.getByRole('checkbox', { name: 'Put fruit on the counter' }).check();
	await expect(progress).toHaveText('1 of 12 done');
	await page
		.getByRole('button', { name: 'Not for me: Buy single portions, not family packs' })
		.click();
	await expect(progress).toHaveText('1 of 11 done');
	await page.getByTestId('hidden-items').getByText('Not for me (1)').click();
	await page
		.getByRole('button', { name: 'Restore: Buy single portions, not family packs' })
		.click();
	await expect(progress).toHaveText('1 of 12 done');

	// Your own items, with inline validation.
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page.getByTestId('checklist').getByRole('alert')).toHaveText(
		'Write something first.'
	);
	await page.getByLabel('Add your own').fill('Keep nuts in the desk drawer');
	await page.getByLabel('Group').selectOption({ label: 'Make the better option easy' });
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page.getByTestId('group-easy')).toContainText('Keep nuts in the desk drawer');
	await expect(progress).toHaveText('1 of 13 done');
	await page.getByRole('button', { name: 'Delete: Keep nuts in the desk drawer' }).click();
	await expect(progress).toHaveText('1 of 12 done');
	// Up to 30 of your own per habit.
	await page.evaluate(() => {
		const key = 'app:self-control:plan';
		const env = JSON.parse(localStorage.getItem(key)!);
		const [habit] = Object.keys(env);
		env[habit!].custom = Array.from({ length: 30 }, (_, i) => ({
			id: `c${i}`,
			group: 'hide',
			text: `Item ${i}`
		}));
		localStorage.setItem(key, JSON.stringify(env));
	});
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await page.getByLabel('Add your own').fill('One more');
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page.getByTestId('checklist').getByRole('alert')).toHaveText(
		"That's 30 of your own already. Delete one first."
	);
	await page.evaluate(() => {
		const key = 'app:self-control:plan';
		const env = JSON.parse(localStorage.getItem(key)!);
		for (const plan of Object.values(env) as { custom: unknown[] }[]) plan.custom = [];
		localStorage.setItem(key, JSON.stringify(env));
	});
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(progress).toHaveText('1 of 12 done');

	// An if-then plan, with an action from what you've done.
	const form = page.getByTestId('plan-form');
	await form.getByRole('button', { name: 'Add plan' }).click();
	await expect(form.getByRole('alert')).toHaveText([
		'Write something first.',
		'Write something first.'
	]);
	await form.getByLabel('If…').fill('I get home hungry');
	await form.getByRole('button', { name: 'Put fruit on the counter' }).click();
	await form.getByRole('button', { name: 'Add plan' }).click();
	const plan = page.getByTestId('plan');
	await expect(plan).toHaveText(/If I get home hungry, then I will put fruit on the counter\./);
	await plan.getByRole('button', { name: /^Star:/ }).click();
	await expect(plan.getByRole('button', { name: /^Star:/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// Each habit has its own, kept across a reload.
	await page.getByRole('button', { name: '📱 Doomscrolling' }).click();
	await expect(page.getByTestId('plan')).toHaveCount(0);
	await expect(
		page.getByRole('checkbox', { name: 'Turn off non-essential notifications' })
	).toBeVisible();
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(page.getByRole('checkbox', { name: 'Put fruit on the counter' })).toBeChecked();
	await expect(plan).toHaveCount(1);

	// Urge SOS shows the starred plan for the habit.
	await gotoHydrated(page, '/utils/self-control/sos');
	await page.getByRole('button', { name: '🍪 Snacking' }).click();
	await page.getByRole('button', { name: 'Start surfing' }).click();
	await expect(page.getByTestId('sos-plans')).toContainText(
		'If I get home hungry, then I will put fruit on the counter.'
	);
});

test('Cue Audit: plan for a top cue in the Environment Designer (#147, #152)', async ({ page }) => {
	await gotoHydrated(page, '/utils/self-control');
	await page.getByRole('button', { name: 'Add a habit' }).click();
	await page.getByRole('button', { name: '🍪 Snacking' }).click();
	await page.getByRole('button', { name: 'Add habit' }).click();
	await page.evaluate(() => {
		const habit = JSON.parse(localStorage.getItem('app:self-control:habits')!)[0].id;
		const log = Array.from({ length: 5 }, (_, i) => ({
			id: `u${i}`,
			at: Date.now() - i * 3_600_000,
			habit,
			start: 5,
			outcome: 'gave-in',
			cues: { where: ['Kitchen'] }
		}));
		localStorage.setItem('app:self-control:log', JSON.stringify(log));
	});
	await gotoHydrated(page, '/utils/self-control/cues');
	// Planning needs a habit: every urge together has no link.
	await expect(page.getByRole('link', { name: /^Plan for this/ })).toHaveCount(0);
	await page.getByRole('button', { name: '🍪 Snacking' }).last().click();
	await page.getByRole('link', { name: 'Plan for this: Kitchen' }).click();

	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Environment Designer$/);
	await expect(page).toHaveURL(/\/utils\/self-control\/environment$/);
	await expect(page.getByLabel('If…')).toHaveValue('Kitchen');
	// The items that help with the cue stand out.
	await expect(
		page.getByTestId('checklist-item').filter({ hasText: '(helps with Kitchen)' })
	).toHaveCount(4);
});

test.describe('Weekly review (#153)', () => {
	// Weeks follow the locale until Settings says otherwise: Monday here.
	test.use({ locale: 'de-DE' });

	test('sums up this week against last, shows what helps, and saves a reflection', async ({
		page
	}) => {
		// Wednesday 14 October 2026.
		await page.clock.install({ time: new Date('2026-10-14T12:00:00') });
		await gotoHydrated(page, '/utils/self-control');
		await page.evaluate(() => {
			const t = (s: string) => new Date(s).getTime();
			const kitchenBored = { where: ['Kitchen'], feeling: ['Bored'] };
			const log = [
				{ id: 'a', at: t('2026-10-06T09:00'), start: 3, outcome: 'rode-out' },
				{ id: 'b', at: t('2026-10-11T10:00'), start: 5, outcome: 'partly' }, // Sunday
				{
					id: 'c',
					at: t('2026-10-12T08:00'),
					start: 4,
					peak: 6,
					technique: 'surf',
					outcome: 'rode-out'
				},
				{ id: 'd', at: t('2026-10-12T20:00'), start: 6, technique: 'surf', outcome: 'rode-out' },
				{
					id: 'e',
					at: t('2026-10-13T21:00'),
					start: 7,
					technique: 'sprint',
					outcome: 'gave-in',
					cues: kitchenBored
				},
				{ id: 'f', at: t('2026-10-14T11:00'), start: 5, outcome: 'gave-in', cues: kitchenBored }
			];
			localStorage.setItem('app:self-control:log', JSON.stringify(log));
		});
		await page.getByRole('link', { name: /Weekly review/ }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Weekly review$/);

		await expect(page.getByTestId('encouragement')).toHaveText('You rode out 2 of 4 urges.');
		await expect(page.getByTestId('this-week-outcomes')).toHaveText(
			'rode out 2, partly 0, gave in 2'
		);
		await expect(page.getByTestId('last-week-outcomes')).toHaveText(
			'rode out 1, partly 1, gave in 0'
		);
		await expect(page.getByTestId('avg-peak')).toHaveText('5.5 / 10 (last week 4)');
		await expect(page.getByTestId('what-helps').getByRole('listitem')).toHaveText([
			'Surf it: rode out 2 of 2',
			'Sprint: rode out 0 of 1'
		]);
		const risky = page.getByTestId('risky-week');
		await expect(risky).toContainText('Kitchen + Bored: gave in 2 times');
		await expect(risky.getByRole('link', { name: 'Make a plan' })).toHaveAttribute(
			'href',
			/environment#cue=Kitchen$/
		);
		await expect(page.getByTestId('weeks-list').getByRole('listitem').first()).toContainText(
			'50% ridden out'
		);

		// A reflection, kept across a reload.
		const reflection = page.getByTestId('reflection');
		await reflection.getByLabel('What went well?').fill('Surfing in the morning');
		await reflection.getByLabel("What's one change for next week?").fill('Fruit on the counter');
		await reflection.getByRole('button', { name: 'Save reflection' }).click();
		await expect(page.getByText('Reflection saved.')).toBeVisible();
		await page.reload();
		await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
		await expect(reflection.getByLabel('What went well?')).toHaveValue('Surfing in the morning');
		await expect(reflection.getByRole('button', { name: 'Save reflection' })).toBeDisabled();

		// Weeks starting on Sunday move Sunday's urge into this week.
		await gotoHydrated(page, '/settings');
		await page.getByLabel('Week starts on').selectOption({ label: 'Sunday' });
		await gotoHydrated(page, '/utils/self-control/review');
		await expect(page.getByTestId('this-week-outcomes')).toHaveText(
			'rode out 2, partly 1, gave in 2'
		);
		await expect(page.getByTestId('encouragement')).toHaveText('You rode out 2 of 5 urges.');
		// That's a new week for reflections too.
		await expect(reflection.getByLabel('What went well?')).toHaveValue('');
	});

	test("a hard week gets a kind word, and the reflection shows last week's plan", async ({
		page
	}) => {
		await page.clock.install({ time: new Date('2026-10-14T12:00:00') });
		await gotoHydrated(page, '/utils/self-control');
		await page.evaluate(() => {
			const t = (s: string) => new Date(s).getTime();
			const log = ['gave-in', 'gave-in', 'rode-out'].map((outcome, i) => ({
				id: `u${i}`,
				at: t(`2026-10-13T0${i + 1}:00`),
				start: 5,
				outcome
			}));
			localStorage.setItem('app:self-control:log', JSON.stringify(log));
			localStorage.setItem(
				'app:self-control:review',
				JSON.stringify({ '2026-10-05': { change: 'Phone out of the bedroom' } })
			);
		});
		await gotoHydrated(page, '/utils/self-control/review');
		await expect(page.getByTestId('hard-week')).toContainText('A tough week happens');
		await expect(page.getByTestId('last-change')).toHaveText(
			'Last week you planned: Phone out of the bedroom'
		);
		await expect(page.getByTestId('what-helps')).toContainText('Work through an urge');
	});
});
