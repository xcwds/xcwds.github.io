# Agent notes

SvelteKit static site (adapter-static, Tailwind, Skeleton) deployed to GitHub Pages from `main`.
Package manager: pnpm.

- Recipes at `/recipes` are imported from Notion — follow [docs/notion-recipes.md](docs/notion-recipes.md).
- Before pushing: `pnpm check && pnpm lint && pnpm test:unit -- --run --project server && pnpm build`.
  (`pnpm lint` already flags Prettier issues in `README.md`, `svelte.config.js` and `src/routes/+page.ts` on `main`.)
