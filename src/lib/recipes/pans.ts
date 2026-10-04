/**
 * Baking pans, for scaling a recipe to the pan you have. Scaling uses each pan's capacity (`cups`
 * it holds, from standard pan-substitution charts), not just its area, since loaf pans are much
 * deeper than square ones. `area` (square inches) gives the batter's depth, for bake times.
 */
export const PANS = [
	{ id: 'square-8', label: '8×8-inch square (20×20 cm)', cups: 8, area: 64 },
	{ id: 'square-9', label: '9×9-inch square (23×23 cm)', cups: 10, area: 81 },
	{ id: 'rect-7x11', label: '7×11-inch (18×28 cm)', cups: 8, area: 77 },
	{ id: 'rect-9x13', label: '9×13-inch (23×33 cm)', cups: 15, area: 117 },
	{ id: 'loaf-8', label: '8½×4½-inch loaf (21×11 cm)', cups: 6, area: 38.25 },
	{ id: 'loaf-9', label: '9×5-inch loaf (23×13 cm)', cups: 8, area: 45 },
	{ id: 'round-8', label: '8-inch round (20 cm)', cups: 6, area: Math.PI * 4 ** 2 },
	{ id: 'round-9', label: '9-inch round (23 cm)', cups: 8, area: Math.PI * 4.5 ** 2 },
	{ id: 'round-10', label: '10-inch round (25 cm)', cups: 11, area: Math.PI * 5 ** 2 }
] as const;

export type PanId = (typeof PANS)[number]['id'];
export type Pan = (typeof PANS)[number];

export const getPan = (id: string): Pan | undefined => PANS.find((p) => p.id === id);

/** How much to multiply a recipe written for `from` to fill `to`. */
export function panRatio(from: PanId, to: PanId): number {
	return getPan(to)!.cups / getPan(from)!.cups;
}

const depth = (pan: Pan) => pan.cups / pan.area;

/**
 * How the batter's depth changes when the recipe is scaled (by `panRatio`) from `from` to `to`.
 * Bake time for batters tracks depth closely enough to estimate when to start checking.
 */
export function panDepthRatio(from: PanId, to: PanId): number {
	return depth(getPan(to)!) / depth(getPan(from)!);
}
