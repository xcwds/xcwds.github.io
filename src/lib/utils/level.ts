/**
 * Level and compass (#217): the maths behind a bubble level and a compass, from the phone's
 * `deviceorientation` events. No location, no network: magnetic north only.
 *
 * Readings become the "up" direction in the phone's own axes (x to the right of the screen, y to
 * its top, z out of it), which has no wrap-around at ±180° and so smooths cleanly.
 */

export type Vector = { x: number; y: number; z: number };

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Within this many degrees of level counts as level. */
export const LEVEL_TOLERANCE = 0.5;

/** World up in the phone's axes, from `beta` (front-back tilt) and `gamma` (left-right), in degrees. */
export function upVector(beta: number, gamma: number): Vector {
	const b = beta * RAD;
	const g = gamma * RAD;
	return { x: -Math.cos(b) * Math.sin(g), y: Math.sin(b), z: Math.cos(b) * Math.cos(g) };
}

/**
 * `up` in the screen's axes when the screen is turned (`screen.orientation.angle`, 0, 90, 180 or
 * 270; 90 is the phone turned anticlockwise, its right side up): sensors report in the phone's
 * own axes, but the page turns with the screen.
 */
export function toScreen(up: Vector, angle: number): Vector {
	const a = angle * RAD;
	const round = (n: number) => Math.round(n * 1e12) / 1e12 || 0;
	return {
		x: round(up.x * Math.cos(a) - up.y * Math.sin(a)),
		y: round(up.x * Math.sin(a) + up.y * Math.cos(a)),
		z: up.z
	};
}

/** A low-pass filter step: `k` of the way from `previous` to `next` (1 jumps straight there). */
export function smooth(previous: Vector | undefined, next: Vector, k = 0.2): Vector {
	if (!previous) return next;
	const v = {
		x: previous.x + k * (next.x - previous.x),
		y: previous.y + k * (next.y - previous.y),
		z: previous.z + k * (next.z - previous.z)
	};
	const length = Math.hypot(v.x, v.y, v.z) || 1;
	return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/** `flat`: lying on its back (or face) within 45°, shown as a bubble. `edge`: standing, a bar. */
export const levelMode = (up: Vector): 'flat' | 'edge' =>
	Math.abs(up.z) >= Math.SQRT1_2 ? 'flat' : 'edge';

const clampUnit = (n: number) => Math.min(1, Math.max(-1, n));

/**
 * Flat: how far the right side (`x`) and the top (`y`) are raised, in degrees. Positive means
 * that side is higher, which is where a bubble floats.
 */
export const flatTilt = (up: Vector) => ({
	x: Math.asin(clampUnit(up.x)) * DEG,
	y: Math.asin(clampUnit(up.y)) * DEG
});

/**
 * Standing on an edge: how far the phone is turned from the nearest upright or sideways
 * position, in degrees (−45 to 45); positive when it's turned anticlockwise. The true level
 * line on screen is turned that far clockwise.
 */
export function edgeTilt(up: Vector): number {
	const angle = Math.atan2(up.x, up.y) * DEG;
	return angle - Math.round(angle / 90) * 90;
}

/** Calibration: the reading taken as zero for each way of holding the phone (a rocking case). */
export type Calibration = { flat?: { x: number; y: number }; edge?: number };

export type Level =
	| { mode: 'flat'; x: number; y: number; angle: number; level: boolean }
	| { mode: 'edge'; angle: number; level: boolean };

/** What the level shows for `up`, less the calibration for that way of holding it. */
export function readLevel(up: Vector, calibration: Calibration = {}): Level {
	if (levelMode(up) === 'flat') {
		const raw = flatTilt(up);
		const x = raw.x - (calibration.flat?.x ?? 0);
		const y = raw.y - (calibration.flat?.y ?? 0);
		const angle = Math.hypot(x, y);
		return { mode: 'flat', x, y, angle, level: angle < LEVEL_TOLERANCE };
	}
	const angle = edgeTilt(up) - (calibration.edge ?? 0);
	return { mode: 'edge', angle, level: Math.abs(angle) < LEVEL_TOLERANCE };
}

/** Calibrates the way the phone is held now, keeping the other way's calibration. */
export function calibrate(up: Vector, calibration: Calibration = {}): Calibration {
	return levelMode(up) === 'flat'
		? { ...calibration, flat: flatTilt(up) }
		: { ...calibration, edge: edgeTilt(up) };
}

const isAngle = (v: unknown, limit: number): v is number =>
	typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limit;

/** A saved calibration, or undefined when it isn't one. */
export function parseCalibration(v: unknown): Calibration | undefined {
	if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
	const { flat, edge } = v as Record<string, unknown>;
	const out: Calibration = {};
	if (flat !== undefined) {
		const f = flat as Record<string, unknown> | null;
		if (typeof f !== 'object' || f === null || !isAngle(f.x, 90) || !isAngle(f.y, 90))
			return undefined;
		out.flat = { x: f.x, y: f.y };
	}
	if (edge !== undefined) {
		if (!isAngle(edge, 45)) return undefined;
		out.edge = edge;
	}
	return out.flat || out.edge !== undefined ? out : undefined;
}

/** The orientation event fields the compass reads. */
export type OrientationReading = {
	alpha: number | null;
	absolute?: boolean;
	/** Safari on iOS: degrees clockwise from magnetic north. */
	webkitCompassHeading?: number;
};

const wrap = (deg: number) => ((deg % 360) + 360) % 360;

/**
 * Magnetic heading (0 to 360, clockwise from north) from an orientation event, or undefined
 * when it isn't measured against north. `absoluteEvent`: it came as `deviceorientationabsolute`.
 * `screenAngle`: how far the screen is turned (`screen.orientation.angle`).
 */
export function headingOf(
	event: OrientationReading,
	absoluteEvent: boolean,
	screenAngle = 0
): number | undefined {
	if (typeof event.webkitCompassHeading === 'number' && Number.isFinite(event.webkitCompassHeading))
		return wrap(event.webkitCompassHeading + screenAngle);
	if ((absoluteEvent || event.absolute === true) && typeof event.alpha === 'number')
		return wrap(360 - event.alpha + screenAngle);
	return undefined;
}

/** Smooths a heading across north: `k` of the shortest way from `previous` to `next`. */
export function smoothHeading(previous: number | undefined, next: number, k = 0.2): number {
	if (previous === undefined) return next;
	const delta = ((next - previous + 540) % 360) - 180;
	return wrap(previous + k * delta);
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** The compass point for a heading: `N`, `NE`, … */
export const compassPoint = (heading: number) => POINTS[Math.round(wrap(heading) / 45) % 8]!;
