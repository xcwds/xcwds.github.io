import { porkChopsPath } from '$lib/parody';
import { getRecipe } from '$lib/recipes';
import { tools } from '$lib/utils/tools';

/** Top-level sections shown in the tab bar (phones) and header (desktop). */
export const sections = [
	{ path: '/', label: 'Home', emoji: '🏠' },
	{ path: '/recipes', label: 'Recipes', emoji: '📖' },
	{ path: '/utils', label: 'Utils', emoji: '🧰' },
	{ path: '/settings', label: 'Settings', emoji: '⚙️' }
] as const;

export type SectionPath = (typeof sections)[number]['path'];

export type RouteInfo = {
	title: string;
	emoji?: string;
	/** Where the header's back arrow goes; top-level sections have none. */
	parent?: SectionPath;
};

/** Standalone pages outside the sections, tools and recipes. */
const pages: Record<string, RouteInfo> = {
	[porkChopsPath]: { title: 'Pork Chops', emoji: '🍂', parent: '/' }
};

const normalize = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

/** Header title and back target for a path. New tools and recipes are picked up automatically. */
export function routeInfo(pathname: string): RouteInfo {
	const path = normalize(pathname);
	if (path === '/') return { title: 'xcwds' };

	const section = sections.find((s) => s.path === path);
	if (section) return { title: section.label };

	if (pages[path]) return pages[path];

	const tool = tools.find((t) => t.path === path);
	if (tool) return { title: tool.name, emoji: tool.emoji, parent: '/utils' };

	const recipeSlug = path.match(/^\/recipes\/([^/]+)$/)?.[1];
	const recipe = recipeSlug ? getRecipe(recipeSlug) : undefined;
	if (recipe) return { title: recipe.name, emoji: recipe.emoji, parent: '/recipes' };

	return { title: 'xcwds', parent: '/' };
}

/** Header title for the error page (src/routes/+error.svelte), with a way back home. */
export function errorInfo(status: number): RouteInfo {
	return { title: status === 404 ? 'Page not found' : 'Something went wrong', parent: '/' };
}

/** The section a path belongs to, for highlighting the current tab. */
export function activeSection(pathname: string): SectionPath {
	const path = normalize(pathname);
	const match = sections
		.filter((s) => s.path !== '/')
		.find((s) => path === s.path || path.startsWith(`${s.path}/`));
	return match?.path ?? '/';
}

/** Pages that are narrow on phones and tablets but use two columns on computers (#95). */
const splitPages = ['/settings', '/utils/weightlifting', '/utils/url-sanitizer'];

/**
 * Which page container (`page-narrow` / `page-wide` / `page-split` in app.css) a path's <main>
 * uses, so the header can line up with it. Lists, recipes and Home are wide; tools and errors
 * narrow; Settings, the weightlifting calculator and the URL sanitizer split into two columns
 * when there's room.
 */
export function pageWidth(pathname: string): 'narrow' | 'wide' | 'split' {
	const path = normalize(pathname);
	if (splitPages.includes(path)) return 'split';
	if (tools.some((t) => t.path === path)) return 'narrow';
	return 'wide';
}
