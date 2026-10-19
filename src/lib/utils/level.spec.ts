import { describe, expect, it } from 'vitest';
import {
	calibrate,
	compassPoint,
	edgeTilt,
	headingOf,
	levelMode,
	parseCalibration,
	readLevel,
	smooth,
	smoothHeading,
	toScreen,
	upVector
} from './level';

const close = (n: number) => Math.round(n * 1000) / 1000 + 0;

describe('upVector', () => {
	it('points out of the screen lying flat, and out of the top standing upright', () => {
		expect(Object.values(upVector(0, 0)).map(close)).toEqual([0, 0, 1]);
		expect(Object.values(upVector(90, 0)).map(close)).toEqual([0, 1, 0]);
		// Tilting right (positive gamma) lowers the right side.
		expect(upVector(0, 10).x).toBeLessThan(0);
	});
});

describe('readLevel', () => {
	it('reads a bubble lying flat, in degrees each way', () => {
		const level = readLevel(upVector(2, -3));
		expect(level.mode).toBe('flat');
		if (level.mode !== 'flat') return;
		expect(close(level.x)).toBeCloseTo(3, 1);
		expect(close(level.y)).toBeCloseTo(2, 1);
		expect(level.level).toBe(false);
		expect(readLevel(upVector(0.2, 0.2)).level).toBe(true);
	});

	it('reads a bar standing on an edge, upright or sideways', () => {
		expect(readLevel(upVector(90, 0))).toMatchObject({ mode: 'edge', level: true });
		// Upright, turned anticlockwise: up is towards the screen's right.
		const turned = { x: Math.sin(3 * (Math.PI / 180)), y: Math.cos(3 * (Math.PI / 180)), z: 0 };
		expect(levelMode(turned)).toBe('edge');
		expect(close(edgeTilt(turned))).toBe(3);
		// On its side (landscape): level again at 90°, and 0.1 rad (5.7°) off reads so.
		expect(close(edgeTilt({ x: 1, y: 0, z: 0 }))).toBe(0);
		expect(close(edgeTilt({ x: Math.cos(0.1), y: -Math.sin(0.1), z: 0 }))).toBeCloseTo(5.73, 1);
	});

	it('takes the calibration off the way the phone is held', () => {
		const tilted = upVector(1, 1);
		const calibration = calibrate(tilted);
		expect(readLevel(tilted, calibration)).toMatchObject({ mode: 'flat', level: true });
		expect(calibration.edge).toBeUndefined();
		const both = calibrate(upVector(88, 0), calibration);
		expect(both.flat).toEqual(calibration.flat);
		expect(readLevel(upVector(88, 0), both).level).toBe(true);
	});
});

describe('toScreen', () => {
	it('turns readings with the screen', () => {
		const upright = { x: 0, y: 1, z: 0 };
		expect(toScreen(upright, 0)).toEqual(upright);
		// Turned anticlockwise into landscape, level: up is the phone's right side, the screen's top.
		expect(toScreen({ x: 1, y: 0, z: 0 }, 90)).toEqual({ x: 0, y: 1, z: 0 });
		expect(toScreen({ x: -1, y: 0, z: 0 }, 270)).toEqual({ x: 0, y: 1, z: 0 });
		expect(toScreen(upright, 90)).toEqual({ x: -1, y: 0, z: 0 });
	});
});

describe('smooth', () => {
	it('moves part of the way and stays a unit vector', () => {
		const a = upVector(0, 0);
		const b = upVector(90, 0);
		const s = smooth(a, b, 0.5);
		expect(close(Math.hypot(s.x, s.y, s.z))).toBe(1);
		expect(s.y).toBeGreaterThan(0);
		expect(s.y).toBeLessThan(1);
		expect(smooth(undefined, b)).toBe(b);
	});
});

describe('parseCalibration', () => {
	it('keeps valid offsets only', () => {
		expect(parseCalibration({ flat: { x: 1, y: -2 }, edge: 3 })).toEqual({
			flat: { x: 1, y: -2 },
			edge: 3
		});
		expect(parseCalibration({ edge: 50 })).toBeUndefined();
		expect(parseCalibration({ flat: { x: 'a', y: 0 } })).toBeUndefined();
		expect(parseCalibration({})).toBeUndefined();
		expect(parseCalibration(null)).toBeUndefined();
	});
});

describe('headingOf', () => {
	it('reads each browser’s event', () => {
		expect(headingOf({ alpha: 90 }, true)).toBe(270);
		expect(headingOf({ alpha: 90, absolute: true }, false)).toBe(270);
		expect(headingOf({ alpha: 0, webkitCompassHeading: 45 }, false)).toBe(45);
		expect(headingOf({ alpha: 90, absolute: false }, false)).toBeUndefined();
		expect(headingOf({ alpha: null }, true)).toBeUndefined();
		// The screen turned sideways turns the heading with it.
		expect(headingOf({ alpha: 0 }, true, 90)).toBe(90);
	});

	it('smooths the short way across north', () => {
		expect(smoothHeading(350, 10, 0.5)).toBe(0);
		expect(smoothHeading(undefined, 10)).toBe(10);
		expect(compassPoint(0)).toBe('N');
		expect(compassPoint(359)).toBe('N');
		expect(compassPoint(134)).toBe('SE');
	});
});
