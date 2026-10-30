// The Camera tool (#210), with Chromium's fake camera: photos stay in the app.
import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

// A per-file `launchOptions` replaces the config's, so this repeats its flag (and a local
// Chromium, where CHROMIUM_PATH names one).
test.use({
	viewport: { width: 390, height: 844 },
	permissions: ['camera'],
	launchOptions: {
		executablePath: process.env.CHROMIUM_PATH || undefined,
		args: ['--disable-gpu', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
	}
});

test('takes a photo that stays in the app through a reload, then deletes it', async ({ page }) => {
	// Nothing leaves the app's own origin (the preview server's).
	const away: string[] = [];
	page.on('request', (request) => {
		const target = new URL(request.url());
		if (!['data:', 'blob:'].includes(target.protocol) && target.host !== 'localhost:4173')
			away.push(request.url());
	});
	await gotoHydrated(page, '/utils/camera');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Camera$/);
	await expect(page.getByTestId('photos')).toContainText('No photos yet.');

	await page.getByRole('button', { name: 'Turn on camera' }).click();
	await page.getByRole('button', { name: 'Take photo' }).click();
	await expect(page.getByText('Photo saved in the app.')).toBeVisible();
	const tiles = page.getByRole('list', { name: 'Photos' }).getByRole('button');
	await expect(tiles).toHaveCount(1);

	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(tiles).toHaveCount(1);
	await expect(tiles.locator('img[src^="blob:"]')).toHaveCount(1);

	await tiles.first().click();
	await page.getByTestId('photo-viewer').getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByTestId('photos')).toContainText('No photos yet.');
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(page.getByTestId('photos')).toContainText('No photos yet.');
	expect(away).toEqual([]);
});

test('says what stays private, and stays out of Recently used', async ({ page }) => {
	await gotoHydrated(page, '/utils/camera');
	const note = page.getByTestId('camera-note');
	await note.getByText('What stays private').click();
	await expect(note).toContainText(
		'With a passcode set in Settings → Privacy, the Camera opens only after unlocking and its photos are encrypted on this device.'
	);

	await gotoHydrated(page, '/utils/coffee-timer');
	await gotoHydrated(page, '/utils/camera');
	await gotoHydrated(page, '/');
	await expect(page.getByTestId('recent').getByRole('link')).toHaveText([/Coffee Timer$/]);
});

test('Settings lists photos under Camera, and clearing it removes them', async ({ page }) => {
	page.on('dialog', (dialog) => dialog.accept());
	await gotoHydrated(page, '/utils/camera');
	await page.getByRole('button', { name: 'Turn on camera' }).click();
	await page.getByRole('button', { name: 'Take photo' }).click();
	await expect(page.getByRole('list', { name: 'Photos' }).getByRole('button')).toHaveCount(1);

	await gotoHydrated(page, '/settings');
	// The group is labelled "Camera" (its Clear button says so) and counts each photo's file.
	const clear = page.getByRole('button', { name: 'Clear Camera' });
	const group = page.getByRole('listitem').filter({ has: clear });
	await expect(group.getByTestId('files-note')).toHaveText([
		/^Photos: 1 file, /,
		/^Photos \(thumbnails\): 1 file, /
	]);
	await expect(group.getByTestId('backup-note')).toHaveText('Not in backups');
	await clear.click();
	await expect(group.getByTestId('files-note')).toHaveCount(0);

	await gotoHydrated(page, '/utils/camera');
	await expect(page.getByTestId('photos')).toContainText('No photos yet.');
});
