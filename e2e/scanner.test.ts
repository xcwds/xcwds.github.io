// The Document scanner (#215), with Chromium's fake camera playing a photo of a page: a light,
// slightly skewed page on a dark desk, so the scanner finds its corners. Nothing leaves the device.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

/**
 * A few frames of a 640 × 480 picture with a page in it, as a Y4M video. The page is taller than
 * A4 or Letter, so its shape doesn't pick the paper: the locale does.
 */
function pageVideo(): string {
	const width = 640;
	const height = 480;
	// Clockwise from the top left.
	const page = [
		[215, 50],
		[430, 60],
		[440, 440],
		[205, 430]
	] as const;
	const inside = (x: number, y: number) =>
		page.every(([ax, ay], i) => {
			const [bx, by] = page[(i + 1) % 4]!;
			return (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= 0;
		});
	const luma = Buffer.alloc(width * height, 40);
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) if (inside(x, y)) luma[y * width + x] = 235;
	const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128);
	const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma]);
	const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`);
	const file = join(mkdtempSync(join(tmpdir(), 'xcwds-scanner-')), 'page.y4m');
	writeFileSync(file, Buffer.concat([header, ...Array.from({ length: 10 }, () => frame)]));
	return file;
}

// A per-file `launchOptions` replaces the config's, so this repeats its flag (and a local
// Chromium, where CHROMIUM_PATH names one).
test.use({
	viewport: { width: 390, height: 844 },
	permissions: ['camera'],
	locale: 'en-US',
	launchOptions: {
		executablePath: process.env.CHROMIUM_PATH || undefined,
		args: [
			'--disable-gpu',
			'--use-fake-device-for-media-stream',
			'--use-fake-ui-for-media-stream',
			`--use-file-for-fake-video-capture=${pageVideo()}`
		]
	}
});

const reload = async (page: Page) => {
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
};

/** The pages' filters, in order: each page here is told apart by the filter that made it. */
const filters = (page: Page) =>
	page
		.getByTestId('scan-page')
		.evaluateAll((items) => items.map((i) => i.getAttribute('data-filter')));

/** Turns the camera on (the viewfinder starts off each time it shows) and takes a photo. */
async function takePhoto(page: Page) {
	await page.getByRole('button', { name: 'Turn on camera' }).click();
	await page.getByRole('button', { name: 'Take photo' }).click();
	await expect(page.getByTestId('crop')).toBeVisible();
	await expect(page.getByText('Found the page.')).toBeVisible();
}

/** Takes a photo, checks the scanner found the page in it, and adds it with `filter`. */
async function scanPage(page: Page, filter: string, button = 'Add page') {
	await takePhoto(page);
	await page.getByRole('radio', { name: filter }).check();
	await page.getByRole('button', { name: button }).click();
	await expect(page.getByTestId('crop')).toHaveCount(0);
}

test('scans two pages, reorders them, keeps them over a reload and exports one PDF', async ({
	page
}) => {
	// Nothing leaves the app's own origin (the preview server's).
	const away: string[] = [];
	page.on('request', (request) => {
		const target = new URL(request.url());
		if (!['data:', 'blob:'].includes(target.protocol) && target.host !== 'localhost:4173')
			away.push(request.url());
	});
	await gotoHydrated(page, '/utils/scanner');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Document scanner$/);
	await expect(page.getByText('No pages yet.')).toBeVisible();

	await scanPage(page, 'Original');
	await scanPage(page, 'Greyscale');
	await expect(page.getByTestId('scan-page')).toHaveCount(2);
	expect(await filters(page)).toEqual(['original', 'greyscale']);

	await page.getByRole('button', { name: 'Up page 2' }).click();
	await expect.poll(() => filters(page)).toEqual(['greyscale', 'original']);

	// The unfinished scan, in its order, survives a reload.
	await reload(page);
	await expect.poll(() => filters(page)).toEqual(['greyscale', 'original']);

	// An en-US browser starts on Letter. Headless Linux has no Web Share, so Export saves.
	await expect(page.getByRole('radio', { name: 'Letter' })).toBeChecked();
	const exportButton = page.getByTestId('scan-export');
	await expect(exportButton).toHaveText('Save');
	const [pdf] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
	expect(pdf.suggestedFilename()).toMatch(/^scan-\d{8}-\d{6}\.pdf$/);
	const bytes = await readFile((await pdf.path())!, 'latin1');
	expect(bytes.startsWith('%PDF-')).toBe(true);
	expect(bytes).toContain('/Count 2');
	// Portrait Letter, and no details about where or when it was made.
	expect(bytes).toContain('/MediaBox [0 0 612 792]');
	expect(bytes).not.toMatch(/\/Producer|\/Author|\/CreationDate/);
	await expect(page.getByTestId('scan-note')).toContainText('outside this app');

	// Start over takes a second tap.
	await page.getByRole('button', { name: 'Start over' }).click();
	await page.getByRole('button', { name: 'Tap again to delete every page' }).click();
	await expect(page.getByText('No pages yet.')).toBeVisible();
	await reload(page);
	await expect(page.getByText('No pages yet.')).toBeVisible();
	expect(away).toEqual([]);
});

test('retakes a page in its place', async ({ page }) => {
	await gotoHydrated(page, '/utils/scanner');
	await scanPage(page, 'Original');
	await scanPage(page, 'Greyscale');
	await page.getByRole('button', { name: 'Retake page 1' }).click();
	await expect(page.getByTestId('retaking')).toBeVisible();
	await scanPage(page, 'Black & white', 'Replace page');
	await expect(page.getByTestId('retaking')).toHaveCount(0);
	await expect.poll(() => filters(page)).toEqual(['bw', 'greyscale']);
});

test.describe('in a British English browser', () => {
	test.use({ locale: 'en-GB' });

	test('starts on A4, and keeps the paper picked', async ({ page }) => {
		await gotoHydrated(page, '/utils/scanner');
		await scanPage(page, 'Original');
		await expect(page.getByRole('radio', { name: 'A4' })).toBeChecked();
		await page.getByRole('radio', { name: 'Letter' }).check();
		await scanPage(page, 'Original');
		await expect(page.getByRole('radio', { name: 'Letter' })).toBeChecked();
	});
});

test('says what stays private, and stays out of Recently used', async ({ page }) => {
	await gotoHydrated(page, '/utils/scanner');
	const note = page.getByTestId('scanner-note');
	await note.getByText('What stays private').click();
	await expect(note).toContainText(
		'With a passcode set in Settings → Privacy, the Document scanner opens only after unlocking'
	);

	await gotoHydrated(page, '/utils/coffee-timer');
	await gotoHydrated(page, '/utils/scanner');
	await gotoHydrated(page, '/');
	await expect(page.getByTestId('recent').getByRole('link')).toHaveText([/Coffee Timer$/]);
});

test('Settings lists the scan under Document scanner, out of backups, and clearing it removes it', async ({
	page
}) => {
	page.on('dialog', (dialog) => dialog.accept());
	await gotoHydrated(page, '/utils/scanner');
	await scanPage(page, 'Original');

	await gotoHydrated(page, '/settings');
	// A passcode would encrypt it, as the page's note says.
	await expect(page.getByTestId('lock-encryption')).toContainText('Document scanner');
	const clear = page.getByRole('button', { name: 'Clear Document scanner' });
	const group = page.getByRole('listitem').filter({ has: clear });
	await expect(group.getByTestId('files-note')).toHaveText([/^1 file, /]);
	await expect(group.getByTestId('backup-note')).toHaveText('Not in backups');
	await clear.click();
	await expect(group.getByTestId('files-note')).toHaveCount(0);

	await gotoHydrated(page, '/utils/scanner');
	await expect(page.getByText('No pages yet.')).toBeVisible();
});
