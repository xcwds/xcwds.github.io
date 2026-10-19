/**
 * The Magnifier (#216): the views it offers and the maths for moving around a frozen picture.
 * The camera itself is `app.camera` from `@xcwds/plugin-camera`.
 */

/** Ways to show the picture, as CSS filters on the video (and the frozen picture). */
export const VIEWS = [
	{ id: 'normal', label: 'Normal', filter: 'none' },
	{ id: 'contrast', label: 'High contrast', filter: 'grayscale(1) contrast(2)' },
	{ id: 'inverted', label: 'Inverted', filter: 'grayscale(1) invert(1) contrast(1.5)' }
] as const;

export type ViewId = (typeof VIEWS)[number]['id'];

/** How far a frozen picture zooms, on top of the zoom it was frozen at. */
export const FROZEN_ZOOM = { min: 1, max: 8, step: 0.1 };

export type Pan = { x: number; y: number };

/**
 * Keeps a picture scaled by `zoom` about its centre covering a `width`×`height` frame: the
 * offset (in the picture's own, unscaled pixels) can move it at most until an edge shows.
 */
export function clampPan(pan: Pan, zoom: number, width: number, height: number): Pan {
	const z = Math.max(1, zoom);
	const maxX = (width * (z - 1)) / (2 * z);
	const maxY = (height * (z - 1)) / (2 * z);
	const clamp = (v: number, max: number) =>
		(Number.isFinite(v) ? Math.min(max, Math.max(-max, v)) : 0) || 0;
	return { x: clamp(pan.x, maxX), y: clamp(pan.y, maxY) };
}

/** A drag of (`dx`, `dy`) screen pixels, as an offset in the picture's unscaled pixels. */
export const dragBy = (pan: Pan, dx: number, dy: number, zoom: number): Pan => ({
	x: pan.x + dx / Math.max(1, zoom),
	y: pan.y + dy / Math.max(1, zoom)
});
