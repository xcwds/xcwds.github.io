# Agent notes

SvelteKit static site (adapter-static, Tailwind, Skeleton) deployed to GitHub Pages from `main`.
Package manager: pnpm.

- Recipes at `/recipes` are imported from Notion — follow [docs/notion-recipes.md](docs/notion-recipes.md).
- Before pushing: `pnpm check && pnpm lint && pnpm test:unit -- --run --project server && pnpm build`.
  (`pnpm lint` already flags Prettier issues in `README.md` and `svelte.config.js` on `main`.)
- `/utils` holds small phone-first tools (pizza dough calculator, coffee and cooking timers). The site is
  static with no server or auth, so tools must be fully client-side; shared logic lives in `src/lib/utils/`
  (timers count against wall-clock end times so they stay correct when a phone backgrounds the tab).
