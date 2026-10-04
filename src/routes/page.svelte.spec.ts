import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('links to each section', async () => {
		render(Page);

		await expect.element(page.getByRole('link', { name: /Recipes/ })).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: /Utils/ })).toBeInTheDocument();
	});
});
