# Agent notes

Brand: **xcwds**, "a cyber-web Swiss Army knife". Use xcwds for the app name, titles and file names; no
personal names. xcwds stands for "eXecutes Client-side, Without Data
Servers" (shown on Home and Settings → About; brand strings live in `src/lib/brand.ts`). Tapping it three times
on About reveals the Easter egg "eXtra Crispy Waffles, Deadlifts & Sanitizers".
The app icon (`static/icons/icon.svg`, the "multi-tool X") must stay neutral and discreet: no faces, photos
or revealing text. Some tools will be private (e.g. planned feminine-care tools), and the icon shows on
home screens and in app switchers.

SvelteKit static site (adapter-static, Tailwind, Skeleton) deployed to GitHub Pages from `main`.
Package manager: pnpm.

- Recipes at `/recipes` are imported from Notion — follow [docs/notion-recipes.md](docs/notion-recipes.md).
- Before pushing: `pnpm check && pnpm lint && pnpm test:unit -- --run --project server && pnpm build`.
  (`pnpm lint` already flags a Prettier issue in `svelte.config.js` on `main`.)
- `/utils` holds small phone-first tools, registered in `src/lib/utils/tools.ts` (the `/utils` index and
  home page render from that list). New tools arrive as GitHub issues. The site is static with no server or
  auth, so tools must be fully client-side; shared logic lives in `src/lib/utils/` (timers count against
  wall-clock end times so they stay correct when a phone backgrounds the tab).
- e2e tests that type into inputs must navigate with `gotoHydrated` from `e2e/helpers.ts`; input sent
  before hydration gets lost or doubled.
- The site is an installable PWA: `static/manifest.webmanifest`, icons in `static/icons/` (rendered from `static/icons/icon.svg`; regenerate with
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
- App updates: the service worker never calls `skipWaiting()` on install; a new version waits until the
  user taps Update in the banner (`src/lib/app-update.svelte.ts`, `UpdateBanner.svelte`). Anything a reload
  would interrupt must call `markBusy(name, () => isBusy)` (the coffee and cooking timers do). The e2e test
  `e2e/update.test.ts` deploys a fake new version against its own copy of `build/`.
- Feedback and app chrome: show confirmations with `toast()` from `src/lib/toast.svelte.ts` (not per-tool
  button text); keep validation errors inline next to their control. Toasts, the update banner and the
  offline notice share one stack in the root layout. Install support (`install.svelte.ts`) shows an
  Install button / iPhone steps in Settings and hides once installed.
- Accessibility baseline lives in `app.css`: 44px minimum controls, a visible `:focus-visible` ring and
  reduced-motion support. `e2e/app-extras.test.ts` audits tap targets on every page; add new pages to it.
- Units are per tool, never app-wide: the weightlifting calculator has lb/kg (`settings.lifting.unit`, unit
  systems in `src/lib/utils/lifting.ts`); the pizza dough calculator is always grams. Tool defaults live in
  `settings` (coffee length, cooking presets, pizza defaults, lifting equipment and owned plates). Settings
  load after pages mount, so seed page state from them in an effect gated on `settingsStatus.ready`.
