import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

// Tablet and computer layouts (#95): which main navigation shows at each size and orientation,
// the setting that picks it, and page containers lining up with the header.

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const headerNav = (page: Page) => page.locator('header').getByRole('navigation', { name: 'Main' });
const sidebar = (page: Page) => page.locator('nav.fixed.inset-y-0');

/** Saves the navigation setting before the app first loads. */
async function seedNav(page: Page, nav: { portrait?: string; landscape?: string }) {
	await page.addInitScript((value) => {
		if (localStorage.getItem('app:settings') !== null) return;
		localStorage.setItem('app:version', '3');
		localStorage.setItem('app:settings', JSON.stringify({ nav: value }));
	}, nav);
}

async function expectNav(page: Page, kind: 'tabs' | 'header' | 'sidebar') {
	// Only one navigation is ever exposed; the others are display:none.
	await expect(mainNav(page)).toHaveCount(1);
	if (kind === 'header') await expect(headerNav(page)).toBeVisible();
	else await expect(headerNav(page)).toBeHidden();
	if (kind === 'sidebar') await expect(sidebar(page)).toBeVisible();
	else await expect(sidebar(page)).toBeHidden();
}

const viewports = {
	phone: { width: 390, height: 844 },
	phoneLandscape: { width: 844, height: 390 },
	tabletPortrait: { width: 820, height: 1180 },
	tabletLandscape: { width: 1180, height: 820 },
	desktop: { width: 1440, height: 900 }
};

test.describe('default navigation', () => {
	const expected = {
		phone: 'tabs',
		phoneLandscape: 'header',
		tabletPortrait: 'header',
		tabletLandscape: 'sidebar',
		desktop: 'sidebar'
	} as const;
	for (const [name, viewport] of Object.entries(viewports)) {
		const kind = expected[name as keyof typeof expected];
		test(`${name} shows the ${kind} navigation`, async ({ page }) => {
			await page.setViewportSize(viewport);
			await gotoHydrated(page, '/utils');
			await expectNav(page, kind);
		});
	}
});

test('the setting picks the navigation per orientation, before the app loads', async ({ page }) => {
	await seedNav(page, { portrait: 'sidebar', landscape: 'bar' });
	await page.setViewportSize(viewports.tabletPortrait);
	// With the app's JavaScript blocked, only the inline script in app.html can apply it.
	await page.route('**/_app/**', (route) => route.abort());
	await page.goto('/utils');
	await expect(sidebar(page)).toBeVisible();
	await page.unroute('**/_app/**');

	await gotoHydrated(page, '/utils');
	await expectNav(page, 'sidebar');
	await page.setViewportSize(viewports.tabletLandscape);
	await expectNav(page, 'header');
	// Phones keep their own navigation whatever the setting says.
	await page.setViewportSize(viewports.phoneLandscape);
	await expectNav(page, 'header');
	await page.setViewportSize(viewports.phone);
	await expectNav(page, 'tabs');
});

test('changing the setting in Settings switches the navigation', async ({ page }) => {
	await page.setViewportSize(viewports.desktop);
	await gotoHydrated(page, '/settings');
	await expectNav(page, 'sidebar');
	await page
		.getByRole('radiogroup', { name: 'Navigation in landscape' })
		.getByRole('radio', { name: 'Top bar' })
		.click();
	await expectNav(page, 'header');
	await page.reload();
	await expectNav(page, 'header');
	await page
		.getByRole('radiogroup', { name: 'Navigation in landscape' })
		.getByRole('radio', { name: 'Sidebar' })
		.click();
	await expectNav(page, 'sidebar');
});

test.describe('with the sidebar', () => {
	test.use({ viewport: viewports.desktop });

	test('keyboard users reach the sidebar before the page', async ({ page }) => {
		await gotoHydrated(page, '/recipes');
		await page.keyboard.press('Tab');
		await expect(sidebar(page).getByRole('link', { name: 'Home' })).toBeFocused();
	});

	for (const path of [
		'/',
		'/utils',
		'/recipes',
		'/recipes/pizza-dough',
		'/settings',
		'/utils/coffee-timer'
	]) {
		test(`the header lines up with the page on ${path}`, async ({ page }) => {
			await gotoHydrated(page, path);
			const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
			const main = (await page.locator('main').boundingBox())!;
			const side = (await sidebar(page).boundingBox())!;
			// The page sits right of the sidebar, and the title starts at the page's content edge
			// (allowing for a back arrow in front of it).
			expect(main.x).toBeGreaterThanOrEqual(side.x + side.width);
			const padding = await page
				.locator('main')
				.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
			const back = page.locator('header a[aria-label^="Back to"]');
			const start = (await back.count()) ? (await back.boundingBox())!.x + 8 : title.x;
			expect(Math.abs(start - (main.x + padding))).toBeLessThanOrEqual(1);
		});
	}

	test('notifications sit at the top right, clear of the page title', async ({ page }) => {
		await gotoHydrated(page, '/settings');
		await page.evaluate(() => window.dispatchEvent(new Event('offline')));
		const notice = page.getByTestId('offline-notice');
		await expect(notice).toBeVisible();
		const box = (await notice.boundingBox())!;
		const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
		expect(box.x).toBeGreaterThan(title.x + title.width);
	});
});

for (const [name, viewport] of Object.entries(viewports)) {
	test(`no horizontal scrolling on ${name}`, async ({ page }) => {
		await page.setViewportSize(viewport);
		for (const path of [
			'/',
			'/utils',
			'/recipes',
			'/recipes/pizza-dough',
			'/settings',
			'/utils/weightlifting'
		]) {
			await gotoHydrated(page, path);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			expect(overflow, path).toBeLessThanOrEqual(0);
		}
	});
}
