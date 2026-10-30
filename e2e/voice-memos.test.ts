// The Voice memos tool (#214), with Chromium's fake microphone: recordings stay on the device.
import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

// A per-file `launchOptions` replaces the config's, so this repeats its flag (and a local
// Chromium, where CHROMIUM_PATH names one).
test.use({
	viewport: { width: 390, height: 844 },
	permissions: ['microphone'],
	launchOptions: {
		executablePath: process.env.CHROMIUM_PATH || undefined,
		args: ['--disable-gpu', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
	}
});

/** Records about a second from the fake microphone and saves it. */
async function record(page: Page) {
	const recorder = page.getByTestId('recorder');
	await recorder.getByRole('button', { name: 'Record' }).click();
	await expect(recorder).toHaveAttribute('data-state', 'recording');
	await expect(page.getByTestId('recorder-time')).toHaveText('0:01');
	await recorder.getByRole('button', { name: 'Stop and save' }).click();
	await expect(page.getByTestId('recorder-status')).toHaveText('Recording saved.');
}

const reload = async (page: Page) => {
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
};

test('records a memo that plays, survives a reload, is renamed and deleted', async ({ page }) => {
	// Nothing leaves the app's own origin (the preview server's).
	const away: string[] = [];
	page.on('request', (request) => {
		const target = new URL(request.url());
		if (!['data:', 'blob:'].includes(target.protocol) && target.host !== 'localhost:4173')
			away.push(request.url());
	});
	await gotoHydrated(page, '/utils/voice-memos');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Voice memos$/);
	await expect(page.getByTestId('recordings')).toContainText('No recordings yet.');

	await record(page);
	const items = page.getByRole('list', { name: 'Recordings' }).getByRole('listitem');
	await expect(items).toHaveCount(1);
	// Named by when it was recorded until renamed.
	await expect(items.first()).toContainText(/^Recording, /);

	await reload(page);
	await expect(items).toHaveCount(1);
	await items
		.first()
		.getByRole('button', { name: /^Play / })
		.click();
	const player = page.getByTestId('player');
	await expect(player).toHaveAttribute('src', /^blob:/);
	// It's a file the browser can play: it loads with a length.
	await expect
		.poll(() => player.evaluate((el: HTMLAudioElement) => el.readyState))
		.toBeGreaterThan(0);

	await items
		.first()
		.getByRole('button', { name: /^Rename / })
		.click();
	await items.first().getByLabel('Name').fill('Groceries');
	await items.first().getByRole('button', { name: 'Save name' }).click();
	await expect(items.first()).toContainText('Groceries');
	await reload(page);
	await expect(items.first()).toContainText('Groceries');

	await page.getByRole('button', { name: 'Delete Groceries' }).click();
	await expect(page.getByTestId('recordings')).toContainText('No recordings yet.');
	await reload(page);
	await expect(page.getByTestId('recordings')).toContainText('No recordings yet.');
	expect(away).toEqual([]);
});

test('says what stays private, and stays out of Recently used', async ({ page }) => {
	await gotoHydrated(page, '/utils/voice-memos');
	await expect(page.getByTestId('voice-memos-background')).toContainText(
		'On iPhone, recording stops if you leave the app'
	);
	const note = page.getByTestId('voice-memos-note');
	await note.getByText('What stays private').click();
	await expect(note).toContainText(
		'With a passcode set in Settings → Privacy, Voice memos opens only after unlocking'
	);

	await gotoHydrated(page, '/utils/coffee-timer');
	await gotoHydrated(page, '/utils/voice-memos');
	await gotoHydrated(page, '/');
	await expect(page.getByTestId('recent').getByRole('link')).toHaveText([/Coffee Timer$/]);
});

test('Settings lists recordings under Voice memos, out of backups, and clearing it removes them', async ({
	page
}) => {
	page.on('dialog', (dialog) => dialog.accept());
	await gotoHydrated(page, '/utils/voice-memos');
	await record(page);

	await gotoHydrated(page, '/settings');
	const clear = page.getByRole('button', { name: 'Clear Voice memos' });
	const group = page.getByRole('listitem').filter({ has: clear });
	await expect(group.getByTestId('files-note')).toHaveText([/^Recordings: 1 file, /]);
	await expect(group.getByTestId('backup-note')).toHaveText('Not in backups');
	await clear.click();
	await expect(group.getByTestId('files-note')).toHaveCount(0);

	await gotoHydrated(page, '/utils/voice-memos');
	await expect(page.getByTestId('recordings')).toContainText('No recordings yet.');
});

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

test('with a passcode, Voice memos opens on /unlock and its recordings are encrypted', async ({
	page
}) => {
	const NAME = 'Dentist on Tuesday';
	const CODE = '246810';
	await gotoHydrated(page, '/utils/voice-memos');
	await record(page);
	const items = page.getByRole('list', { name: 'Recordings' }).getByRole('listitem');
	await items
		.first()
		.getByRole('button', { name: /^Rename / })
		.click();
	await items.first().getByLabel('Name').fill(NAME);
	await items.first().getByRole('button', { name: 'Save name' }).click();
	await expect(items.first()).toContainText(NAME);
	expect(await stored(page)).toContain(NAME);

	await gotoHydrated(page, '/settings');
	await expect(page.getByTestId('lock-encryption')).toContainText('Voice memos');
	const lock = page.getByTestId('passcode-lock');
	await lock.getByRole('button', { name: 'Set a passcode' }).click();
	await lock.getByLabel('Passcode', { exact: true }).fill(CODE);
	await lock.getByLabel('Same again').fill(CODE);
	await lock.getByRole('button', { name: 'Save passcode' }).click();
	await expect(page.getByTestId('lock-status')).toHaveText('The passcode lock is on and unlocked.');
	// Sealed as soon as the passcode is set.
	await expect.poll(() => stored(page)).not.toContain(NAME);

	// Once a passcode is set every load starts locked; open the tool through the app's links.
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await page.getByRole('link', { name: /Utils/ }).first().click();
	await page
		.getByRole('link', { name: /Voice memos/ })
		.first()
		.click();
	await expect(page).toHaveURL(/\/unlock$/);
	expect(await stored(page)).not.toContain(NAME);

	const screen = page.getByTestId('unlock');
	await screen.getByLabel('Passcode').fill(CODE);
	await screen.getByRole('button', { name: 'Unlock' }).click();
	await expect(page).toHaveURL(/\/utils\/voice-memos$/);
	await expect(items.first()).toContainText(NAME);
	// Open in memory only: still sealed on the device.
	expect(await stored(page)).not.toContain(NAME);
});
