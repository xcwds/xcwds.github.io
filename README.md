# xcwds

**A cyber-web Swiss Army knife.** Live at [xcwds.com](https://xcwds.com).

A static site that installs as an app (PWA) and works offline. Everything runs in the browser: no
accounts, no server, and your data stays on your device (back it up from Settings).

## What's inside

- **Recipes**: searchable recipes, imported from Notion.
- **Utils**:
  - Pizza Dough Calculator: baker's percentages, in grams.
  - Coffee Timer and Cooking Timer: keep running in the background, with alarms.
  - URL Sanitizer: strips tracking parameters. Share links to it straight from other apps.
  - Weightlifting Calculator: plate math for bars, dumbbells and kettlebells, plus a workout log.
- **Settings**: theme, timer alarm options, data backup/import, and app updates.

New tools are requested as GitHub issues.

## Tech stack

Static site generation:

- `svelte`
- `sveltekit`
- `@sveltejs/adapter-static`

UI components:

- `tailwindcss`
- `skeleton`

## Development

```sh
pnpm install
pnpm dev
```

Before pushing: `pnpm check && pnpm lint && pnpm test:unit -- --run --project server && pnpm build`.
Agent notes live in [CLAUDE.md](CLAUDE.md).

## Credits

Thank you to [Mark Holmes](https://www.markholm.es/) for the [mini-me](https://github.com/MHolmes91/mini-me) repository, it served as a guide helping me set up my initial site.
