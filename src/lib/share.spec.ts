import { describe, expect, it } from 'vitest';
import { shareTarget } from './share';

const at = (path: string) => new URL(`https://xcwds.com${path}`);

describe('shareTarget (#89)', () => {
	it('shares a page by its title and bare link', () => {
		expect(shareTarget(at('/recipes/chocolate-chip-cookies'))).toEqual({
			title: 'Chocolate Chip Cookies',
			text: 'Chocolate Chip Cookies on xcwds',
			url: 'https://xcwds.com/recipes/chocolate-chip-cookies'
		});
		expect(shareTarget(at('/utils/oven-time/'))?.url).toBe('https://xcwds.com/utils/oven-time');
		expect(shareTarget(at('/utils'))?.title).toBe('Utils');
		expect(shareTarget(at('/'))).toEqual({
			title: 'xcwds',
			text: 'xcwds: Everyday tools that never phone home.',
			url: 'https://xcwds.com/'
		});
	});

	it('never shares the query or hash, which can hold what you typed', () => {
		expect(
			shareTarget(at('/utils/url-sanitizer?x=1#url=https%3A%2F%2Fprivate.example%2F'))?.url
		).toBe('https://xcwds.com/utils/url-sanitizer');
	});

	it("doesn't share Settings or private tools", () => {
		expect(shareTarget(at('/settings'))).toBeNull();
		const tools = [{ path: '/utils/private', recents: false }, { path: '/utils/open' }];
		expect(shareTarget(at('/utils/private'), tools)).toBeNull();
		expect(shareTarget(at('/utils/open'), tools)).not.toBeNull();
	});
});
