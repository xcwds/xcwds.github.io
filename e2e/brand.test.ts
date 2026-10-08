import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('home page shows the tagline and what xcwds stands for', async ({ page }) => {
	await gotoHydrated(page, '/');
	await expect(page.getByText('Everyday tools that never phone home.')).toBeVisible();
	await expect(page.getByTestId('acronym')).toHaveText(
		/eXecutes Client-side, Without Data Servers/
	);
});

test('tapping the acronym on About three times reveals the Easter egg', async ({ page }) => {
	await gotoHydrated(page, '/settings');
	const acronym = page.getByTestId('about-acronym');
	await expect(acronym).toContainText('eXecutes Client-side, Without Data Servers');

	await acronym.click();
	await acronym.click();
	await expect(acronym).toContainText('eXecutes Client-side');
	await acronym.click();
	await expect(acronym).toContainText('eXtra Crispy Waffles, Deadlifts & Sanitizers');

	for (let i = 0; i < 3; i++) await acronym.click();
	await expect(acronym).toContainText('eXecutes Client-side, Without Data Servers');
});
