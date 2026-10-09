import { expect, test } from '@playwright/test';
import { porkChopsPath } from '../src/lib/parody';
import { gotoHydrated } from './helpers';

// This file tests the service worker, so it runs even where other tests block it (#91).
test.use({ serviceWorkers: 'allow' });

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

test('the pork chop parody page stays on this origin and keeps the app shell heading', async ({
	page,
	baseURL
}) => {
	const origin = new URL(baseURL!).origin;
	const external: string[] = [];
	const fonts: string[] = [];
	page.on('request', (request) => {
		const url = new URL(request.url());
		if (url.protocol.startsWith('http') && url.origin !== origin) external.push(request.url());
		if (request.resourceType() === 'font') fonts.push(url.pathname);
	});
	await gotoHydrated(page, porkChopsPath);
	await page.evaluate(() => document.fonts.ready);
	await expect(page.locator('h1')).toHaveCount(1);
	await expect(page.locator('h1')).toHaveText(/Pork Chops/);
	const faces = await page.evaluate(() =>
		[...document.fonts].map((f) => `${f.family} ${f.weight} ${f.style} ${f.status}`)
	);
	expect(faces).toEqual(
		expect.arrayContaining([
			'Lora 400 normal loaded',
			'Lora 400 italic loaded',
			'Lora 600 normal loaded',
			'Playfair Display 700 normal loaded',
			'Playfair Display 900 normal loaded',
			'Dancing Script 600 normal loaded'
		])
	);
	expect(fonts.length).toBeGreaterThan(0);
	expect(fonts.every((path) => path.startsWith('/fonts/'))).toBe(true);
	expect(external).toEqual([]);
});
