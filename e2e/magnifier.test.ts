// The Magnifier (#216), with Chromium's fake camera (no hardware zoom, no light).
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

test('zooms, freezes and unfreezes, and turns the camera off on leaving', async ({ page }) => {
	// Keep every camera track the page gets, to check they end.
	await page.addInitScript(() => {
		const tracks: MediaStreamTrack[] = [];
		(window as unknown as { tracks: MediaStreamTrack[] }).tracks = tracks;
		const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
		navigator.mediaDevices.getUserMedia = async (c) => {
			const stream = await get(c);
			tracks.push(...stream.getTracks());
			return stream;
		};
	});
	// Opened from Utils, so going back leaves it inside the app (the same document).
	await gotoHydrated(page, '/utils');
	await page.getByRole('link', { name: /Magnifier/ }).click();
	await page.getByRole('button', { name: 'Turn on camera' }).click();
	const viewer = page.getByTestId('magnifier');
	await expect(viewer).toHaveAttribute('data-state', 'live');

	// No hardware zoom: a labelled digital zoom. No light: no button at all.
	const zoom = page.getByRole('slider', { name: /Digital zoom/ });
	await expect(zoom).toBeVisible();
	await expect(page.getByText('it adds no detail')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Light' })).toHaveCount(0);
	// The fake camera's small picture allows only a little digital zoom (it keeps 1 megapixel).
	const max = (await zoom.getAttribute('max'))!;
	expect(Number(max)).toBeGreaterThan(1);
	await zoom.fill(max);
	await expect(page.getByLabel('Magnified picture')).toHaveAttribute(
		'style',
		new RegExp(`scale\\(${max}\\)`)
	);

	await page.getByRole('button', { name: 'High contrast' }).click();
	await expect(page.getByLabel('Magnified picture')).toHaveAttribute('style', /contrast\(2\)/);

	// Freeze: the picture stops changing (the fake camera's picture moves) and can be zoomed.
	await page.getByRole('button', { name: 'Freeze' }).click();
	await expect(viewer).toHaveAttribute('data-frozen', 'true');
	const frozen = page.getByTestId('frozen');
	const pixels = () => frozen.evaluate((c: HTMLCanvasElement) => c.toDataURL());
	const first = await pixels();
	await page.waitForTimeout(500);
	expect(await pixels()).toBe(first);
	await expect(frozen).toHaveAttribute('style', new RegExp(`scale\\(${max}\\)`));
	await page.getByRole('slider', { name: /Zoom/ }).fill('4');
	await expect(frozen).toHaveAttribute('style', /scale\(4\)/);

	// Dragging moves around the frozen picture, never past its edge.
	const box = (await viewer.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 2000, box.y + box.height / 2, { steps: 5 });
	await page.mouse.up();
	const maxX = (box.width * 3) / 8;
	await expect(frozen).toHaveAttribute('style', new RegExp(`translate\\(${maxX}px, 0px\\)`));

	// Unfreeze: the live picture is back, and moving.
	await page.getByRole('button', { name: 'Unfreeze' }).click();
	await expect(viewer).toHaveAttribute('data-frozen', 'false');
	const time = () =>
		page.getByLabel('Magnified picture').evaluate((v: HTMLVideoElement) => v.currentTime);
	const before = await time();
	await expect.poll(time).toBeGreaterThan(before);

	// Leaving the page (in the app) stops the camera.
	await page.goBack();
	await expect(page).toHaveURL(/\/utils$/);
	await expect(viewer).toHaveCount(0);
	expect(
		await page.evaluate(() =>
			(window as unknown as { tracks: MediaStreamTrack[] }).tracks.map((t) => t.readyState)
		)
	).not.toContain('live');
});

test('remembers the zoom for this visit', async ({ page }) => {
	await gotoHydrated(page, '/utils/magnifier');
	await page.getByRole('button', { name: 'Turn on camera' }).click();
	await page.getByRole('slider', { name: /Digital zoom/ }).fill('1.2');
	await page.getByRole('button', { name: 'Turn off' }).click();
	await page.getByRole('button', { name: 'Turn on camera' }).click();
	await expect(page.getByRole('slider', { name: /Digital zoom/ })).toHaveValue('1.2');
});

test('a frozen picture stays when the camera goes off', async ({ page }) => {
	await gotoHydrated(page, '/utils/magnifier');
	await page.getByRole('button', { name: 'Turn on camera' }).click();
	await page.getByRole('button', { name: 'Freeze' }).click();
	await page.getByRole('button', { name: 'Turn off' }).click();
	const viewer = page.getByTestId('magnifier');
	await expect(viewer).toHaveAttribute('data-state', 'idle');
	await expect(viewer).toHaveAttribute('data-frozen', 'true');
	await expect(page.getByTestId('frozen')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Turn on camera' })).toHaveCount(0);
	await page.getByRole('slider', { name: /Zoom/ }).fill('2');
	await expect(page.getByTestId('frozen')).toHaveAttribute('style', /scale\(2\)/);

	await page.getByRole('button', { name: 'Unfreeze' }).click();
	await expect(page.getByRole('button', { name: 'Turn on camera' })).toBeVisible();
});
