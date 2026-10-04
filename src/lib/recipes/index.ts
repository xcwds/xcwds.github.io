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

export type Recipe = {
	slug: string;
	name: string;
	emoji?: string;
	tags: string[];
	description: string;
	/** Free-text yield (Notion imports). Recipes with `yield` can be scaled instead. */
	servings?: string;
	/** Structured yield; with scalable ingredients, the page offers a servings target. */
	yield?: RecipeYield;
	time?: string;
	oven?: RecipeOven;
	notes?: string[];
	ingredients: Ingredient[];
	instructions: string[];
	tips?: string[];
	source?: string;
	/** Set on recipes imported from Notion (docs/notion-recipes.md); classics have none. */
	notion?: {
		id: string;
		url: string;
		lastEditedTime: string;
	};
};

const modules = import.meta.glob<Recipe>('./data/*.json', { eager: true, import: 'default' });

export const recipes: Recipe[] = Object.values(modules).sort((a, b) =>
	a.name.localeCompare(b.name)
);

/** Classic, back-pocket recipes (tagged Classic) are listed first on /recipes. */
export const isClassic = (recipe: Recipe) => recipe.tags.includes('Classic');

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
