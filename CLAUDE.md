# Agent notes

Brand: **xcwds**, "Everyday tools that never phone home." (tagline, with the acronym below it). Use xcwds for the app name, titles and file names; no
personal names. xcwds stands for "eXecutes Client-side, Without Data
Servers" (shown on Home and Settings → About; brand strings live in `src/lib/brand.ts`). Tapping it three times
on About reveals the Easter egg "eXtra Crispy Waffles, Deadlifts & Sanitizers".
The app icon (`static/icons/icon.svg`, the "multi-tool X") must stay neutral and discreet: no faces, photos
or revealing text. Some tools will be private (e.g. planned feminine-care tools), and the icon shows on
home screens and in app switchers.

SvelteKit static site (adapter-static, Tailwind, Skeleton) deployed to GitHub Pages from `main`.
Package manager: pnpm.

- Recipes at `/recipes` are classic back-pocket recipes written here with structured, scalable
  ingredients — follow [docs/classic-recipes.md](docs/classic-recipes.md). Tracking issue: #49.
- Before pushing: `pnpm check && pnpm lint && pnpm test:unit --run --project server && pnpm build`
  (no `--` before `--run`: with it, vitest ignores `--project` and also starts the browser project).
- CI (`.github/workflows/ci.yml`) runs check, lint, all unit tests and e2e on every PR, and
  `deploy.yml` runs it before each deploy, so a red check blocks the deploy to Pages.
- `pnpm test:e2e` needs a Playwright browser. In Claude Code cloud containers don't run
  `playwright install`; use a config (kept out of the repo) that sets
  `use.launchOptions.executablePath` to the Chromium under `/opt/pw-browsers/chromium-*/chrome-linux/chrome`.
- Always open a pull request for work you push (against `main`, linking the issues it addresses),
  unless the user explicitly says not to. Pushing a branch alone is not done.
- After opening a PR, review it yourself adversarially (look for what's broken, unsafe or missing, not
  just style), and post that review following "Reviewing a PR" below. If it finds anything, fix it,
  push, reply to each thread with the fixing commit, resolve it, and review again. Allow at most 3
  rounds of fixes: a review always follows the last fix push, and if that review still finds
  something, stop, leave the PR open and report the remaining findings to the user.
- Merging your own PR (one you opened, or one the user asked you to take over or get merged): when a
  review passes (nothing left that needs a change) and the PR is mergeable (no conflicts, the pre-push
  checks and `pnpm test:e2e` pass locally, and the CI check is green on its head), squash-merge it,
  unless the user said not to merge. GitHub won't let you
  approve your own PR, so post the passing review as a comment review. Reviewing anyone else's PR
  only posts the review; never merge it unless asked.
- `/utils` holds small phone-first tools, registered in `src/lib/utils/tools.ts` (the `/utils` index and
  home page render from that list). Home shows pinned and recently used tools (`src/lib/home.ts` rules,
  `home.svelte.ts` state, saved as `app:home:shortcuts`; recents are recorded in the root layout). A
  private tool must set `recents: false` so it never appears under "Recently used". New tools arrive as GitHub issues. The site is static with no server or
  auth, so tools must be fully client-side; shared logic lives in `src/lib/utils/` (timers count against
  wall-clock end times so they stay correct when a phone backgrounds the tab).
- e2e tests that type into inputs must navigate with `gotoHydrated` from `e2e/helpers.ts`; input sent
  before hydration gets lost or doubled.
- The site is an installable PWA: `static/manifest.webmanifest`, icons in `static/icons/` (rendered from `static/icons/icon.svg`; regenerate with
  `node scripts/generate-icons.mjs`), and `src/service-worker.ts`, which precaches every prerendered page for
  offline use. The manifest's `share_target` sends Android shares to `/utils/url-sanitizer`; the service
  worker moves the shared link from `?query` to `#url=` so it never reaches the server. The iPhone
  Shortcut opens `#url=<encoded link>` directly. Keep shared links out of query strings.
- Unknown URLs: the adapter writes `build/404.html` (a `fallback` that boots the app), GitHub Pages serves
  it for any missing path, and the service worker serves it for offline navigations it has no cache for.
  The app then renders `src/routes/+error.svelte`, titled by `errorInfo` in `src/lib/nav.ts`.
  `vite preview` renders errors on the server instead, so `e2e/errors.test.ts` serves `build/` like Pages
  does (`e2e/static-server.ts`).
- The root layout is the app shell: a header (back arrow + page title as the page's only `<h1>`), a bottom tab
  bar on phones and, on tablets and computers, header links or a left sidebar (#95). Phones (narrower than
  `md`, or under 500px tall) never get the sidebar; elsewhere Settings → Appearance picks per orientation
  (`settings.nav`, defaults: header links in portrait, sidebar in landscape), applied as `data-nav-portrait` /
  `data-nav-landscape` on `<html>` (also set by the `app.html` inline script) and styled with the `sidebar:`
  variant in `app.css`. Anything tied to the tab bar keeps using `md:`. Every page's `<main>` uses the
  `page-narrow` (tools, Settings, errors) or `page-wide` (Home, lists, recipes) container from `app.css`, and
  `pageWidth` in `src/lib/nav.ts` must name the same one so the header lines up. Breakpoints: phone < `md`,
  tablet `md`–`lg`, computer `lg`+; `e2e/layout.test.ts` covers each. Titles and back targets come from `routeInfo` in `src/lib/nav.ts`,
  which reads `tools.ts` and the recipe data, so new tools/recipes need no nav changes. Pages must not render
  their own `<h1>` or back links. In the installed app the header also has a Share button (`src/lib/share.ts`):
  it shares the page's origin + path only (never query or hash) and skips Settings and private
  tools (`recents: false`). Roadmap for further app features: issue #17.
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
  would interrupt must call `markBusy(name, () => isBusy)` (the coffee and cooking timers do). Timers live in the root layout, not their pages: `provideCookingTimers`/`provideCoffeeTimer` create the app-wide instances (pages and recipe step timers get them with `useCookingTimers`/`useCoffeeTimer`), so they ring, keep the screen awake and `markBusy` on every page; `TimerAlert.svelte` shows finished timers on pages that don't already show them. Precached
  files are served cache-first from the active worker's own cache (never network-first), so a relaunch
  keeps the old version until Update is tapped. When another tab applies the update, the rest get
  `controllerchange` without asking: hidden idle tabs reload quietly, others show a Reload banner. The e2e test
  `e2e/update.test.ts` deploys a fake new version against its own copy of `build/`.
- What's new: every PR people will notice adds an entry to `src/lib/changelog.ts` (next `id`, today's
  date, short user-facing items; one entry per PR). After an update the toast links to Settings →
  What's new, which badges entries newer than `app:settings:whats-new-seen`; a fresh install sees none.
- Feedback and app chrome: show confirmations with `toast()` from `src/lib/toast.svelte.ts` (not per-tool
  button text); keep validation errors inline next to their control. Toasts, the update banner and the
  offline notice share one stack in the root layout. Install support (`install.svelte.ts`) shows an
  Install button / iPhone steps in Settings and hides once installed.
- Accessibility baseline lives in `app.css`: 44px minimum controls, a visible `:focus-visible` ring and
  reduced-motion support. `e2e/app-extras.test.ts` audits tap targets on every page; add new pages to it.
- Units are per tool, never app-wide: recipes have US/metric (`settings.recipeUnits`, `null` = as
  written; see docs/classic-recipes.md); the weightlifting calculator has lb/kg (`settings.lifting.unit`, unit
  systems in `src/lib/utils/lifting.ts`); the pizza dough calculator is always grams. Tool defaults live in
  `settings` (coffee length, cooking presets, pizza defaults, and weightlifting equipment sets:
  `settings.lifting` holds your sets of bars and plate counts plus the active one, with the built-in
  read-only "Commercial gym" from `commercialGym()`; the calculator loads from `activeSet()`). Settings
  load after pages mount, so seed page state from them in an effect gated on `settingsStatus.ready`.
- `persist()` only writes when a value changes (never just because a page opened), and removes the entry
  when `get` returns `undefined`. It loads changes other tabs save (`storage` event; pass `cleared` to
  handle removal, `sync: false` for per-window UI state) and reports failed writes with one toast
  (`reportSaveFailure`). Actions that confirm a save must check the real result: apply list changes with
  `update()` from `storage.ts` (it starts from the latest saved value) then `markSaved()` and
  `saveResult(..., { explicit: true })`, or call `saveSettings()`, and only toast "saved" when it returns
  true. A synced value can lack fields another tab dropped: in `set`, treat a missing field as "back to the
  default", never "keep mine". Keep "nothing saved" meaningful: a tool default applies until the user
  makes their own choice, and changing the default in Settings clears that choice. Workouts store their
  own `unit`; never label logged weights with the calculator's current unit.
- Workout history: "Finish workout" moves the current workout into `app:workout-history` (its own storage
  group, so clearing the calculator never wipes it); the weightlifting page owns the history state and
  passes it to `History.svelte`. Copy reactive state with `$state.snapshot`, not `structuredClone`.
- Reviewing a PR: always post the review on GitHub as a review (not only in chat), with inline comments
  on the lines where a finding applies and the overall verdict in the review body.
