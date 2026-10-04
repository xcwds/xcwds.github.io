import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('data saved before the storage module is migrated and still shows up', async ({ page }) => {
	// Simulate a returning visitor whose data uses the old, unprefixed keys.
	await page.addInitScript(() => {
		if (sessionStorage.getItem('seeded')) return;
		sessionStorage.setItem('seeded', '1');
		localStorage.setItem('coffee-timer-duration', '120000');
		localStorage.setItem('lifting-tab', 'workout');
		localStorage.setItem(
			'lifting-workout',
			JSON.stringify({
				date: 'Fri, Oct 3, 2026',
				exercises: [{ id: 1, name: 'Deadlift', sets: [{ id: 2, weight: 225, reps: 5 }] }]
			})
		);
	});

	await gotoHydrated(page, '/utils/coffee-timer');
	await expect(page.getByTestId('display')).toHaveText('2:00');

	await gotoHydrated(page, '/utils/weightlifting');
	await expect(page.getByRole('tab', { name: 'Workout' })).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByLabel('Exercise 1 name')).toHaveValue('Deadlift');

	// Opening the calculator saves nothing new (it only saves changes).
	const keys = await page.evaluate(() => Object.keys(localStorage).sort());
	expect(keys).toEqual([
		'app:coffee-timer:duration',
		'app:version',
		'app:weightlifting:tab',
		'app:weightlifting:workout'
	]);
});

test('the app still works when storage is blocked', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'localStorage', {
			get() {
				throw new DOMException('blocked', 'SecurityError');
			}
		});
	});
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));

	await gotoHydrated(page, '/utils/weightlifting');
	await page.getByRole('button', { name: 'Add 45 lb', exact: true }).click();
	await expect(page.getByTestId('total')).toHaveText('135 lb');
	await gotoHydrated(page, '/utils/coffee-timer');
	await page.getByRole('button', { name: '+30s' }).click();
	await expect(page.getByTestId('display')).toHaveText('2:00');
	expect(errors).toEqual([]);
});
