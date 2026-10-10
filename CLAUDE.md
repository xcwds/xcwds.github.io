# Agent notes

Brand: **xcwds**, "Everyday tools that never phone home." (tagline, with the acronym below it). Use xcwds for the app name, titles and file names; no
personal names. xcwds stands for "eXecutes Client-side, Without Data
Servers" (shown on Home and Settings → About; brand strings live in `src/lib/brand.ts`). Tapping it three times
on About reveals the Easter egg "eXtra Crispy Waffles, Deadlifts & Sanitizers".
The app icon (`icon.svg` at the repo root, the "multi-tool X") must stay neutral and discreet: no faces, photos
or revealing text. Some tools will be private (e.g. planned feminine-care tools), and the icon shows on
home screens and in app switchers.

SvelteKit static site (adapter-static, Tailwind, Skeleton) deployed to GitHub Pages from `main`.
Package manager: pnpm.

It runs on the @xcwds framework ([xcwds/xcwds](https://github.com/xcwds/xcwds)): `xcwds.config.ts` holds the
brand, the storage options and the plugin list, and `@xcwds/sveltekit` generates the manifest, icons,
head tags and service worker from it (`.xcwds/` is generated; don't edit it). The packages come from npm
(`@xcwds/*`, all on the same `^0.x` range): a framework change reaches the app once it is released, then
bump the ranges here. To try an unreleased change, point `pnpm.overrides` at
`link:../xcwds/packages/<name>` locally and never commit that. The app's own features are
plugins in `src/plugins/<name>/` (linked packages): `index.js` is the build entry (plain JS, run by Node:
routes, and tools via `tool.js`), `client.ts` the page entry (Vite: registers the plugin's saved data
and settings fields in the app's namespace, `namespace: ''`). A page entry must not import a build
entry that uses Node modules (`recipes` keeps its name in `name.js` for that reason).

- Recipes at `/recipes` are classic back-pocket recipes written here with structured, scalable
  ingredients — follow [docs/classic-recipes.md](docs/classic-recipes.md). Tracking issue: #49.
- The kitchen guide at `/guide` (general know-how: methods, meat, baking, doneness, basics) shares the Recipes
  tab (a Recipes | Guide switch on both pages) — follow [docs/cooking-guide.md](docs/cooking-guide.md).
  Tracking issues: #96 (cooking), #108 (baking).
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
- `/utils` holds small phone-first tools. Each is an app plugin whose `tool.js` describes it (path, name,
  emoji, blurb, `width: 'split'` for two-column pages) and which `@xcwds/plugin-tools` registers, in the
  order `xcwds.config.ts` lists the plugins; `src/lib/utils/tools.ts` collects them for the app's own
  pages. Home shows pinned and recently used tools (`@xcwds/plugin-tools`, saved as `app:home:shortcuts`;
  `home.svelte.ts` mirrors it). A private tool sets `private: true`, so it never appears under
  "Recently used", can't be a manifest shortcut and has no Share button. New tools arrive as GitHub issues. The site is static with no server or
  auth, so tools must be fully client-side; shared logic lives in `src/lib/utils/` (timers count against
  wall-clock end times so they stay correct when a phone backgrounds the tab).
- e2e tests that type into inputs must navigate with `gotoHydrated` from `e2e/helpers.ts`; input sent
  before hydration gets lost or doubled. `<App>` marks `<html data-hydrated>` once the app has booted.
  e2e tests run with service workers blocked (#91: they crashed Chromium on CI); a test file that
  needs the service worker opts in with `test.use({ serviceWorkers: 'allow' })`, as `pwa`, `update`
  and `errors` do.
- The site is an installable PWA: the build writes the manifest and icons (rendered from `icon.svg` at the
  repo root, the `brand.icon`), and `src/service-worker.ts` imports the generated worker, where
  `@xcwds/plugin-offline` precaches every prerendered page for offline use. `@xcwds/plugin-share`'s `target`
  makes the manifest's `share_target` send Android shares to `/utils/url-sanitizer`; the service worker
  moves the shared link from `?query` to the fragment so it never reaches the server, and the page reads
  it with `app.shared.listen`. The iPhone Shortcut opens `#url=<encoded link>` directly. Keep shared links
  out of query strings.
- Unknown URLs: the adapter writes `build/404.html` (a `fallback` that boots the app), GitHub Pages serves
  it for any missing path, and the service worker serves it for offline navigations it has no cache for.
  The app then renders `src/routes/+error.svelte`, titled by the shell.
  `vite preview` renders errors on the server instead, so `e2e/errors.test.ts` serves `build/` like Pages
  does (`e2e/static-server.ts`).
- The root layout renders `<App>` and `@xcwds/plugin-shell`'s `<Shell>`: a header (back arrow + page title as
  the page's only `<h1>`), a bottom tab bar on phones and, on tablets and computers, header links or a left
  sidebar (#95); its tabs are the `sections` in `xcwds.config.ts`. Phones (narrower than `md`, or under
  500px tall) never get the sidebar; elsewhere Settings → Appearance picks per orientation (`settings.nav`,
  defaults: header links in portrait, sidebar in landscape), applied as `data-nav-portrait` /
  `data-nav-landscape` on `<html>` (also set before first paint: the shell's `nav` field has a pre-paint script) and styled with
  the `sidebar:` variant from `@xcwds/plugin-shell/styles.css`. Anything tied to the tab bar keeps using
  `md:`. Every page's `<main>` uses the `page-narrow` (tools, errors), `page-wide` (Home, lists, recipes) or
  `page-split` (Settings, weightlifting, URL sanitizer: narrow until `xl`, then two columns via a
  `@container` query on `@[50rem]:`) container, and its route's `width` (`narrow`, `wide` or `split`) must
  match so the header lines up: a tool's `tool.js` sets it, Settings' comes from its plugin options.
  Breakpoints: phone < `md`, tablet `md`–`lg`, computer `lg`+; `e2e/layout.test.ts` covers each.
  `page-wide` grows to `max-w-5xl` on `lg`, where lists are 3-column grids (2 from `md`) and recipe pages
  put ingredients in a sticky column beside the steps. Titles and back targets come from the routes the
  plugins' build entries register (`recipes` reads the recipe and guide data), so new tools and recipes
  need no nav changes. Pages must not render their own `<h1>` or back links. In the installed app the
  header also has a Share button (`@xcwds/plugin-share`): it shares the page's origin + path only (never
  query or hash) and skips Settings and private tools. Roadmap for further app features: issue #17.
- Never touch `localStorage` directly. Define saved data in `entries` in `src/lib/storage.ts` (an `app:`
  key, a label and a validator), register it from the owning plugin's `client.ts` with `registerEntries`,
  and use `persist()` from `src/lib/persist.svelte.ts` in components, or `read`/`write` elsewhere (they
  go through the kernel's `app.storage`). Changing a saved shape or key needs a new migration in
  `migrations` and a `SCHEMA_VERSION` bump (the app's namespace, saved as `app:version`; v4 moved the alarm
  settings to `@xcwds/plugin-timers`' `alarm` field). Backups say `app: 'xcwds.com'` (`storage.appName`).
- `/settings` holds app-wide settings (`settings` in `src/lib/settings.svelte.ts` mirrors the kernel's
  `app.settings`, saved as `app:settings`; a new field needs a default in `defaultSettings`, a parser in
  `parseSettings`, and an `app.settings.field` call in the owning plugin's `client.ts`), backups
  (export/import/clear via `storage.ts`) and About. Dark mode uses `data-color-scheme` on `<html>` (the
  `dark` variant from `@xcwds/plugin-theme/tailwind.css`), set before first paint by `@xcwds/plugin-theme`'s
  head script. Don't use `data-theme`; Skeleton owns it.
- App updates (`@xcwds/plugin-update`): the service worker never calls `skipWaiting()` on install; a new
  version waits until the user taps Update in the banner (`UpdateBanner.svelte` from the plugin). Anything a
  reload would interrupt must call `markBusy(name, () => isBusy)` from `src/lib/busy.ts` (the coffee timer
  does; `@xcwds/plugin-timers` does it for cooking timers). The cooking timers are `@xcwds/plugin-timers`'
  (saved as `app:cooking-timer:timers`), which ring, keep the screen awake and hold updates on every page;
  `provideCookingTimers`/`useCookingTimers` adapt them for pages and recipe step timers, and a page that
  lists every timer calls `timers.showAll()`. The coffee timer lives in the root layout too
  (`provideCoffeeTimer`/`useCoffeeTimer`). The plugin's `<TimerAlert>` and the app's `TimerAlert.svelte`
  (coffee) show finished timers on pages that don't already show them. Precached
  files are served cache-first from the active worker's own cache (never network-first), so a relaunch
  keeps the old version until Update is tapped. When another tab applies the update, the rest get
  `controllerchange` without asking: hidden idle tabs reload quietly, others show a Reload banner. The e2e test
  `e2e/update.test.ts` deploys a fake new version against its own copy of `build/`.
- What's new: every PR people will notice adds one new file in `changelog/` (a `- ` bullet list of
  short user-facing items, no `id` or `date`; never rename one; see `changelog/README.md`). The build
  compiles the folder (`loadChangelog` in `src/lib/server/changelog.ts`, passed to
  `@xcwds/plugin-changelog` in `xcwds.config.ts`), numbering entries by the commit that added them to
  `main`, so CI and deploy check out full history. After an update the toast links to Settings →
  What's new, which badges entries newer than `app:settings:whats-new-seen`; a fresh install sees none.
  The update hands the version it left over in `sessionStorage` (`app:just-updated`, the key the app used
  before @xcwds, so updating from that version still shows What's new).
- Feedback and app chrome: show confirmations with `toast()` from `src/lib/toast.svelte.ts` (the shell's
  toasts; not per-tool button text); keep validation errors inline next to their control. Toasts, timer
  alerts, the update banner and the offline notice share the shell's `notices` stack in the root layout.
  Install support (`@xcwds/plugin-install`, mirrored by `install.svelte.ts`) shows an Install button /
  iPhone steps in Settings and hides once installed.
- Accessibility baseline lives in `app.css`: 44px minimum controls, a visible `:focus-visible` ring and
  reduced-motion support. `e2e/app-extras.test.ts` audits tap targets on every page at phone, tablet
  (portrait and landscape) and computer sizes; add new pages to it. Buttons that darken on `active:` also
  get the same `hover:not-disabled:` color for mouse users. Search boxes take `use:slashToFocus`
  (`src/lib/shortcuts.ts`) so "/" jumps to them; guide articles show a sticky "On this page" list on `lg`+.
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
