import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

const shared = 'https://shop.example.com/item?id=9&utm_source=app&fbclid=zz';
const clean = 'https://shop.example.com/item?id=9';

test('manifest is installable and its icons load', async ({ request }) => {
	const manifest = await (await request.get('/manifest.webmanifest')).json();
	expect(manifest.display).toBe('standalone');
	expect(manifest.share_target.action).toBe('/utils/url-sanitizer');
	const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
	expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
	for (const icon of manifest.icons) {
		expect((await request.get(icon.src)).ok()).toBe(true);
	}
	expect((await request.get('/favicon.ico')).ok()).toBe(true);
	expect((await request.get('/icons/icon.svg')).headers()['content-type']).toContain('svg');
});

test('sanitizer receives a link from #url= and clears it from the address', async ({ page }) => {
	await gotoHydrated(page, `/utils/url-sanitizer#url=${encodeURIComponent(shared)}`);
	await expect(page.getByTestId('cleaned')).toHaveText(clean);
	expect(new URL(page.url()).hash).toBe('');
});

test('sanitizer receives a link shared into an already-open page', async ({ page }) => {
	await gotoHydrated(page, '/utils/url-sanitizer');
	await page.evaluate((link) => (location.hash = `url=${encodeURIComponent(link)}`), shared);
	await expect(page.getByTestId('cleaned')).toHaveText(clean);
	expect(new URL(page.url()).hash).toBe('');
});

test('Android share target params are handled and cleared', async ({ page }) => {
	const params = new URLSearchParams({ title: 'Cool item', text: `Look ${shared}` });
	await gotoHydrated(page, `/utils/url-sanitizer?${params}`);
	await expect(page.getByTestId('cleaned')).toHaveText(clean);
	expect(new URL(page.url()).search).toBe('');
});

test('service worker keeps shared links off the network and works offline', async ({
	page,
	context
}) => {
	await gotoHydrated(page, '/');
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise((resolve) =>
				navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
			);
		}
	});

	// Requests the service worker answers itself never reach these routes.
	const leaked: string[] = [];
	await context.route('**/utils/url-sanitizer?*', (route) => {
		leaked.push(route.request().url());
		return route.continue();
	});
	await gotoHydrated(page, `/utils/url-sanitizer?url=${encodeURIComponent(shared)}`);
	await expect(page.getByTestId('cleaned')).toHaveText(clean);
	expect(leaked).toEqual([]);

	await context.setOffline(true);
	for (const path of ['/', '/recipes', '/utils/coffee-timer']) {
		await gotoHydrated(page, path);
		await expect(page.locator('h1')).toBeVisible();
	}
	await context.setOffline(false);
});
