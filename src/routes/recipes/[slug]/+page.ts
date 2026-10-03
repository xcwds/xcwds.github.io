import { error } from '@sveltejs/kit';
import { getRecipe, recipes } from '$lib/recipes';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => recipes.map(({ slug }) => ({ slug }));

export const load: PageLoad = ({ params }) => {
	const recipe = getRecipe(params.slug);
	if (!recipe) error(404, 'Recipe not found');
	return { recipe };
};
