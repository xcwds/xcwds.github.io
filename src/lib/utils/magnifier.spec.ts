import { describe, expect, it } from 'vitest';
import { VIEWS, clampPan, dragBy } from './magnifier';

describe('clampPan', () => {
	it('keeps an unzoomed picture centred', () => {
		expect(clampPan({ x: 50, y: -20 }, 1, 400, 300)).toEqual({ x: 0, y: 0 });
	});

	it('lets a zoomed picture move until its edge reaches the frame', () => {
		// At 2× a 400 px wide frame shows half the picture: 100 unscaled px either way.
		expect(clampPan({ x: 500, y: -500 }, 2, 400, 300)).toEqual({ x: 100, y: -75 });
		expect(clampPan({ x: 30, y: 10 }, 2, 400, 300)).toEqual({ x: 30, y: 10 });
		expect(clampPan({ x: NaN, y: 10 }, 4, 400, 300)).toEqual({ x: 0, y: 10 });
	});
});

describe('dragBy', () => {
	it('moves less the more the picture is zoomed', () => {
		expect(dragBy({ x: 0, y: 0 }, 40, -20, 1)).toEqual({ x: 40, y: -20 });
		expect(dragBy({ x: 10, y: 0 }, 40, -20, 4)).toEqual({ x: 20, y: -5 });
	});
});

describe('VIEWS', () => {
	it('start with the plain picture', () => {
		expect(VIEWS[0]).toMatchObject({ id: 'normal', filter: 'none' });
		expect(new Set(VIEWS.map((v) => v.id)).size).toBe(VIEWS.length);
	});
});
