/**
 * Baking pans, for scaling a recipe to the pan you have. Scaling uses each pan's capacity (how
 * much it holds, from standard pan-substitution charts), not just its area, since loaf pans are
 * much deeper than square ones.
 */
export const PANS = [
	{ id: 'square-8', label: '8×8-inch square (20×20 cm)', cups: 8 },
	{ id: 'square-9', label: '9×9-inch square (23×23 cm)', cups: 10 },
	{ id: 'rect-7x11', label: '7×11-inch (18×28 cm)', cups: 8 },
	{ id: 'rect-9x13', label: '9×13-inch (23×33 cm)', cups: 15 },
	{ id: 'loaf-8', label: '8½×4½-inch loaf (21×11 cm)', cups: 6 },
	{ id: 'loaf-9', label: '9×5-inch loaf (23×13 cm)', cups: 8 },
	{ id: 'round-8', label: '8-inch round (20 cm)', cups: 6 },
	{ id: 'round-9', label: '9-inch round (23 cm)', cups: 8 },
	{ id: 'round-10', label: '10-inch round (25 cm)', cups: 11 }
] as const;

export type PanId = (typeof PANS)[number]['id'];
export type Pan = (typeof PANS)[number];

export const getPan = (id: string): Pan | undefined => PANS.find((p) => p.id === id);

/** How much to multiply a recipe written for `from` to fill `to`. */
export function panRatio(from: PanId, to: PanId): number {
	return getPan(to)!.cups / getPan(from)!.cups;
}
