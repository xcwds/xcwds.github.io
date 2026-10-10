import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { xcwds } from '@xcwds/sveltekit/vite';

/**
 * The @xcwds plugins' page entries, which only the generated `virtual:xcwds/client` imports, so
 * Vite's dependency scan misses them. Pre-bundled up front, the browser tests don't reload
 * halfway through when Vite discovers them.
 */
const xcwdsClients = [
	'@xcwds/core',
	'@xcwds/plugin-changelog/client',
	'@xcwds/plugin-install/client',
	'@xcwds/plugin-offline/client',
	'@xcwds/plugin-settings/client',
	'@xcwds/plugin-share/client',
	'@xcwds/plugin-shell/client',
	'@xcwds/plugin-theme/client',
	'@xcwds/plugin-timers/client',
	'@xcwds/plugin-tools/client',
	'@xcwds/plugin-update/client'
];

export default defineConfig({
	plugins: [xcwds(), sveltekit(), tailwindcss()],

	test: {
		expect: { requireAssertions: true },

		projects: [
			{
				extends: './vite.config.ts',
				optimizeDeps: { include: xcwdsClients },

				test: {
					name: 'client',

					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},

					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',

				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
