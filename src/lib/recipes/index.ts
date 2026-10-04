import type { FoodId } from '$lib/utils/oven';
import type { Ingredient, RecipeYield } from './scale';

export type { Ingredient, RecipeYield } from './scale';

/** The oven step a recipe is built around, for the in-recipe temperature/time converter. */
export type RecipeOven = {
	/** Oven temperature, °F. */
	temp: number;
	/** Bake/roast time in minutes, or a range. */
	minutes: number | [number, number];
	/** Converter preset: what's in the oven. */
	food: FoodId;
};

/**
 * A countdown a step can start ("Bake 9–11 minutes"). A range starts at the low end, so you
 * check early. `oven` steps follow the "different temperature" panel when it's in use.
 */
export type StepTimer = {
	minutes: number | [number, number];
	/** Timer label in the Cooking Timer list; defaults to the recipe name. */
	label?: string;
	oven?: boolean;
};

/** A step: plain text, or text with a timer. */
export type Instruction = string | { text: string; timer?: StepTimer };

export const stepText = (step: Instruction) => (typeof step === 'string' ? step : step.text);
export const stepTimer = (step: Instruction) => (typeof step === 'string' ? undefined : step.timer);

export type Recipe = {
	slug: string;
	name: string;
	emoji?: string;
	tags: string[];
	description: string;
	/** What it makes; the page offers a servings target that scales the ingredients. */
	yield: RecipeYield;
	time?: string;
	oven?: RecipeOven;
	notes?: string[];
	ingredients: Ingredient[];
	instructions: Instruction[];
	tips?: string[];
	source?: string;
};

const modules = import.meta.glob<Recipe>('./data/*.json', { eager: true, import: 'default' });

export const recipes: Recipe[] = Object.values(modules).sort((a, b) =>
	a.name.localeCompare(b.name)
);

export function getRecipe(slug: string): Recipe | undefined {
	return recipes.find((recipe) => recipe.slug === slug);
}

export function searchRecipes(list: Recipe[], query: string): Recipe[] {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return list;
	return list.filter((recipe) => {
		const haystack = [recipe.name, ...recipe.tags].join(' ').toLowerCase();
		return terms.every((term) => haystack.includes(term));
	});
}
