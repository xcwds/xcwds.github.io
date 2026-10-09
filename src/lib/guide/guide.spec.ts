import { describe, expect, it } from 'vitest';
import { getRecipe, MAX_STEP_TIMER_MINUTES } from '$lib/recipes';
import { toolGuides, tools } from '$lib/utils/tools';
import {
	articles,
	articleTexts,
	byCategory,
	CATEGORIES,
	EXTERNAL_HOSTS,
	getArticle,
	parseInline,
	searchArticles,
	sectionId,
	slugify,
	type GuideArticle
} from './index';

const isTool = (path: string) => tools.some((tool) => tool.path === path);

/** Every inline link and `related` entry in an article that points nowhere. */
function brokenLinks(article: GuideArticle): string[] {
	const broken: string[] = [];
	for (const text of articleTexts(article)) {
		for (const part of parseInline(text)) {
			if (part.kind === 'guide') {
				const target = getArticle(part.slug);
				if (
					!target ||
					(part.section && !target.sections.some((s) => sectionId(s) === part.section))
				)
					broken.push(`guide:${part.slug}${part.section ? `#${part.section}` : ''}`);
			}
			if (part.kind === 'recipe' && !getRecipe(part.slug)) broken.push(`recipe:${part.slug}`);
			if (part.kind === 'tool' && !isTool(part.path)) broken.push(`tool:${part.path}`);
			if (part.kind === 'external' && !EXTERNAL_HOSTS.includes(URL.parse(part.url)?.host ?? ''))
				broken.push(part.url);
		}
	}
	for (const slug of article.related?.guides ?? []) if (!getArticle(slug)) broken.push(slug);
	for (const slug of article.related?.recipes ?? []) if (!getRecipe(slug)) broken.push(slug);
	for (const path of article.related?.tools ?? []) if (!isTool(path)) broken.push(path);
	return broken;
}

/** Plain-text pieces still holding link or bold markup, which would show on the page as is. */
const unparsedMarkup = (article: GuideArticle) =>
	articleTexts(article)
		.flatMap(parseInline)
		.filter(
			(part) => part.kind === 'text' && /\]\((guide|recipe|tool|https?):|\*\*/.test(part.text)
		)
		.map((part) => part.text);

describe('guide articles', () => {
	it('exist', () => {
		expect(articles.length).toBeGreaterThan(0);
	});

	it.each(articles.map((a) => [a.slug, a] as const))('%s is well formed', (slug, article) => {
		expect(slug).toBe(slugify(slug));
		expect(articles.filter((a) => a.slug === slug)).toHaveLength(1);
		expect(CATEGORIES.map((c) => c.id)).toContain(article.category);
		expect(article.name && article.emoji && article.summary).toBeTruthy();
		expect(article.sections.length).toBeGreaterThan(0);
		const ids = article.sections.map(sectionId);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toBe(slugify(id));
		expect(ids).not.toContain('related');
		for (const section of article.sections) {
			expect(section.blocks.length).toBeGreaterThan(0);
			for (const block of section.blocks) {
				if (typeof block === 'object' && block.type === 'timers') {
					// Like recipe step timers: the alarm only rings while the app is open.
					for (const t of block.timers) {
						expect(t.minutes).toBeGreaterThan(0);
						expect(t.minutes).toBeLessThanOrEqual(MAX_STEP_TIMER_MINUTES);
					}
					expect(new Set(block.timers.map((t) => t.label)).size).toBe(block.timers.length);
				}
				if (typeof block === 'object' && block.type === 'table') {
					for (const row of block.rows) expect(row).toHaveLength(block.columns.length);
				}
			}
		}
		expect(brokenLinks(article)).toEqual([]);
		expect(unparsedMarkup(article)).toEqual([]);
	});

	it.each(articles.map((a) => [a.slug, a] as const))(
		'%s writes temperatures with both units',
		(_, article) => {
			for (const text of articleTexts(article)) {
				// Every °F has a °C right after it, like the recipes: "400°F (200°C)", "400–450°F (200–230°C)".
				const fahrenheit = text.match(/\d°F(?! \(-?\d+(?:–-?\d+)?°C\))/g) ?? [];
				expect(fahrenheit, text).toEqual([]);
			}
		}
	);
});

describe('tool guides', () => {
	it('link to articles that exist', () => {
		for (const tool of tools)
			for (const slug of toolGuides(tool.path)) expect(getArticle(slug), tool.path).toBeDefined();
	});
});

describe('parseInline', () => {
	it('splits out bold text and links', () => {
		expect(
			parseInline(
				'Use **two zones**, see [searing](guide:stovetop#searing) or [x](tool:/utils/oven-time).'
			)
		).toEqual([
			{ kind: 'text', text: 'Use ' },
			{ kind: 'text', text: 'two zones', bold: true },
			{ kind: 'text', text: ', see ' },
			{ kind: 'guide', text: 'searing', slug: 'stovetop', section: 'searing' },
			{ kind: 'text', text: ' or ' },
			{ kind: 'tool', text: 'x', path: '/utils/oven-time' },
			{ kind: 'text', text: '.' }
		]);
	});

	it('links recipes and leaves unknown link kinds as text', () => {
		expect(parseInline('[Roast](recipe:roast-chicken)')).toEqual([
			{ kind: 'recipe', text: 'Roast', slug: 'roast-chicken' }
		]);
		expect(parseInline('[a](http://example.com)')).toEqual([
			{ kind: 'text', text: '[a](http://example.com)' }
		]);
		expect(parseInline('[USDA](https://www.fsis.usda.gov/x)')).toEqual([
			{ kind: 'external', text: 'USDA', url: 'https://www.fsis.usda.gov/x' }
		]);
	});
});

describe('unparsedMarkup', () => {
	it('catches links and bold that did not parse', () => {
		const article = (text: string): GuideArticle => ({
			...articles[0],
			sections: [{ heading: 'Test', blocks: [text] }]
		});
		expect(unparsedMarkup(article('See [sear](guide:stovetop).'))).toEqual([]);
		expect(unparsedMarkup(article('See [sear](guide: stovetop).'))).toHaveLength(1);
		expect(unparsedMarkup(article('**[x](recipe:roast-chicken)**'))).toHaveLength(1);
		expect(unparsedMarkup(article('An **unclosed bold'))).toHaveLength(1);
	});
});

describe('search and grouping', () => {
	it('matches name, summary and tags', () => {
		const [first] = articles;
		expect(searchArticles(articles, first.name.toUpperCase())).toContain(first);
		expect(searchArticles(articles, first.tags[0])).toContain(first);
		expect(searchArticles(articles, 'zzz-nothing')).toEqual([]);
		expect(searchArticles(articles, '  ')).toBe(articles);
	});

	it('groups by category in category order and skips empty ones', () => {
		const groups = byCategory(articles);
		const order = CATEGORIES.map((c) => c.id);
		expect(groups.map((g) => order.indexOf(g.id))).toEqual(
			[...groups.map((g) => order.indexOf(g.id))].sort((a, b) => a - b)
		);
		for (const group of groups) expect(group.articles.length).toBeGreaterThan(0);
		expect(groups.flatMap((g) => g.articles)).toHaveLength(articles.length);
	});
});
