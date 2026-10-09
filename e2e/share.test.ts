import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

/**
 * Makes the page think it runs as the installed app, and records what it shares instead of
 * opening a share sheet (or removes the share API, as on some desktop installs).
 */
async function asInstalledApp(page: Page, { canShare = true } = {}) {
	await page.addInitScript((canShare) => {
		const real = window.matchMedia.bind(window);
		window.matchMedia = (query: string) => {
			const list = real(query);
			if (query === '(display-mode: standalone)')
				Object.defineProperty(list, 'matches', { value: true });
			return list;
		};
		const shared: ShareData[] = [];
		Object.assign(window, { __shared: shared });
		Object.defineProperty(Navigator.prototype, 'share', {
			configurable: true,
			value: canShare ? async (data: ShareData) => void shared.push(data) : undefined
		});
	}, canShare);
}

const sharedData = (page: Page) =>
	page.evaluate(() => (window as unknown as { __shared: ShareData[] }).__shared);

test('the installed app shares a recipe by its title and link (#89)', async ({ page }) => {
	await asInstalledApp(page);
	await gotoHydrated(page, '/recipes/chocolate-chip-cookies');
	const button = page.getByRole('button', { name: 'Share Chocolate Chip Cookies' });
	const box = (await button.boundingBox())!;
	expect(box.width).toBeGreaterThanOrEqual(44);
	expect(box.height).toBeGreaterThanOrEqual(44);
	await button.click();
	const origin = new URL(page.url()).origin;
	expect(await sharedData(page)).toEqual([
		{
			title: 'Chocolate Chip Cookies',
			text: 'Chocolate Chip Cookies on xcwds',
			url: `${origin}/recipes/chocolate-chip-cookies`
		}
	]);
});

test('sharing a tool never sends what was typed into it (#89)', async ({ page }) => {
	await asInstalledApp(page);
	await page.goto('/utils/url-sanitizer#url=https%3A%2F%2Fprivate.example%2Fsecret');
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await page.getByRole('button', { name: 'Share URL Sanitizer' }).click();
	const [data] = await sharedData(page);
	expect(data.url).toBe(`${new URL(page.url()).origin}/utils/url-sanitizer`);
	expect(JSON.stringify(data)).not.toContain('private.example');
});

test('without a share sheet it copies the link instead (#89)', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await asInstalledApp(page, { canShare: false });
	await gotoHydrated(page, '/utils/oven-time');
	await page.getByRole('button', { name: 'Share Oven Time Converter' }).click();
	await expect(page.getByTestId('toast')).toHaveText('Link copied.');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		`${new URL(page.url()).origin}/utils/oven-time`
	);
});

test('no Share button in a browser tab, on Settings or on error pages (#89)', async ({ page }) => {
	await gotoHydrated(page, '/recipes/chocolate-chip-cookies');
	await expect(page.getByRole('button', { name: /^Share / })).toHaveCount(0);

	await asInstalledApp(page);
	await gotoHydrated(page, '/settings');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
	await expect(page.getByRole('button', { name: /^Share / })).toHaveCount(0);
	await gotoHydrated(page, '/no-such-page');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
	await expect(page.getByRole('button', { name: /^Share / })).toHaveCount(0);
	await gotoHydrated(page, '/');
	await expect(page.getByRole('button', { name: 'Share xcwds' })).toBeVisible();
});
