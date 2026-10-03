import type { Page } from '@playwright/test';

/** Navigates and waits for SvelteKit to hydrate, so typed input isn't lost or doubled. */
export async function gotoHydrated(page: Page, path: string) {
	await page.goto(path);
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}
