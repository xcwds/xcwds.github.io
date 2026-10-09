import { describe, expect, it } from 'vitest';
import { activeSection, errorInfo, pageWidth, routeInfo } from './nav';
import { porkChopsPath } from './parody';
import { recipes } from './recipes';
import { tools } from './utils/tools';

describe('routeInfo', () => {
	it('titles the top-level sections without a back target', () => {
		expect(routeInfo('/')).toEqual({ title: 'xcwds' });
		expect(routeInfo('/recipes')).toEqual({ title: 'Recipes' });
		expect(routeInfo('/utils/')).toEqual({ title: 'Utils' });
	});

	it('covers every tool, going back to /utils', () => {
		for (const tool of tools) {
			expect(routeInfo(tool.path)).toEqual({
				title: tool.name,
				emoji: tool.emoji,
				parent: '/utils'
			});
		}
	});

	it('covers every recipe, going back to /recipes', () => {
		for (const recipe of recipes) {
			expect(routeInfo(`/recipes/${recipe.slug}`)).toEqual({
				title: recipe.name,
				emoji: recipe.emoji,
				parent: '/recipes'
			});
		}
	});

	it('titles the pork chop parody page', () => {
		expect(routeInfo(`${porkChopsPath}/`)).toEqual({
			title: 'Pork Chops',
			emoji: '🍂',
			parent: '/'
		});
	});

	it('titles error pages, going back home', () => {
		expect(errorInfo(404)).toEqual({ title: 'Page not found', parent: '/' });
		expect(errorInfo(500)).toEqual({ title: 'Something went wrong', parent: '/' });
	});

	it('falls back to home for unknown pages', () => {
		expect(routeInfo('/nope')).toEqual({ title: 'xcwds', parent: '/' });
		expect(routeInfo('/recipes/not-a-recipe').parent).toBe('/');
	});
});

describe('activeSection', () => {
	it('matches nested pages to their section', () => {
		expect(activeSection('/')).toBe('/');
		expect(activeSection('/recipes/pizza-dough')).toBe('/recipes');
		expect(activeSection('/utils/coffee-timer')).toBe('/utils');
		expect(activeSection('/utilsx')).toBe('/');
	});
});

describe('pageWidth', () => {
	it('keeps tools and Settings narrow', () => {
		for (const tool of tools) expect(pageWidth(tool.path)).toBe('narrow');
		expect(pageWidth('/settings/')).toBe('narrow');
	});

	it('makes Home, lists and recipes wide', () => {
		for (const path of ['/', '/recipes', '/utils', `/recipes/${recipes[0].slug}`])
			expect(pageWidth(path)).toBe('wide');
	});
});
