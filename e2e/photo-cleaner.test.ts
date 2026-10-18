import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { readMetadata } from '@xcwds/plugin-camera/image';
import { withExif } from './exif';
import { gotoHydrated } from './helpers';

// Photo Cleaner (#212): copies of photos without their location and camera details.
test.use({ viewport: { width: 390, height: 844 } });

/** A 1600×1200 JPEG drawn in the page, as bytes. */
async function jpeg(page: Page): Promise<Buffer> {
	const data = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		canvas.width = 1600;
		canvas.height = 1200;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#3b82f6';
		ctx.fillRect(0, 0, 1600, 1200);
		ctx.fillStyle = '#f59e0b';
		ctx.fillRect(200, 200, 600, 400);
		return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]!;
	});
	return Buffer.from(data, 'base64');
}

const camera = { make: 'Google', model: 'Pixel 8', taken: '2026:10:16 08:12:00' };

test('says what a photo gave away, and downloads a copy without it', async ({ page }) => {
	await gotoHydrated(page, '/utils/photo-cleaner');
	await expect(page.getByText('Choose photos to see what they give away')).toBeVisible();

	const original = withExif(await jpeg(page), camera);
	// The fixture really carries what the page should find.
	expect(readMetadata(original)).toMatchObject({ exif: true, gps: true, camera: 'Google Pixel 8' });

	await page
		.getByTestId('photo-file')
		.setInputFiles({ name: 'IMG_0042.jpg', mimeType: 'image/jpeg', buffer: original });
	const photo = page.getByTestId('photo');
	const findings = photo.getByTestId('photo-findings');
	await expect(findings).toContainText('GPS location: removed');
	await expect(findings).toContainText('Camera (Google Pixel 8): removed');
	await expect(findings).toContainText('Date taken (2026-10-16 08:12): removed');
	await expect(findings).not.toContainText('41');
	await expect(photo.getByTestId('photo-size')).toContainText('1600 × 1200 px');

	// Smaller copies: the same photo, at most 1024 px on a side.
	await page.getByLabel('Size of the clean copy').selectOption({ label: '1024 px' });
	await expect(photo.getByTestId('photo-size')).toContainText('1024 × 768 px');

	const download = page.waitForEvent('download');
	await photo.getByRole('button', { name: 'Download' }).click();
	const file = await download;
	expect(file.suggestedFilename()).toBe('IMG_0042-clean.jpg');
	const cleaned = await readFile((await file.path())!);
	expect(cleaned.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
	expect(readMetadata(cleaned)).toMatchObject({ exif: false, gps: false, xmp: false });
	expect(cleaned.includes(Buffer.from('Pixel 8'))).toBe(false);
	await expect(page.getByTestId('toast')).toContainText('Clean copy downloaded.');
});

test('handles several photos, and says so when one can’t be opened', async ({ page }) => {
	await gotoHydrated(page, '/utils/photo-cleaner');
	const plain = await jpeg(page);
	await page.getByTestId('photo-file').setInputFiles([
		{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: withExif(plain, camera) },
		{ name: 'b.jpg', mimeType: 'image/jpeg', buffer: plain },
		{ name: 'c.heic', mimeType: 'image/heic', buffer: Buffer.from('not really a photo') }
	]);
	const photos = page.getByTestId('photo');
	await expect(photos).toHaveCount(3);
	await expect(photos.nth(1).getByTestId('photo-findings')).toHaveText(
		'No hidden details found. The copy is clean either way.'
	);
	await expect(photos.nth(2).getByRole('alert')).not.toBeEmpty();
	await expect(photos.nth(2).getByRole('button', { name: 'Download' })).toHaveCount(0);

	const downloads: string[] = [];
	page.on('download', (d) => downloads.push(d.suggestedFilename()));
	await page.getByRole('button', { name: 'Download all (2)' }).click();
	await expect(page.getByTestId('toast')).toContainText('2 clean copies downloaded.');
	await expect.poll(() => downloads.sort()).toEqual(['a-clean.jpg', 'b-clean.jpg']);

	await page.getByRole('button', { name: 'Remove c.heic' }).click();
	await expect(photos).toHaveCount(2);
	await page.getByRole('button', { name: 'Clear' }).click();
	await expect(photos).toHaveCount(0);
	await expect(page.getByText('Choose photos to see what they give away')).toBeVisible();
});
