/**
 * The kitchen guide at /guide: general know-how that isn't tied to one recipe. Each article is
 * one JSON file in `./data/`; see docs/cooking-guide.md for how to write one.
 */

export const CATEGORIES = [
	{ id: 'methods', label: 'Cooking methods' },
	{ id: 'meat', label: 'Meat, poultry & fish' },
	{ id: 'vegetables', label: 'Vegetables' },
	{ id: 'staples', label: 'Eggs, grains, pasta & beans' },
	{ id: 'baking', label: 'Baking' },
	{ id: 'basics', label: 'Kitchen basics & food safety' }
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

/** A table: on phones each row is a card headed by its first cell, so nothing scrolls sideways. */
export type TableBlock = { type: 'table'; columns: string[]; rows: string[][]; caption?: string };

/**
 * A piece of an article section. A bare string is a paragraph. Text supports `**bold**` and
 * links: `[text](guide:slug)`, `[text](guide:slug#section)`, `[text](recipe:slug)`,
 * `[text](tool:/utils/oven-time)`, and `[text](https://…)` to a source in `EXTERNAL_HOSTS`.
 */
export type Block =
	| string
	| { type: 'list'; items: string[]; ordered?: boolean }
	| { type: 'tip'; text: string }
	/** Safety: food safety, burns, fire, carbon monoxide. */
	| { type: 'warning'; text: string }
	| TableBlock
	/** An interactive piece, by name: `doneness` is the doneness chart (DonenessChart.svelte). */
	| { type: 'widget'; widget: 'doneness' };

export type GuideSection = {
	/** Anchor for `guide:slug#id` links; defaults to the heading, slugified. Keep it stable. */
	id?: string;
	heading: string;
	blocks: Block[];
};

export type GuideArticle = {
	slug: string;
	name: string;
	emoji: string;
	category: CategoryId;
	tags: string[];
	/** One or two sentences: shown under the title and on the index. */
	summary: string;
	sections: GuideSection[];
	related?: { guides?: string[]; recipes?: string[]; tools?: string[] };
};

const modules = import.meta.glob<GuideArticle>('./data/*.json', {
	eager: true,
	import: 'default'
});

/** Articles in category order, then by name. */
export const articles: GuideArticle[] = Object.values(modules).sort(
	(a, b) => categoryIndex(a.category) - categoryIndex(b.category) || a.name.localeCompare(b.name)
);

function categoryIndex(id: CategoryId): number {
	return CATEGORIES.findIndex((c) => c.id === id);
}

export function getArticle(slug: string): GuideArticle | undefined {
	return articles.find((article) => article.slug === slug);
}

export function searchArticles(list: GuideArticle[], query: string): GuideArticle[] {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return list;
	return list.filter((article) => {
		const haystack = [article.name, article.summary, ...article.tags].join(' ').toLowerCase();
		return terms.every((term) => haystack.includes(term));
	});
}

/** Articles grouped by category, in category order; empty categories are left out. */
export function byCategory(list: GuideArticle[]) {
	return CATEGORIES.map((category) => ({
		...category,
		articles: list.filter((article) => article.category === category.id)
	})).filter((group) => group.articles.length > 0);
}

export const slugify = (text: string) =>
	text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

export const sectionId = (section: GuideSection) => section.id ?? slugify(section.heading);

/** A piece of inline text: plain, bold, or a link to an article, recipe or tool. */
export type Inline =
	| { kind: 'text'; text: string; bold?: boolean }
	| { kind: 'guide'; text: string; slug: string; section?: string }
	| { kind: 'recipe'; text: string; slug: string }
	| { kind: 'tool'; text: string; path: string }
	| { kind: 'external'; text: string; url: string };

/** Sites inline text may link out to (sources for food-safety numbers). */
export const EXTERNAL_HOSTS = ['www.fsis.usda.gov', 'www.foodsafety.gov'];

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((guide|recipe|tool|https):([^)\s]+)\)/g;

/** Splits text into plain, bold and link pieces (see `Block`). Unknown syntax stays as text. */
export function parseInline(text: string): Inline[] {
	const parts: Inline[] = [];
	let last = 0;
	for (const match of text.matchAll(INLINE)) {
		if (match.index > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
		const [, bold, label, kind, target] = match;
		if (bold !== undefined) parts.push({ kind: 'text', text: bold, bold: true });
		else if (kind === 'guide') {
			const [slug, section] = target.split('#');
			parts.push({ kind: 'guide', text: label, slug, ...(section ? { section } : {}) });
		} else if (kind === 'recipe') parts.push({ kind: 'recipe', text: label, slug: target });
		else if (kind === 'https')
			parts.push({ kind: 'external', text: label, url: `https:${target}` });
		else parts.push({ kind: 'tool', text: label, path: target });
		last = match.index + match[0].length;
	}
	if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
	return parts;
}

/** Every piece of text in an article, for checking its links. */
export function articleTexts(article: GuideArticle): string[] {
	return article.sections.flatMap((section) =>
		section.blocks.flatMap((block) => {
			if (typeof block === 'string') return [block];
			if (block.type === 'list') return block.items;
			if (block.type === 'table') return [...block.columns, ...block.rows.flat()];
			if (block.type === 'widget') return [];
			return [block.text];
		})
	);
}
