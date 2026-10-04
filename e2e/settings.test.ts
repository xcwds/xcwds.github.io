import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

const scheme = (page: Page) => page.evaluate(() => document.documentElement.dataset.colorScheme);

test('Settings is reachable from the tab bar', async ({ page }) => {
	await gotoHydrated(page, '/');
	await page
		.getByRole('navigation', { name: 'Main' })
		.getByRole('link', { name: 'Settings' })
		.click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
	await expect(page.getByTestId('version')).not.toBeEmpty();
});

test('theme setting applies, persists, and is set before the app loads', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await gotoHydrated(page, '/settings');
	expect(await scheme(page)).toBe('light');

	await page.getByRole('radio', { name: 'Dark' }).click();
	expect(await scheme(page)).toBe('dark');
	await expect(page.locator('body > div > div').first()).toHaveCSS(
		'background-color',
		'oklch(0.13 0.028 261.692)' // Tailwind gray-950, the dark background
	);

	// With the app's JavaScript blocked, only the inline script in app.html can set the theme.
	await page.route('**/_app/**', (route) => route.abort());
	await page.goto('/recipes');
	expect(await scheme(page)).toBe('dark');
	await page.unroute('**/_app/**');

	await gotoHydrated(page, '/settings');
	await page.getByRole('radio', { name: 'System' }).click();
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect.poll(() => scheme(page)).toBe('dark');
	await page.emulateMedia({ colorScheme: 'light' });
	await expect.poll(() => scheme(page)).toBe('light');
});

test('timer options persist', async ({ page }) => {
	await gotoHydrated(page, '/settings');
	await page.getByLabel('Alarm sound').uncheck();
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(page.getByLabel('Alarm sound')).not.toBeChecked();
	await expect(page.getByLabel('Keep screen on')).toBeChecked();
});

test('export, clear and import a backup', async ({ page }) => {
	page.on('dialog', (dialog) => dialog.accept());

	await gotoHydrated(page, '/utils/coffee-timer');
	await page.getByRole('button', { name: '+30s' }).click();
	await expect(page.getByTestId('display')).toHaveText('2:00');

	await gotoHydrated(page, '/settings');
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download backup' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/^waters-backup-\d{4}-\d{2}-\d{2}\.json$/);
	const file = (await download.path())!;
	const backup = JSON.parse(await readFile(file, 'utf8'));
	expect(backup.app).toBe('xcwds.com');
	expect(backup.data['app:coffee-timer:duration']).toBe(120_000);

	await page.getByRole('button', { name: 'Clear all data' }).click();
	await expect(page.getByRole('status')).toHaveText('All data cleared.');
	await expect(page.getByRole('button', { name: 'Clear Coffee Timer' })).toBeDisabled();

	await page.getByLabel('Backup file').setInputFiles(file);
	const preview = page.getByTestId('import-preview');
	await expect(preview).toContainText('Coffee timer duration');
	await preview.getByRole('button', { name: 'Merge' }).click();
	await expect(page.getByRole('status')).toHaveText(/^Imported \d+ items?\.$/);
	await expect(page.getByRole('button', { name: 'Clear Coffee Timer' })).toBeEnabled();

	await gotoHydrated(page, '/utils/coffee-timer');
	await expect(page.getByTestId('display')).toHaveText('2:00');
});

test('importing a file that is not a backup shows an error', async ({ page }) => {
	await gotoHydrated(page, '/settings');
	await page.getByLabel('Backup file').setInputFiles({
		name: 'notes.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify({ hello: 'world' }))
	});
	await expect(page.getByRole('alert')).toHaveText("This file isn't a backup from this site.");
	await expect(page.getByTestId('import-preview')).toHaveCount(0);
});
