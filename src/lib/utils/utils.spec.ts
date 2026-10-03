import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeDough, doughDefaults } from './dough';
import { formatDuration } from './time';
import { Timer } from './timer.svelte';

describe('computeDough', () => {
	it('splits the total dough weight by baker percentages', () => {
		const r = computeDough({
			...doughDefaults,
			balls: 2,
			ballWeight: 500,
			hydration: 60,
			salt: 2,
			yeast: 0,
			oil: 0,
			sugar: 0
		});
		expect(r.total).toBe(1000);
		expect(r.flour).toBeCloseTo(1000 / 1.62);
		expect(r.water / r.flour).toBeCloseTo(0.6);
		expect(r.flour + r.water + r.salt).toBeCloseTo(1000);
	});

	it('reproduces the site pizza dough recipe from the defaults', () => {
		const r = computeDough(doughDefaults);
		expect(r.flour).toBeGreaterThan(640);
		expect(r.flour).toBeLessThan(660);
		expect(r.water).toBeGreaterThan(385);
		expect(r.water).toBeLessThan(400);
	});

	it('treats negative inputs as zero', () => {
		const r = computeDough({ ...doughDefaults, balls: -1 });
		expect(r.total).toBe(0);
		expect(r.flour).toBe(0);
	});
});

describe('formatDuration', () => {
	it('formats minutes and hours, rounding up partial seconds', () => {
		expect(formatDuration(90_000)).toBe('1:30');
		expect(formatDuration(89_001)).toBe('1:30');
		expect(formatDuration(0)).toBe('0:00');
		expect(formatDuration(-5000)).toBe('0:00');
		expect(formatDuration(3_725_000)).toBe('1:02:05');
	});
});

describe('Timer', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('counts down from wall-clock time and fires once', () => {
		const onDone = vi.fn();
		const timer = new Timer(2000, onDone);
		timer.start();
		vi.advanceTimersByTime(1000);
		expect(timer.remaining).toBe(1000);
		vi.advanceTimersByTime(1500);
		expect(timer.done).toBe(true);
		expect(timer.remaining).toBeLessThan(0);
		vi.advanceTimersByTime(1000);
		expect(onDone).toHaveBeenCalledTimes(1);
		timer.destroy();
	});

	it('pauses, adds time, and resets', () => {
		const timer = new Timer(90_000);
		timer.start();
		vi.advanceTimersByTime(30_000);
		timer.pause();
		vi.advanceTimersByTime(30_000);
		expect(timer.remaining).toBe(60_000);
		timer.add(15_000);
		expect(timer.remaining).toBe(75_000);
		timer.add(-100_000);
		expect(timer.remaining).toBe(0);
		timer.reset(90_000);
		expect(timer.remaining).toBe(90_000);
		expect(timer.running).toBe(false);
	});

	it('restores a saved running timer', () => {
		const a = new Timer(60_000);
		a.start();
		const saved = a.toJSON();
		a.destroy();
		vi.advanceTimersByTime(20_000);
		const b = new Timer(0);
		b.restore(saved);
		expect(b.running).toBe(true);
		expect(b.remaining).toBe(40_000);
		b.destroy();
	});
});
