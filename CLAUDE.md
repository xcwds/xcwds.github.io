# Agent notes

SvelteKit static site (adapter-static, Tailwind, Skeleton) deployed to GitHub Pages from `main`.
Package manager: pnpm.

- Recipes at `/recipes` are imported from Notion — follow [docs/notion-recipes.md](docs/notion-recipes.md).
- Before pushing: `pnpm check && pnpm lint && pnpm test:unit -- --run --project server && pnpm build`.
  (`pnpm lint` already flags Prettier issues in `README.md` and `svelte.config.js` on `main`.)
- `/utils` holds small phone-first tools, registered in `src/lib/utils/tools.ts` (the `/utils` index and
  home page render from that list). New tools arrive as GitHub issues. The site is static with no server or
  auth, so tools must be fully client-side; shared logic lives in `src/lib/utils/` (timers count against
  wall-clock end times so they stay correct when a phone backgrounds the tab).
- e2e tests that type into inputs must navigate with `gotoHydrated` from `e2e/helpers.ts`; input sent
  before hydration gets lost or doubled.
- The site is an installable PWA: `static/manifest.webmanifest`, icons in `static/icons/` (made from the GitHub avatar in `scripts/icon-source.jpg`; regenerate with
  `node scripts/generate-icons.mjs`), and `src/service-worker.ts`, which precaches every prerendered page for
  offline use. The manifest's `share_target` sends Android shares to `/utils/url-sanitizer`; the service
  worker moves the shared link from `?query` to `#url=` so it never reaches the server. The iPhone
  Shortcut opens `#url=<encoded link>` directly. Keep shared links out of query strings.
- The root layout is the app shell: a header (back arrow + page title as the page's only `<h1>`), a bottom tab
  bar on phones and header links on desktop. Titles and back targets come from `routeInfo` in `src/lib/nav.ts`,
  which reads `tools.ts` and the recipe data, so new tools/recipes need no nav changes. Pages must not render
  their own `<h1>` or back links. Roadmap for further app features: issue #17.
- Never touch `localStorage` directly. Register saved data in `entries` in `src/lib/storage.ts` (an `app:`
  key, a label and a validator) and use `persist()` from `src/lib/persist.svelte.ts` in components, or
  `read`/`write` elsewhere. Changing a saved shape or key needs a new migration and a `SCHEMA_VERSION` bump.
- `/settings` holds app-wide settings (`settings` in `src/lib/settings.svelte.ts`, saved as `app:settings`;
  new fields just need a default in `defaultSettings`), backups (export/import/clear via `storage.ts`) and
  About. Dark mode uses `data-color-scheme` on `<html>` (custom `dark` variant in `app.css`), set before
  first paint by the inline script in `app.html` — keep that script in sync with `settings.svelte.ts`.
  Don't use `data-theme`; Skeleton owns it.
