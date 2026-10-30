// The passcode lock and the vault (#263): with a passcode set in Settings → Privacy, the private
// tools open only after unlocking, and Self-Control's data is encrypted on the device and in
// backups.
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

const CODE = '246810';
const HABIT = 'Phone in bed';

/** Adds a Self-Control habit named `HABIT`, saved as plaintext since no passcode is set yet. */
async function addHabit(page: Page) {
	await gotoHydrated(page, '/utils/self-control');
	await page.getByRole('button', { name: 'Add a habit' }).click();
	await page.getByRole('button', { name: 'Something else' }).click();
	await page.getByLabel('Habit', { exact: true }).fill(HABIT);
	await page.getByRole('button', { name: 'Add habit' }).click();
	await expect(page.getByText('Habit added.')).toBeVisible();
	expect(await stored(page)).toContain(HABIT);
}

/** Sets the passcode in Settings → Privacy and returns the lock's controls. */
async function setUpLock(page: Page) {
	await gotoHydrated(page, '/settings');
	const lock = page.getByTestId('passcode-lock');
	await expect(page.getByTestId('lock-encryption')).toContainText('Self-Control');
	await lock.getByRole('button', { name: 'Set a passcode' }).click();
	await lock.getByLabel('Passcode', { exact: true }).fill(CODE);
	await lock.getByLabel('Same again').fill(CODE);
	await lock.getByRole('button', { name: 'Save passcode' }).click();
	await expect(page.getByTestId('lock-status')).toHaveText('The passcode lock is on and unlocked.');
	await expect(page.getByTestId('lock-encryption')).toContainText(
		'is encrypted on this device with the passcode'
	);
	return lock;
}

/** Everything the app keeps on the device, as text: localStorage and every IndexedDB record. */
const stored = (page: Page) =>
	page.evaluate(async () => {
		const parts = [JSON.stringify({ ...localStorage })];
		for (const { name } of await indexedDB.databases()) {
			if (!name) continue;
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const r = indexedDB.open(name);
				r.onsuccess = () => resolve(r.result);
				r.onerror = () => reject(r.error);
			});
			for (const store of db.objectStoreNames) {
				const rows = await new Promise<unknown[]>((resolve, reject) => {
					const r = db.transaction(store).objectStore(store).getAll();
					r.onsuccess = () => resolve(r.result);
					r.onerror = () => reject(r.error);
				});
				for (const row of rows) {
					parts.push(JSON.stringify(row));
					for (const value of Object.values(row as object))
						if (value instanceof Blob) parts.push(await value.text());
				}
			}
			db.close();
		}
		return parts.join('\n');
	});

/** Opens Self-Control through the app's links: once a passcode is set every load starts locked. */
async function openSelfControl(page: Page) {
	await page.getByRole('link', { name: /Utils/ }).first().click();
	await page
		.getByRole('link', { name: /Self-Control/ })
		.first()
		.click();
}

async function unlock(page: Page, code = CODE) {
	const screen = page.getByTestId('unlock');
	await screen.getByLabel('Passcode').fill(code);
	await screen.getByRole('button', { name: 'Unlock' }).click();
}

/** Downloads what `click` saves and reads it as JSON. */
async function downloaded(page: Page, click: () => Promise<void>) {
	const download = page.waitForEvent('download');
	await click();
	return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}

test('with a passcode, Self-Control opens on /unlock and its data is encrypted while locked', async ({
	page
}) => {
	await addHabit(page);
	await setUpLock(page);
	// Sealed as soon as the passcode is set.
	await expect.poll(() => stored(page)).not.toContain(HABIT);

	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await openSelfControl(page);
	await expect(page).toHaveURL(/\/unlock$/);
	await expect(page.locator('h1')).toHaveText('Locked');
	// Locked: nothing the app keeps holds the habit in plaintext.
	expect(await stored(page)).not.toContain(HABIT);

	await unlock(page, '000000');
	await expect(page.getByTestId('unlock')).toContainText('Wrong passcode.');
	await unlock(page);
	await expect(page).toHaveURL(/\/utils\/self-control$/);
	await expect(page.getByTestId('habit')).toContainText(HABIT);
	// Open in memory only: still sealed on the device.
	expect(await stored(page)).not.toContain(HABIT);
});

test('backups carry Self-Control only encrypted, and import it with the passcode', async ({
	page
}) => {
	page.on('dialog', (dialog) => dialog.accept());
	await addHabit(page);
	await setUpLock(page);

	const backup = await downloaded(page, () =>
		page.getByRole('button', { name: 'Download backup' }).click()
	);
	expect(backup.format).toBe(3);
	expect(JSON.stringify(backup)).not.toContain(HABIT);
	expect(backup.data).not.toHaveProperty('app:self-control:habits');
	expect(Object.keys(backup.sections.vault.groups)).toContain('self-control');

	// Delete the habit, then bring it back from the backup.
	await openSelfControl(page);
	await page.getByRole('button', { name: `Edit ${HABIT}` }).click();
	await page.getByRole('button', { name: 'Delete habit' }).click();
	await expect(page.getByTestId('habit')).toHaveCount(0);

	await page
		.getByRole('link', { name: /Settings/ })
		.first()
		.click();
	await page.getByLabel('Backup file').setInputFiles({
		name: 'backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(backup))
	});
	const preview = page.getByTestId('import-preview');
	const form = preview.getByTestId('import-sealed');
	await expect(form).toContainText('Self-Control');
	await form.getByLabel(/Enter the passcode/).fill('000000');
	await form.getByRole('button', { name: 'Open' }).click();
	await expect(form.getByRole('alert')).toHaveText(
		"That isn't the passcode this backup was made with."
	);
	await form.getByLabel(/Enter the passcode/).fill(CODE);
	await form.getByRole('button', { name: 'Open' }).click();
	await expect(preview.getByTestId('import-sealed')).toHaveCount(0);
	await preview.getByRole('button', { name: 'Merge' }).click();
	await expect(page.getByTestId('toast').filter({ hasText: /^Imported/ })).toBeVisible();

	await openSelfControl(page);
	await expect(page.getByTestId('habit')).toContainText(HABIT);
	expect(await stored(page)).not.toContain(HABIT);
});

test('forgot passcode clears only the private data', async ({ page }) => {
	await addHabit(page);
	// Something that isn't private: the theme setting.
	await gotoHydrated(page, '/settings');
	await page.getByRole('radio', { name: 'Dark' }).click();
	await setUpLock(page);
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await openSelfControl(page);
	await expect(page).toHaveURL(/\/unlock$/);

	const forgot = page.getByTestId('lock-forgot');
	await forgot.getByRole('button', { name: 'Forgot passcode?' }).click();
	await expect(page.getByTestId('lock-forgot-groups')).toContainText('Self-Control');
	await forgot.getByRole('button', { name: 'Reset the lock' }).click();
	await forgot.getByRole('button', { name: 'Clear and reset' }).click();
	await expect(page).toHaveURL(/\/utils\/self-control$/);
	await expect(page.getByTestId('habit')).toHaveCount(0);

	const saved = await page.evaluate(() => ({ ...localStorage }));
	expect(saved['app:self-control:habits']).toBeUndefined();
	expect(Object.keys(saved).filter((k) => k.includes(':sealed:'))).toEqual([]);
	expect(saved['app:lock:verifier']).toBeUndefined();
	expect(JSON.parse(saved['app:settings']!).theme).toBe('dark');
});

test('turning the lock off writes the data back as plaintext', async ({ page }) => {
	await addHabit(page);
	const lock = await setUpLock(page);
	await expect.poll(() => stored(page)).not.toContain(HABIT);

	// Your data names the lock's group.
	await expect(page.getByRole('button', { name: /^Clear Passcode lock/ })).toBeVisible();

	await lock.getByRole('button', { name: 'Turn off' }).click();
	await lock.getByLabel('Current passcode').fill(CODE);
	await page.getByTestId('lock-form').getByRole('button', { name: 'Turn off' }).click();
	await expect(lock.getByRole('button', { name: 'Set a passcode' })).toBeVisible();
	expect(await stored(page)).toContain(HABIT);

	// No passcode: no lock.
	await gotoHydrated(page, '/utils/self-control');
	await expect(page).toHaveURL(/\/utils\/self-control$/);
	await expect(page.getByTestId('habit')).toContainText(HABIT);
});
