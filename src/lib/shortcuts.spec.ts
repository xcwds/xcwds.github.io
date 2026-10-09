import { describe, expect, it } from 'vitest';
import { typingIn } from './shortcuts';

const press = (target: object | null, mods: Partial<KeyboardEvent> = {}) =>
	({ key: '/', target, ...mods }) as unknown as KeyboardEvent;
const el = (inField: boolean) => ({ closest: () => (inField ? {} : null) });

describe('typingIn', () => {
	it('lets "/" through on the page', () => {
		expect(typingIn(press(el(false)))).toBe(false);
		expect(typingIn(press(null))).toBe(false);
	});

	it('leaves keys alone in fields and with modifiers', () => {
		expect(typingIn(press(el(true)))).toBe(true);
		expect(typingIn(press(el(false), { ctrlKey: true }))).toBe(true);
		expect(typingIn(press(el(false), { metaKey: true }))).toBe(true);
	});
});
