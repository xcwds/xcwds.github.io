import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],

	kit: {
		// GitHub Pages serves 404.html for unknown URLs; it boots the app, which shows
		// src/routes/+error.svelte. The service worker also uses it offline.
		adapter: adapter({ fallback: '404.html' }),
		alias: {
			$components: 'src/components'
		}
	},
	extensions: ['.svelte', '.svx']
};

export default config;
