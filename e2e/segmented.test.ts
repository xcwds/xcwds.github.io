import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

// Segmented controls behave like the radio groups and tabs they're announced as (#138).
test.use({ viewport: { width: 390, height: 844 } });

const scheme = (page: Page) => page.evaluate(() => document.documentElement.dataset.colorScheme);
const tabStops = (group: Locator) => group.locator('[tabindex="0"]');

test('the theme control is one Tab stop and the arrow keys change it', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await gotoHydrated(page, '/settings');
	const theme = page.getByRole('radiogroup', { name: 'Theme' });
	await expect(tabStops(theme)).toHaveCount(1);
	await expect(tabStops(theme)).toHaveAccessibleName('System');

	// Tab reaches the checked option and then leaves the group.
	await page.getByRole('heading', { name: 'Appearance' }).click();
	await page.keyboard.press('Tab');
	const system = theme.getByRole('radio', { name: 'System' });
	await expect(system).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('radiogroup', { name: 'Theme' }).locator(':focus')).toHaveCount(0);
	await page.keyboard.press('Shift+Tab');
	await expect(system).toBeFocused();

	await page.keyboard.press('ArrowRight');
	const light = theme.getByRole('radio', { name: 'Light' });
	await expect(light).toBeFocused();
	await expect(light).toHaveAttribute('aria-checked', 'true');
	await page.keyboard.press('End');
	const dark = theme.getByRole('radio', { name: 'Dark' });
	await expect(dark).toHaveAttribute('aria-checked', 'true');
	await expect.poll(() => scheme(page)).toBe('dark');
	await expect(tabStops(theme)).toHaveAccessibleName('Dark');
	// Wraps around.
	await page.keyboard.press('ArrowDown');
	await expect(system).toBeFocused();
	await expect(system).toHaveAttribute('aria-checked', 'true');
	await page.keyboard.press('ArrowUp');
	await expect(dark).toHaveAttribute('aria-checked', 'true');
	await page.keyboard.press('Home');
	await expect(system).toHaveAttribute('aria-checked', 'true');
});

test("Weightlifting's tabs switch with the arrow keys and name their panels", async ({ page }) => {
	await gotoHydrated(page, '/utils/weightlifting');
	const tabs = page.getByRole('tablist');
	const plates = tabs.getByRole('tab', { name: 'Plates' });
	const workout = tabs.getByRole('tab', { name: 'Workout' });
	await expect(tabStops(tabs)).toHaveCount(1);
	await plates.focus();
	await page.keyboard.press('ArrowRight');
	await expect(workout).toBeFocused();
	await expect(workout).toHaveAttribute('aria-selected', 'true');
	const panel = page.getByRole('tabpanel', { name: 'Workout' });
	await expect(panel).toBeVisible();
	await expect(workout).toHaveAttribute('aria-controls', (await panel.getAttribute('id'))!);
	await page.keyboard.press('ArrowLeft');
	await expect(plates).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('tabpanel', { name: 'Plates' })).toBeVisible();
	await expect(panel).toBeHidden();
});

test('side by side, the keyboard skips the hidden Workout tab', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await gotoHydrated(page, '/utils/weightlifting');
	const tabs = page.getByRole('tablist');
	const plates = tabs.getByRole('tab', { name: /^Plates/ });
	await expect(plates).toHaveAttribute(
		'aria-controls',
		'lifting-panel-plates lifting-panel-workout'
	);
	await plates.focus();
	await page.keyboard.press('ArrowRight');
	const history = tabs.getByRole('tab', { name: 'History' });
	await expect(history).toBeFocused();
	await expect(history).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('ArrowRight');
	await expect(plates).toBeFocused();
	await expect(plates).toHaveAttribute('aria-selected', 'true');
});
