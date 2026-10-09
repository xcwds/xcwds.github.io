/** Served by the changelog plugin in `vite.config.ts` from `changelog/*.md`. */
declare module 'virtual:changelog' {
	const changelog: import('$lib/changelog').ChangelogEntry[];
	export default changelog;
}
