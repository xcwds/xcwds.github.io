import { expect, test, type Locator } from '@playwright/test';
import { gotoHydrated } from './helpers';

// Segmented controls behave like the radio groups and tabs they're announced as (#138).
test.use({ viewport: { width: 390, height: 844 } });

const tabStops = (group: Locator) => group.locator('[tabindex="0"]');

// The theme and navigation pickers are native radio buttons now (@xcwds/plugin-settings, #135).
test('the weightlifting units control is one Tab stop and the arrow keys change it', async ({
	page
}) => {
	await gotoHydrated(page, '/settings');
	const units = page.getByRole('radiogroup', { name: 'Weightlifting units' });
	await expect(tabStops(units)).toHaveCount(1);
	await expect(tabStops(units)).toHaveAccessibleName('Pounds (lb)');

	// Tab reaches the checked option and then leaves the group.
	await page.getByRole('heading', { name: 'Weightlifting Calculator' }).click();
	await page.keyboard.press('Tab');
	const lb = units.getByRole('radio', { name: 'Pounds (lb)' });
	await expect(lb).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(units.locator(':focus')).toHaveCount(0);
	await page.keyboard.press('Shift+Tab');
	await expect(lb).toBeFocused();

	await page.keyboard.press('ArrowRight');
	const kg = units.getByRole('radio', { name: 'Kilograms (kg)' });
	await expect(kg).toBeFocused();
	await expect(kg).toHaveAttribute('aria-checked', 'true');
	await expect(tabStops(units)).toHaveAccessibleName('Kilograms (kg)');
	// Wraps around.
	await page.keyboard.press('ArrowDown');
	await expect(lb).toBeFocused();
	await expect(lb).toHaveAttribute('aria-checked', 'true');
	await page.keyboard.press('ArrowUp');
	await expect(kg).toHaveAttribute('aria-checked', 'true');
	await page.keyboard.press('Home');
	await expect(lb).toHaveAttribute('aria-checked', 'true');
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
