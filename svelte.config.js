import { mdsvex } from 'mdsvex';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { withXcwds } from '@xcwds/sveltekit/config';

// @xcwds sets up adapter-static (with the `404.html` fallback GitHub Pages serves for unknown
// URLs, which boots the app and shows src/routes/+error.svelte; the service worker uses it
// offline too), prerendering of every registered page, and the Content Security Policy.
/** @type {import('@sveltejs/kit').Config} */
export default await withXcwds({
	preprocess: [vitePreprocess(), mdsvex()],
	kit: {
		alias: {
			$components: 'src/components'
		}
	},
	extensions: ['.svelte', '.svx']
});
