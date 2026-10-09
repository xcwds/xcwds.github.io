import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';
import { serveStatic } from './static-server';

// This file tests the service worker, so it runs even where other tests block it (#91).
test.use({ serviceWorkers: 'allow' });

test.use({ viewport: { width: 390, height: 844 } });

// Served like GitHub Pages (unknown paths get build/404.html), not by `vite preview`, which
// renders error pages on the server and never uses the 404.html fallback.
let origin: string;
let close: (() => Promise<void>) | undefined;

test.beforeAll(async () => {
	({ origin, close } = await serveStatic('build'));
});

test.afterAll(async () => {
	await close?.();
});

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

async function expectNotFound(page: Page) {
	await expect(heading(page)).toHaveText('Page not found');
	await expect(page.getByTestId('error-page')).toContainText("There's nothing at this address.");
	// Still inside the app: a back arrow, the tab bar and links onward.
	await expect(page.getByRole('link', { name: 'Back to Home' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Go to' }).getByRole('link')).toHaveText([
		/Home/,
		/Recipes/,
		/Utils/
	]);
}

test('an unknown URL shows the app shell and a not-found page', async ({ page }) => {
	const response = await page.goto(`${origin}/no-such-page`);
	expect(response?.status()).toBe(404);
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expectNotFound(page);
	await expect(page).toHaveTitle('Page not found · xcwds');

	await page
		.getByRole('navigation', { name: 'Go to' })
		.getByRole('link', { name: /Recipes/ })
		.click();
	await expect(page).toHaveURL(`${origin}/recipes`);
	await expect(heading(page)).toHaveText('Recipes');
});

test('a recipe that does not exist is not found', async ({ page }) => {
	await gotoHydrated(page, `${origin}/recipes/not-a-recipe`);
	await expectNotFound(page);
});

test('offline, an unknown URL still gets the app and its not-found page', async ({
	page,
	context
}) => {
	await gotoHydrated(page, `${origin}/`);
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise((resolve) =>
				navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
			);
		}
	});
	await context.setOffline(true);
	await gotoHydrated(page, `${origin}/somewhere-offline`);
	await expectNotFound(page);
	await context.setOffline(false);
});
