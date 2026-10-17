// The QR codes tool (#211). Chromium's fake camera plays a QR code: a Y4M video written here
// with @xcwds/plugin-qr's own encoder.
import { expect, test } from '@playwright/test';
import { encodeQr } from '@xcwds/plugin-qr/make';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gotoHydrated } from './helpers';

const CODE = 'https://shop.example/item?id=7&utm_source=poster';

/** A few frames of `text` as a QR code, black on white, in the middle of a 640 × 480 picture. */
function qrVideo(text: string): string {
	const width = 640;
	const height = 480;
	const { size, modules } = encodeQr(text);
	const scale = Math.floor(360 / (size + 8));
	const side = (size + 8) * scale;
	const left = Math.floor((width - side) / 2);
	const top = Math.floor((height - side) / 2);
	const luma = Buffer.alloc(width * height, 255);
	for (let y = 0; y < size; y++)
		for (let x = 0; x < size; x++) {
			if (!modules[y * size + x]) continue;
			for (let dy = 0; dy < scale; dy++) {
				const row = (top + (y + 4) * scale + dy) * width + left + (x + 4) * scale;
				luma.fill(0, row, row + scale);
			}
		}
	const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128);
	const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma]);
	const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`);
	const file = join(mkdtempSync(join(tmpdir(), 'xcwds-qr-')), 'code.y4m');
	writeFileSync(file, Buffer.concat([header, ...Array.from({ length: 10 }, () => frame)]));
	return file;
}

// A per-file `launchOptions` replaces the config's, so this repeats its flag (and a local
// Chromium, where CHROMIUM_PATH names one).
test.use({
	viewport: { width: 390, height: 844 },
	permissions: ['camera'],
	launchOptions: {
		executablePath: process.env.CHROMIUM_PATH || undefined,
		args: [
			'--disable-gpu',
			'--use-fake-device-for-media-stream',
			'--use-fake-ui-for-media-stream',
			`--use-file-for-fake-video-capture=${qrVideo(CODE)}`
		]
	}
});

test('a scanned link is shown cleaned and opens only when tapped', async ({ page, context }) => {
	// Nothing leaves the app's own origin (the preview server's), and nothing opens by itself.
	const away: string[] = [];
	page.on('request', (request) => {
		const target = new URL(request.url());
		if (!['data:', 'blob:'].includes(target.protocol) && target.host !== 'localhost:4173')
			away.push(request.url());
	});
	const opened: string[] = [];
	context.on('page', (p) => opened.push(p.url()));

	await gotoHydrated(page, '/utils/qr');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/QR codes$/);
	await page.getByRole('button', { name: 'Scan a code' }).click();
	const result = page.getByTestId('qr-result');
	await expect(result).toHaveAttribute('data-kind', 'url');
	await expect(result.getByTestId('qr-link')).toHaveText('https://shop.example/item?id=7');
	await expect(result).toContainText('Removed 1 tracker');
	await result.getByText('What the code said').click();
	await expect(result).toContainText(CODE);
	await expect(result.getByRole('link', { name: 'Open' })).toHaveAttribute(
		'href',
		'https://shop.example/item?id=7'
	);
	expect(opened).toEqual([]);
	expect(away).toEqual([]);
});

test('makes a code, and reads it back from an image', async ({ page }) => {
	await gotoHydrated(page, '/utils/qr');
	const code = page.locator('svg[data-qr]');
	await expect(code).toHaveCount(0);
	const input = page.getByLabel('Text or link');
	/** The code as a PNG, scrolled clear of the tab bar (which would cover part of it). */
	const shot = async () => {
		await code.evaluate((el) => el.scrollIntoView({ block: 'center' }));
		return code.screenshot();
	};

	// Text: shown with Copy.
	await input.fill('Hello from xcwds ✓');
	await expect(page.getByRole('button', { name: 'Download PNG' })).toBeVisible();
	await page
		.getByTestId('qr-file')
		.setInputFiles({ name: 'code.png', mimeType: 'image/png', buffer: await shot() });
	await expect(page.getByTestId('qr-text')).toHaveText('Hello from xcwds ✓');

	// A clean link: nothing removed, so nothing more to show (even though the URL adds a slash).
	await input.fill('https://example.com');
	await page
		.getByTestId('qr-file')
		.setInputFiles({ name: 'link.png', mimeType: 'image/png', buffer: await shot() });
	await expect(page.getByTestId('qr-link')).toHaveText('https://example.com/');
	await expect(page.getByTestId('qr-result')).toContainText('No trackers found.');
	await expect(page.getByText('What the code said')).toHaveCount(0);

	// Wi-Fi: the network's name, and its password only to copy.
	await input.fill('WIFI:S:Home net;T:WPA;P:pa55word;;');
	await page
		.getByTestId('qr-file')
		.setInputFiles({ name: 'wifi.png', mimeType: 'image/png', buffer: await shot() });
	await expect(page.getByTestId('qr-wifi')).toHaveText('Home net');
	await expect(page.getByTestId('qr-result')).not.toContainText('pa55word');
	await expect(page.getByRole('button', { name: 'Copy password' })).toBeVisible();

	// An image with no code in it.
	await page.getByTestId('qr-file').setInputFiles({
		name: 'plain.png',
		mimeType: 'image/png',
		buffer: await page.getByRole('heading', { name: 'Make a code' }).screenshot()
	});
	await expect(page.getByTestId('qr-result')).toHaveText('No code found in that image.');
});

test('the URL Sanitizer shows a cleaned link as a QR code, through the fragment', async ({
	page
}) => {
	const queries: string[] = [];
	page.on('request', (request) => {
		if (new URL(request.url()).pathname.startsWith('/utils/qr') && new URL(request.url()).search)
			queries.push(request.url());
	});
	await gotoHydrated(page, '/utils/url-sanitizer');
	await page.getByLabel('Paste a link').fill('https://a.com/?utm_source=x&b=1');
	await page.getByRole('link', { name: 'Show as QR code' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/QR codes$/);
	await expect(page.getByLabel('Text or link')).toHaveValue('https://a.com/?b=1');
	await expect(page.locator('svg[data-qr]')).toBeVisible();
	// Read, then taken off the address bar.
	await expect(page).toHaveURL(/\/utils\/qr$/);
	expect(queries).toEqual([]);
});
