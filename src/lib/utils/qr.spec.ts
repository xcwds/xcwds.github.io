import { describe, expect, it } from 'vitest';
import { cleanLink, qrFragment, textFromFragment } from './qr';

describe('cleanLink', () => {
	it('removes trackers and counts them', () => {
		expect(cleanLink('https://shop.example/item?id=7&utm_source=poster&fbclid=x')).toEqual({
			link: 'https://shop.example/item?id=7',
			removed: 2,
			via: null
		});
	});

	it('leaves a clean link alone', () => {
		expect(cleanLink('https://example.com/menu')).toEqual({
			link: 'https://example.com/menu',
			removed: 0,
			via: null
		});
	});

	it("drops Amazon's /ref= segment", () => {
		expect(cleanLink('https://www.amazon.com/dp/B000/ref=sr_1_1?tag=x')?.link).toBe(
			'https://www.amazon.com/dp/B000'
		);
	});

	it('unwraps a redirect link and says from where', () => {
		const target = 'https://example.com/a?utm_medium=qr&b=1';
		const cleaned = cleanLink(`https://www.google.com/url?q=${encodeURIComponent(target)}`);
		expect(cleaned?.link).toBe('https://example.com/a?b=1');
		expect(cleaned?.via).toBeTruthy();
	});

	it("isn't a link", () => {
		expect(cleanLink('WIFI:S:Home;T:WPA;P:secret;;')).toBeNull();
		expect(cleanLink('')).toBeNull();
	});
});

describe('the #text= fragment', () => {
	it('round-trips any text, & and + included', () => {
		const text = 'https://example.com/?a=1&b=2+3#frag ✓';
		expect(textFromFragment(qrFragment(text))).toBe(text);
	});

	it('is null for anything else', () => {
		expect(textFromFragment('')).toBeNull();
		expect(textFromFragment('#url=x')).toBeNull();
		expect(textFromFragment('#text=%E0%A4%A')).toBeNull();
	});
});
