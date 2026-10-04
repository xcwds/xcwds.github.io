import { describe, expect, it } from 'vitest';
import { PANS, getPan, panDepthRatio, panRatio } from './pans';

describe('pans', () => {
	it('have unique ids and positive capacities', () => {
		expect(new Set(PANS.map((p) => p.id)).size).toBe(PANS.length);
		for (const pan of PANS) expect(pan.cups).toBeGreaterThan(0);
	});

	it('scale by capacity, not area', () => {
		expect(panRatio('square-8', 'square-8')).toBe(1);
		expect(panRatio('square-8', 'rect-9x13')).toBeCloseTo(15 / 8);
		// A 9×5 loaf has less area than an 8×8 square but holds as much.
		expect(panRatio('loaf-9', 'square-8')).toBe(1);
		expect(panRatio('loaf-9', 'loaf-8')).toBeCloseTo(0.75);
		expect(getPan('nope')).toBeUndefined();
	});

	it('estimate bake time from the change in batter depth', () => {
		expect(panDepthRatio('loaf-9', 'loaf-9')).toBe(1);
		// The loaf's batter spreads out in a 9×9 square: about 30% shallower.
		expect(panDepthRatio('loaf-9', 'square-9')).toBeCloseTo(0.69, 2);
		// 8×8 and 9×13 are both 2 inches deep.
		expect(panDepthRatio('square-8', 'rect-9x13')).toBeCloseTo(1, 1);
	});
});
