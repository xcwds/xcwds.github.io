/** Baker's percentages: every ingredient is a percent of the flour weight. */
export type DoughInput = {
	balls: number;
	ballWeight: number;
	hydration: number;
	salt: number;
	yeast: number;
	oil: number;
	sugar: number;
};

export type DoughResult = {
	flour: number;
	water: number;
	salt: number;
	yeast: number;
	oil: number;
	sugar: number;
	total: number;
};

/** Defaults derived from the Pizza Dough recipe on this site (650 g flour, 4 balls). */
export const doughDefaults: DoughInput = {
	balls: 4,
	ballWeight: 280,
	hydration: 60,
	salt: 1.8,
	yeast: 0.9,
	oil: 5.4,
	sugar: 3.2
};

export function computeDough(input: DoughInput): DoughResult {
	const total = Math.max(0, input.balls) * Math.max(0, input.ballWeight);
	const percents = [input.hydration, input.salt, input.yeast, input.oil, input.sugar];
	const flour = total / (1 + percents.reduce((sum, p) => sum + Math.max(0, p), 0) / 100);
	const of = (percent: number) => (flour * Math.max(0, percent)) / 100;
	return {
		flour,
		water: of(input.hydration),
		salt: of(input.salt),
		yeast: of(input.yeast),
		oil: of(input.oil),
		sugar: of(input.sugar),
		total
	};
}
