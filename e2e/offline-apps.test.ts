import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

// Only the apps that are on are kept offline (`offline({ byApp: true })`, xcwds/xcwds#163).
// This file tests the service worker, so it runs even where other tests block it (#91).
test.use({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });

const card = (page: Page, name: string) =>
	page.getByTestId('app-card').filter({ has: page.getByText(name, { exact: true }) });
const toggle = (page: Page, name: string) => card(page, name).getByRole('switch');

const waitForController = (page: Page) =>
	page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise((resolve) =>
				navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
			);
		}
	});

/** Whether the service worker's caches hold a copy of `path`. */
const kept = (page: Page, path: string) =>
	page.evaluate(async (path) => !!(await caches.match(new URL(path, location.href).href)), path);

// Kitchen's tools and its routes (Recipes and the Kitchen Guide), then pages of other apps and
// pages in no app.
const kitchen = ['/utils/coffee-timer', '/utils/pizza-dough', '/recipes', '/recipes/roast-chicken'];
const others = ['/utils/weightlifting', '/utils/url-sanitizer', '/settings', '/apps'];

test('turning an app off deletes its pages from the offline copy; on downloads them', async ({
	page,
	context
}) => {
	await gotoHydrated(page, '/apps');
	await waitForController(page);
	// Every app starts on, so a first install keeps them all.
	for (const path of [...kitchen, ...others]) await expect.poll(() => kept(page, path)).toBe(true);
	const offline = card(page, 'Kitchen').getByTestId('app-offline');
	await expect(offline).toHaveText(/^Kept offline: \d+ pages, [\d.]+ (KB|MB)$/);
	await expect(page.getByTestId('offline-storage')).toHaveText(/^Stored on this device: about /);

	await toggle(page, 'Kitchen').click();
	await expect(toggle(page, 'Kitchen')).toHaveAttribute('aria-checked', 'false');
	await expect(offline).toHaveText('Not kept offline');
	for (const path of kitchen) await expect.poll(() => kept(page, path)).toBe(false);
	for (const path of others) expect(await kept(page, path)).toBe(true);

	// The apps that are still on keep working offline.
	await context.setOffline(true);
	await gotoHydrated(page, '/utils/weightlifting');
	await expect(page.locator('h1')).toHaveText(/Weightlifting/);
	await context.setOffline(false);

	await gotoHydrated(page, '/apps');
	await toggle(page, 'Kitchen').click();
	await expect(toggle(page, 'Kitchen')).toHaveAttribute('aria-checked', 'true');
	for (const path of kitchen) await expect.poll(() => kept(page, path)).toBe(true);
	await expect(offline).toHaveText(/^Kept offline: \d+ pages, /);

	await context.setOffline(true);
	await gotoHydrated(page, '/recipes/roast-chicken');
	await expect(page.locator('h1')).toHaveText(/Roast Chicken/i);
	await context.setOffline(false);
});
