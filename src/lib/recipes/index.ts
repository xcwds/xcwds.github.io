export type Recipe = {
	slug: string;
	name: string;
	emoji?: string;
	tags: string[];
	description: string;
	servings?: string;
	time?: string;
	notes?: string[];
	ingredients: string[];
	instructions: string[];
	tips?: string[];
	source?: string;
	notion: {
		id: string;
		url: string;
		lastEditedTime: string;
	};
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
