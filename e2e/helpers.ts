import type { BrowserContext, Page } from '@playwright/test';

/** Navigates and waits for SvelteKit to hydrate, so typed input isn't lost or doubled. */
export async function gotoHydrated(page: Page, path: string) {
	await page.goto(path);
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

type Unit = 'lb' | 'kg';
const unlimited = (unit: Unit) =>
	Object.fromEntries(
		(unit === 'lb' ? [45, 35, 25, 10, 5, 2.5, 1.25] : [25, 20, 15, 10, 5, 2.5, 1.25]).map((p) => [
			p,
			null
		])
	);

/** The calculator's stations before #82 (light barbell, dumbbells, kettlebell) as a set. */
export function testGym(unit: Unit) {
	const [barbell, light, handle, kettlebell] =
		unit === 'lb' ? [45, 25, 7.5, 5] : [20, 15, 2.5, 2.5];
	return {
		id: `test-${unit}`,
		name: `Test gym (${unit})`,
		unit,
		bars: [
			{
				id: 'barbell',
				name: `Barbell (${barbell} ${unit})`,
				type: 'barbell',
				weight: barbell,
				count: 1
			},
			{ id: 'light', name: `Barbell (${light} ${unit})`, type: 'barbell', weight: light, count: 1 },
			{ id: 'dumbbell', name: 'Dumbbell', type: 'dumbbell', weight: handle, count: 2 },
			{ id: 'kettlebell', name: 'Kettlebell', type: 'kettlebell', weight: kettlebell, count: 1 }
		],
		plates: unlimited(unit)
	};
}

/** The home gym from #82: no 45 lb barbell, 2×45, 2×25, 8×10, 4×5, 4×2.5, 4×1.25. */
export const HOME_GYM = {
	id: 'home',
	name: 'Home gym',
	unit: 'lb',
	bars: [
		{ id: 'bar', name: 'Barbell (35 lb)', type: 'barbell', weight: 35, count: 1 },
		{ id: 'db', name: 'Dumbbell', type: 'dumbbell', weight: 5, count: 2 }
	],
	plates: { 45: 2, 35: 0, 25: 2, 10: 8, 5: 4, 2.5: 4, 1.25: 4 }
};

/**
 * Saves equipment sets (#82) before the app first loads. Later loads keep whatever the app has
 * saved since, so tests can change them.
 */
export async function seedLifting(
	target: Page | BrowserContext,
	lifting: { activeSet: string; sets: object[]; unit?: Unit }
) {
	await target.addInitScript((value) => {
		if (localStorage.getItem('app:settings') !== null) return;
		localStorage.setItem('app:version', '3');
		localStorage.setItem('app:settings', JSON.stringify({ lifting: value }));
	}, lifting);
}
