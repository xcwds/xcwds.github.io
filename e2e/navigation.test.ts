import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const tabBar = (page: Page) => page.getByRole('navigation', { name: 'Main' });

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('tab bar switches sections and marks the current one', async ({ page }) => {
		await gotoHydrated(page, '/');
		await expect(heading(page)).toHaveText('Chris Waters');
		await expect(tabBar(page).getByRole('link', { name: 'Home' })).toHaveAttribute(
			'aria-current',
			'page'
		);

		await tabBar(page).getByRole('link', { name: 'Recipes' }).click();
		await expect(page).toHaveURL(/\/recipes$/);
		await expect(heading(page)).toHaveText('Recipes');
		await expect(tabBar(page).getByRole('link', { name: 'Recipes' })).toHaveAttribute(
			'aria-current',
			'page'
		);

		await tabBar(page).getByRole('link', { name: 'Utils' }).click();
		await expect(heading(page)).toHaveText('Utils');
	});

	test('nested pages show their title and a back arrow to the parent', async ({ page }) => {
		await gotoHydrated(page, '/utils/coffee-timer');
		await expect(heading(page)).toHaveText(/Coffee Timer/);
		await expect(tabBar(page).getByRole('link', { name: 'Utils' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await page.getByRole('link', { name: 'Back to Utils' }).click();
		await expect(page).toHaveURL(/\/utils$/);
		await expect(page.getByRole('link', { name: 'Back to Utils' })).toHaveCount(0);

		await gotoHydrated(page, '/recipes/pizza-dough');
		await expect(heading(page)).toHaveText(/Pizza Dough/);
		await page.getByRole('link', { name: 'Back to Recipes' }).click();
		await expect(page).toHaveURL(/\/recipes$/);
	});

	test('the tab bar does not cover the end of a page', async ({ page }) => {
		await gotoHydrated(page, '/utils/cooking-timer');
		const note = page.getByText('Timers are saved on this device');
		await note.scrollIntoViewIfNeeded();
		const noteBox = await note.boundingBox();
		const barBox = await tabBar(page).boundingBox();
		expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(barBox!.y);
	});
});

test.describe('on desktop', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('sections are linked from the header instead of a tab bar', async ({ page }) => {
		await gotoHydrated(page, '/recipes');
		const header = page.locator('header').getByRole('navigation', { name: 'Main' });
		await expect(header).toBeVisible();
		await expect(header.getByRole('link', { name: 'Recipes' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		// The phone tab bar is display:none here, so only the header nav is exposed.
		await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(1);
		await header.getByRole('link', { name: 'Utils' }).click();
		await expect(heading(page)).toHaveText('Utils');
	});
});
