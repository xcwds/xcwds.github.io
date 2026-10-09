import { error } from '@sveltejs/kit';
import { articles, getArticle } from '$lib/guide';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => articles.map(({ slug }) => ({ slug }));

export const load: PageLoad = ({ params }) => {
	const article = getArticle(params.slug);
	if (!article) error(404, 'Guide article not found');
	return { article };
};
