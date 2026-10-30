# xcwds

**Everyday tools that never phone home.** Live at [xcwds.com](https://xcwds.com).

**xcwds**: e**X**ecutes **C**lient-side, **W**ithout **D**ata **S**ervers.

A static site that installs as an app (PWA) and works offline. Everything runs in the browser: no
accounts, no server, and your data stays on your device (back it up from Settings).

## What's inside

- **Recipes**: classic back-pocket recipes with a servings scaler and an oven temperature converter.
- **Kitchen Guide**: general know-how next to the recipes: methods, meat, baking, doneness and basics.
- **Utils**:
  - Pizza Dough Calculator: baker's percentages, in grams.
  - Coffee Timer and Cooking Timer: keep running in the background, with alarms.
  - Oven Time Converter: a new cook time when the oven has to be hotter or cooler.
  - URL Sanitizer: strips tracking parameters. Share links to it straight from other apps.
  - Weightlifting Calculator: plate math for bars, dumbbells and kettlebells, plus a workout log.
- **Settings**: theme, layout, recipe units, tool defaults, timer alarms, and data backup/import.

New tools are requested as GitHub issues.

## Tech stack

The app runs on [@xcwds](https://github.com/xcwds/xcwds), a plugin-based framework for private,
offline-first PWAs: it provides the shell (header, tabs, toasts), storage and settings, the service
worker, updates and most of the app chrome. The app's own features are plugins in `src/plugins/`.

Static site generation:

- `svelte`
- `sveltekit`
- `@sveltejs/adapter-static`

Styling:

- `tailwindcss`

## Development

```sh
pnpm install
pnpm dev
```

Or open the repo in its dev container (`.devcontainer/`, e.g. VS Code's "Reopen in Container"): it has
the Node version from `.tool-versions`, pnpm and Playwright's Chromium, isolated from your machine.

Before pushing: `pnpm check && pnpm lint && pnpm test:unit --run --project server && pnpm build`.
Agent notes live in [CLAUDE.md](CLAUDE.md).

## Credits

Thank you to [Mark Holmes](https://www.markholm.es/) for the [mini-me](https://github.com/MHolmes91/mini-me) repository, it served as a guide helping me set up my initial site.
