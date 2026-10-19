import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

// Level and compass (#217), driven by synthetic orientation events.
test.use({ viewport: { width: 390, height: 844 } });

/** Sends `count` readings, enough for the smoothing to settle on them. */
async function tilt(
	page: Page,
	reading: { beta: number; gamma: number; alpha?: number },
	{ type = 'deviceorientation', count = 60 } = {}
) {
	await page.evaluate(
		({ reading, type, count }) => {
			for (let i = 0; i < count; i++)
				window.dispatchEvent(
					new DeviceOrientationEvent(type, { alpha: 0, ...reading, absolute: false })
				);
		},
		{ reading, type, count }
	);
}

test('the bubble follows the tilt, reads level at 0°, and calibrates', async ({ page }) => {
	await gotoHydrated(page, '/utils/level');
	const angle = page.getByTestId('level-angle');
	await tilt(page, { beta: 0, gamma: 0 });
	await expect(angle).toHaveText('Level');
	await expect(angle).toHaveAttribute('data-level', 'true');
	// Screen readers hear only the change into or out of level, not every reading.
	const status = page.getByTestId('level-status');
	await expect(status).toHaveText('Level');
	await expect(page.locator('main [aria-live]')).toHaveCount(1);

	// Lying flat, tipped: the angle shows and the bubble moves to the higher side (left).
	await tilt(page, { beta: 0, gamma: 3 });
	await expect(angle).toHaveText('3.0°');
	await expect(status).toHaveText('Not level');
	const bubble = page.getByTestId('bubble');
	await expect(bubble).toHaveAttribute('style', /translate\(-[\d.]+rem, 0rem\)/);

	// Calibrate makes this read 0°, and keeps doing so after a reload; Reset clears it.
	await page.getByRole('button', { name: 'Calibrate' }).click();
	await expect(page.getByTestId('toast')).toContainText('This position now reads 0°.');
	await tilt(page, { beta: 0, gamma: 3 }, { count: 5 });
	await expect(angle).toHaveText('Level');
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await tilt(page, { beta: 0, gamma: 3 });
	await expect(angle).toHaveText('Level');
	await page.getByRole('button', { name: 'Reset' }).click();
	await expect(angle).toHaveText('3.0°');

	// Standing on an edge, turned a little: the tube shows instead.
	await tilt(page, { beta: 88, gamma: 0 });
	await expect(page.getByTestId('level-tube')).toBeVisible();
	await expect(angle).toHaveText('Level');
});

test('the compass reads an absolute heading, or says it has none', async ({ page }) => {
	await gotoHydrated(page, '/utils/level');
	await tilt(page, { beta: 0, gamma: 0 });
	await page.getByRole('button', { name: 'Compass' }).click();
	// No absolute reading arrives in this browser: after a moment, it says so.
	await expect(page.getByTestId('no-compass')).toBeVisible();

	await tilt(page, { beta: 0, gamma: 0, alpha: 90 }, { type: 'deviceorientationabsolute' });
	await expect(page.getByTestId('heading')).toHaveText('270° W');
	await expect(page.getByText('Magnetic north')).toBeVisible();
});

/** Gives the browser `requestPermission` as Safari on iOS has it, or takes it away. */
function permission(page: Page, value: 'granted' | 'none') {
	return page.addInitScript((value) => {
		(window as unknown as { asked: number }).asked = 0;
		Object.defineProperty(DeviceOrientationEvent, 'requestPermission', {
			configurable: true,
			value:
				value === 'none'
					? undefined
					: async () => {
							(window as unknown as { asked: number }).asked++;
							return value;
						}
		});
	}, value);
}

const asked = (page: Page) => page.evaluate(() => (window as unknown as { asked: number }).asked);

test('says it needs a phone where there are no sensors', async ({ page }) => {
	await permission(page, 'none');
	await gotoHydrated(page, '/utils/level');
	await expect(page.getByTestId('no-sensors')).toBeVisible();
});

test('asks first where the browser wants a tap and sends nothing until then (iOS)', async ({
	page
}) => {
	await permission(page, 'granted');
	await gotoHydrated(page, '/utils/level');
	await page.getByRole('button', { name: 'Start' }).click();
	expect(await asked(page)).toBe(1);
	await tilt(page, { beta: 0, gamma: 0 });
	await expect(page.getByTestId('level-angle')).toHaveText('Level');
});

test('never asks where readings arrive anyway (newer Chrome)', async ({ page }) => {
	await permission(page, 'granted');
	await gotoHydrated(page, '/utils/level');
	await tilt(page, { beta: 0, gamma: 0 });
	await expect(page.getByTestId('level-angle')).toHaveText('Level');
	await page.waitForTimeout(2500);
	await expect(page.getByRole('button', { name: 'Start' })).toHaveCount(0);
	expect(await asked(page)).toBe(0);
});
